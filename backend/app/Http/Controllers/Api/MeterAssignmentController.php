<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerContract;
use App\Models\Meter;
use App\Models\MeterAssignment;
use App\Models\MeterSeal;
use App\Services\CustomerContractWorkflowService;
use App\Services\MeterInventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class MeterAssignmentController extends Controller
{
    public function __construct(
        private readonly CustomerContractWorkflowService $contracts,
        private readonly MeterInventoryService $inventory,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => MeterAssignment::with($this->relations())->latest()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateAssignment($request);
        $sealPhoto = $request->file('seal_photo');
        $storedPhotoPath = null;

        try {
            $assignment = DB::transaction(function () use ($request, $data, $sealPhoto, &$storedPhotoPath): MeterAssignment {
                $customer = Customer::query()->whereKey($data['customer_id'])->lockForUpdate()->firstOrFail();
                $meter = Meter::query()->whereKey($data['meter_id'])->lockForUpdate()->firstOrFail();
                $meter = $this->inventory->ensureLegacyProvenance($meter, $request->user());
                abort_unless($meter->status === 'available', 422, 'Only an available meter can be assigned.');
                abort_unless($meter->current_warehouse_id, 422, 'This meter is not held in an active warehouse.');
                if (
                    ! empty($data['source_warehouse_id'])
                    && (int) $data['source_warehouse_id'] !== (int) $meter->current_warehouse_id
                ) {
                    throw ValidationException::withMessages([
                        'source_warehouse_id' => ['The selected meter is no longer available in this warehouse.'],
                    ]);
                }

                $currentAssignment = MeterAssignment::query()
                    ->where('customer_id', $customer->id)
                    ->where('status', 'active')
                    ->lockForUpdate()
                    ->first();
                $contract = $this->resolveContract($customer, $data['customer_contract_id'] ?? null);
                $sealedAt = $data['sealed_at'] ?? $data['installation_date'];

                if ($currentAssignment) {
                    abort_unless($contract->status === 'active', 422, 'Meter replacement requires an active customer contract.');
                    $this->closeCurrentSeal(
                        $currentAssignment,
                        'replaced',
                        $request->user()?->id,
                        $sealedAt,
                        'Meter replaced by a new assignment.',
                    );
                    $currentAssignment->update(['status' => 'replaced', 'removed_at' => $sealedAt]);
                    $this->inventory->releaseFromAssignment(
                        $currentAssignment,
                        $request->user(),
                        $data['previous_meter_disposition'] ?? 'repair',
                        isset($data['return_warehouse_id']) ? (int) $data['return_warehouse_id'] : null,
                        'Meter replaced by a new assignment.',
                        $sealedAt,
                    );
                } else {
                    abort_unless($contract->status === 'installation_pending', 422, 'The customer contract must be confirmed before the first meter is installed and sealed.');
                }

                $assignmentData = $data;
                unset(
                    $assignmentData['sealed_at'],
                    $assignmentData['sealed_by'],
                    $assignmentData['seal_photo'],
                    $assignmentData['seal_notes'],
                    $assignmentData['previous_meter_disposition'],
                    $assignmentData['return_warehouse_id'],
                );
                $assignment = MeterAssignment::query()->create(array_merge($assignmentData, [
                    'customer_contract_id' => $contract->id,
                    'source_warehouse_id' => $meter->current_warehouse_id,
                    'installed_by' => $request->user()->id,
                    'status' => 'active',
                ]));

                $photoData = $this->storeSealPhoto($sealPhoto, $assignment->id);
                $storedPhotoPath = $photoData['photo_path'];
                $assignment->seals()->create(array_merge($photoData, [
                    'sealed_by' => $request->user()->id,
                    'seal_number' => $data['seal_number'],
                    'sealed_at' => $sealedAt,
                    'status' => 'intact',
                    'notes' => $data['seal_notes'] ?? null,
                ]));

                $this->inventory->issueForAssignment($meter, $assignment, $request->user(), $data['installation_date']);

                if (! $currentAssignment) {
                    $this->contracts->activate($contract, $request->user(), $data['installation_date']);
                } else {
                    $customer->update(['status' => 'active']);
                }

                return $assignment;
            });
        } catch (Throwable $exception) {
            if ($storedPhotoPath) {
                Storage::disk('local')->delete($storedPhotoPath);
            }
            throw $exception;
        }

        return response()->json(['data' => $assignment->fresh()->load($this->relations())], 201);
    }

    public function show(MeterAssignment $meterAssignment): JsonResponse
    {
        return response()->json(['data' => $meterAssignment->load($this->relations())]);
    }

    public function update(Request $request, MeterAssignment $meterAssignment): JsonResponse
    {
        $data = $this->validateAssignment($request, true);
        if (isset($data['customer_id']) && (int) $data['customer_id'] !== (int) $meterAssignment->customer_id) {
            throw ValidationException::withMessages(['customer_id' => ['An assignment cannot be moved to another customer. Create a new assignment instead.']]);
        }
        if (isset($data['meter_id']) && (int) $data['meter_id'] !== (int) $meterAssignment->meter_id) {
            throw ValidationException::withMessages(['meter_id' => ['Use a new assignment to replace a meter so the meter history remains complete.']]);
        }
        unset(
            $data['customer_id'],
            $data['meter_id'],
            $data['customer_contract_id'],
            $data['source_warehouse_id'],
            $data['return_warehouse_id'],
            $data['previous_meter_disposition'],
            $data['status'],
            $data['removed_at'],
        );
        $meterAssignment->update($data);

        return response()->json(['data' => $meterAssignment->fresh()->load($this->relations())]);
    }

    public function destroy(Request $request, MeterAssignment $meterAssignment): JsonResponse
    {
        $data = $request->validate([
            'disposition' => ['nullable', Rule::in(['return_to_stock', 'repair', 'scrap'])],
            'return_warehouse_id' => [
                'nullable',
                'integer',
                Rule::exists('warehouses', 'id')->where('status', 'active'),
            ],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($request, $meterAssignment, $data): void {
            $assignment = MeterAssignment::query()->whereKey($meterAssignment->id)->lockForUpdate()->firstOrFail();
            abort_unless($assignment->status === 'active', 422, 'Only an active meter assignment can be removed.');
            $removedAt = now();
            $reason = $data['reason'] ?? 'Meter assignment removed.';
            $this->closeCurrentSeal($assignment, 'removed', $request->user()?->id, $removedAt, $reason);
            $assignment->update(['status' => 'removed', 'removed_at' => $removedAt]);
            $this->inventory->releaseFromAssignment(
                $assignment,
                $request->user(),
                $data['disposition'] ?? 'return_to_stock',
                isset($data['return_warehouse_id']) ? (int) $data['return_warehouse_id'] : null,
                $reason,
                $removedAt,
            );
            $assignment->customer()->update(['status' => 'awaiting_installation']);
        });

        return response()->json(['message' => 'Meter assignment removed and the physical meter movement was recorded.']);
    }

    public function reseal(Request $request, MeterAssignment $meterAssignment): JsonResponse
    {
        $data = $request->validate([
            'seal_number' => ['required', 'string', 'max:100', Rule::unique('meter_seals', 'seal_number')],
            'sealed_at' => ['required', 'date'],
            'previous_seal_status' => ['required', Rule::in(['broken', 'removed', 'replaced'])],
            'removal_reason' => ['required', 'string', 'max:2000'],
            'seal_photo' => ['nullable', 'image', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
            'notes' => ['nullable', 'string'],
        ], [
            'seal_number.unique' => 'This seal number has already been used. Every physical seal must have a unique number.',
            'seal_photo.max' => 'The seal photograph must not exceed 5 MB.',
            'seal_photo.mimes' => 'The seal photograph must be a JPG, PNG, or WebP image.',
        ]);

        $sealPhoto = $request->file('seal_photo');
        $storedPhotoPath = null;

        try {
            $assignment = DB::transaction(function () use ($request, $meterAssignment, $data, $sealPhoto, &$storedPhotoPath): MeterAssignment {
                $assignment = MeterAssignment::query()->whereKey($meterAssignment->id)->lockForUpdate()->firstOrFail();
                abort_unless($assignment->status === 'active', 422, 'Only an active meter assignment can be resealed.');

                $this->closeCurrentSeal(
                    $assignment,
                    $data['previous_seal_status'],
                    $request->user()?->id,
                    $data['sealed_at'],
                    $data['removal_reason'],
                );

                $photoData = $this->storeSealPhoto($sealPhoto, $assignment->id);
                $storedPhotoPath = $photoData['photo_path'];
                $assignment->seals()->create(array_merge($photoData, [
                    'sealed_by' => $request->user()->id,
                    'seal_number' => $data['seal_number'],
                    'sealed_at' => $data['sealed_at'],
                    'status' => 'intact',
                    'notes' => $data['notes'] ?? null,
                ]));
                $assignment->update(['seal_number' => $data['seal_number']]);

                return $assignment;
            });
        } catch (Throwable $exception) {
            if ($storedPhotoPath) {
                Storage::disk('local')->delete($storedPhotoPath);
            }
            throw $exception;
        }

        return response()->json(['data' => $assignment->fresh()->load($this->relations())], 201);
    }

    public function downloadSealPhoto(MeterSeal $meterSeal): StreamedResponse|Response
    {
        if (! $meterSeal->photo_path || ! Storage::disk('local')->exists($meterSeal->photo_path)) {
            abort(404, 'Seal photograph not found.');
        }

        return Storage::disk('local')->download(
            $meterSeal->photo_path,
            $meterSeal->photo_original_name ?? "meter-seal-{$meterSeal->seal_number}",
            array_filter(['Content-Type' => $meterSeal->photo_mime_type]),
        );
    }

    private function resolveContract(Customer $customer, ?int $contractId): CustomerContract
    {
        $contract = CustomerContract::query()
            ->when($contractId, fn ($query) => $query->whereKey($contractId))
            ->where('customer_id', $customer->id)
            ->whereIn('status', ['installation_pending', 'active'])
            ->latest('id')
            ->lockForUpdate()
            ->first();

        if (! $contract) {
            throw ValidationException::withMessages([
                'customer_contract_id' => ['Select a confirmed contract belonging to this customer.'],
            ]);
        }

        return $contract;
    }

    private function validateAssignment(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        $rules = [
            'customer_id' => [$required, 'integer', 'exists:customers,id'],
            'customer_contract_id' => ['nullable', 'integer', 'exists:customer_contracts,id'],
            'meter_id' => [$required, 'integer', 'exists:meters,id'],
            'source_warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'initial_reading' => ['nullable', 'numeric', 'min:0'],
            'installation_date' => [$required, 'date'],
            'status' => ['nullable', Rule::in(['active', 'replaced', 'removed'])],
            'removed_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'previous_meter_disposition' => ['nullable', Rule::in(['return_to_stock', 'repair', 'scrap'])],
            'return_warehouse_id' => [
                'nullable',
                'integer',
                Rule::exists('warehouses', 'id')->where('status', 'active'),
            ],
        ];

        if (! $partial) {
            $rules = array_merge($rules, [
                'seal_number' => ['required', 'string', 'max:100', Rule::unique('meter_seals', 'seal_number')],
                'sealed_at' => ['nullable', 'date', 'after_or_equal:installation_date'],
                'seal_photo' => ['nullable', 'image', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
                'seal_notes' => ['nullable', 'string'],
            ]);
        }

        return $request->validate($rules, [
            'seal_number.required' => 'Enter the physical meter seal number before activating service.',
            'seal_number.unique' => 'This seal number has already been used. Every physical seal must have a unique number.',
            'sealed_at.after_or_equal' => 'The sealing date cannot be before the installation date.',
            'seal_photo.max' => 'The seal photograph must not exceed 5 MB.',
            'seal_photo.mimes' => 'The seal photograph must be a JPG, PNG, or WebP image.',
        ]);
    }

    private function closeCurrentSeal(
        MeterAssignment $assignment,
        string $status,
        ?int $removedBy,
        mixed $removedAt,
        string $reason,
    ): void {
        $assignment->seals()
            ->where('status', 'intact')
            ->latest('id')
            ->lockForUpdate()
            ->first()?->update([
                'status' => $status,
                'removed_by' => $removedBy,
                'removed_at' => $removedAt,
                'removal_reason' => $reason,
            ]);
    }

    private function storeSealPhoto(?UploadedFile $photo, int $assignmentId): array
    {
        if (! $photo) {
            return [
                'photo_path' => null,
                'photo_original_name' => null,
                'photo_mime_type' => null,
                'photo_size' => null,
            ];
        }

        $extension = $photo->getClientOriginalExtension();
        $storedName = Str::uuid()->toString().($extension ? ".{$extension}" : '');
        $path = $photo->storeAs("meter-seals/{$assignmentId}", $storedName, 'local');

        return [
            'photo_path' => $path,
            'photo_original_name' => $photo->getClientOriginalName(),
            'photo_mime_type' => $photo->getClientMimeType(),
            'photo_size' => $photo->getSize(),
        ];
    }

    private function relations(): array
    {
        return [
            'customer:id,name,house_number,status,agreement_status',
            'contract:id,customer_id,contract_number,status,net_amount,remaining_amount',
            'meter:id,good_id,inventory_item_id,source_warehouse_id,current_warehouse_id,meter_number,status,purchase_cost,source_type',
            'meter.good:id,name,code',
            'meter.supplier:id,name',
            'meter.sourceWarehouse:id,name,code',
            'meter.currentWarehouse:id,name,code',
            'installer:id,name',
            'sourceWarehouse:id,name,code',
            'returnWarehouse:id,name,code',
            'seals.sealer:id,name',
            'seals.remover:id,name',
        ];
    }
}
