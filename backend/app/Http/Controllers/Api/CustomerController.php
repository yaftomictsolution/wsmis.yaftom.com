<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingAccount;
use App\Models\Customer;
use App\Models\PaymentMethod;
use App\Services\CustomerContractWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CustomerController extends Controller
{
    public function __construct(private readonly CustomerContractWorkflowService $contracts) {}

    public function collectionOptions(): JsonResponse
    {
        return response()->json(['data' => [
            'payment_methods' => PaymentMethod::query()->where('status', 'active')->orderBy('name')->get(['id', 'name', 'code', 'status']),
            'accounts' => AccountingAccount::query()->where('status', 'active')->orderBy('type')->orderBy('name')->get(['id', 'name', 'code', 'type', 'current_balance', 'status']),
        ]]);
    }

    public function index(): JsonResponse
    {
        return response()->json(['data' => Customer::query()
            ->with([
                'serviceArea:id,name',
                'meterAssignments.meter:id,meter_number,status',
                'meterAssignments.seals.sealer:id,name',
                'meterAssignments.seals.remover:id,name',
                'latestContract.submitter:id,name',
                'latestContract.confirmer:id,name',
                'latestContract.approver:id,name',
                'latestContract.rejector:id,name',
                'latestContract.deposits.paymentMethod:id,name,code',
                'latestContract.deposits.account:id,name,code,type,current_balance',
            ])
            ->withCount('documentFiles')
            ->latest('id')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateCustomer($request);
        $customer = Customer::query()->create(array_merge($data, [
            'status' => 'registered',
            'opening_balance' => 0,
            'current_balance' => 0,
            'connection_fee' => 0,
            'meter_fee' => 0,
            'agreement_discount_amount' => 0,
            'agreement_paid_amount' => 0,
            'agreement_remaining_amount' => 0,
            'agreement_status' => 'draft',
        ]));
        $this->ensureSubscriptionCode($customer);

        return response()->json(['data' => $this->customerResponse($customer)], 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        return response()->json(['data' => $this->customerResponse($customer)]);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $customer->update($this->validateCustomer($request, true));
        $this->ensureSubscriptionCode($customer);

        return response()->json(['data' => $this->customerResponse($customer->fresh())]);
    }

    public function markAgreementPrinted(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizeAgreementManagement($request);
        $contract = $customer->latestContract()->firstOrFail();
        $this->contracts->markPrinted($contract);

        return response()->json(['data' => $this->customerResponse($customer->fresh())]);
    }

    public function destroy(Customer $customer): JsonResponse
    {
        abort_if($customer->contracts()->exists(), 422, 'A customer with contract history cannot be deleted. Set the customer inactive instead.');

        $customer->documentFiles()->each(function ($document): void {
            Storage::disk('local')->delete($document->path);
        });
        $customer->delete();

        return response()->json(['message' => 'Customer deleted.']);
    }

    private function validateCustomer(Request $request, bool $partial = false): array
    {
        $this->normalizeCustomerInput($request);
        $required = $partial ? 'sometimes' : 'required';
        $customer = $request->route('customer');
        $customerId = $customer instanceof Customer ? $customer->id : null;

        $data = $request->validate([
            'service_area_id' => [$required, 'integer', 'exists:service_areas,id'],
            'subscription_code' => ['nullable', 'string', 'max:100', Rule::unique('customers', 'subscription_code')->ignore($customerId)],
            'name' => [$required, 'string', 'min:2', 'max:255'],
            'last_name' => ['nullable', 'string', 'min:2', 'max:255'],
            'father_name' => [$required, 'string', 'min:2', 'max:255'],
            'grandfather_name' => ['nullable', 'string', 'max:255'],
            'phone' => [$required, 'string', 'regex:/^\+?[0-9]{8,15}$/', Rule::unique('customers', 'phone')->ignore($customerId)],
            'secondary_phone' => ['nullable', 'string', 'regex:/^\+?[0-9]{8,15}$/', 'different:phone', 'max:50'],
            'tazkira_number' => ['nullable', 'string', 'max:100', Rule::unique('customers', 'tazkira_number')->ignore($customerId)],
            'house_number' => [$required, 'string', 'max:100'],
            'nearest_house_number' => ['nullable', 'string', 'max:100'],
            'street_number' => ['nullable', 'string', 'max:100'],
            'original_residence' => ['nullable', 'string', 'max:255'],
            'current_residence' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in(['registered', 'awaiting_approval', 'awaiting_installation', 'active', 'inactive', 'suspended', 'disconnected'])],
            'notes' => ['nullable', 'string'],
        ], [
            'name.required' => 'Enter the customer first name.',
            'last_name.min' => 'The customer last name must contain at least 2 characters.',
            'father_name.required' => 'Enter the customer father name.',
            'phone.required' => 'Enter the customer primary phone number.',
            'phone.regex' => 'Enter a valid phone number using 8 to 15 digits.',
            'phone.unique' => 'This phone number is already registered to another customer.',
            'secondary_phone.regex' => 'Enter a valid secondary phone number using 8 to 15 digits.',
            'secondary_phone.different' => 'The secondary phone number must be different from the primary phone number.',
            'tazkira_number.unique' => 'This Tazkira number is already registered to another customer.',
            'house_number.required' => 'Enter the customer house number.',
            'service_area_id.required' => 'Select the customer service area.',
        ]);

        $identity = array_merge($customer instanceof Customer ? $customer->only([
            'service_area_id',
            'name',
            'last_name',
            'father_name',
            'house_number',
        ]) : [], $data);

        if (! empty($identity['service_area_id']) && ! empty($identity['name']) && ! empty($identity['father_name']) && ! empty($identity['house_number'])) {
            $duplicateExists = Customer::query()
                ->when($customerId, fn ($query) => $query->whereKeyNot($customerId))
                ->where('service_area_id', $identity['service_area_id'])
                ->where('name', $identity['name'])
                ->where(function ($query) use ($identity): void {
                    $lastName = $identity['last_name'] ?? null;
                    $lastName === null
                        ? $query->whereNull('last_name')
                        : $query->where('last_name', $lastName);
                })
                ->where('father_name', $identity['father_name'])
                ->where('house_number', $identity['house_number'])
                ->exists();

            if ($duplicateExists) {
                throw ValidationException::withMessages([
                    'name' => 'A customer with the same first name, last name, father name, service area, and house number already exists.',
                ]);
            }
        }

        return $data;
    }

    private function normalizeCustomerInput(Request $request): void
    {
        $normalized = [];

        foreach (['subscription_code', 'name', 'last_name', 'father_name', 'grandfather_name', 'house_number', 'nearest_house_number', 'street_number', 'original_residence', 'current_residence'] as $field) {
            if (! $request->exists($field)) {
                continue;
            }

            $value = preg_replace('/\s+/u', ' ', trim((string) $request->input($field)));
            $normalized[$field] = $value === '' ? null : $value;
        }

        foreach (['phone', 'secondary_phone'] as $field) {
            if (! $request->exists($field)) {
                continue;
            }

            $normalized[$field] = $this->normalizePhone($request->input($field));
        }

        if ($request->exists('tazkira_number')) {
            $value = strtoupper(preg_replace('/\s+/u', '', trim((string) $request->input('tazkira_number'))));
            $normalized['tazkira_number'] = $value === '' ? null : $value;
        }

        $request->merge($normalized);
    }

    private function normalizePhone(mixed $value): ?string
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $raw);
        if (str_starts_with($digits, '0093')) {
            return '+'.substr($digits, 2);
        }
        if (str_starts_with($digits, '93') && strlen($digits) === 11) {
            return '+'.$digits;
        }
        if (str_starts_with($digits, '0') && strlen($digits) === 10) {
            return '+93'.substr($digits, 1);
        }
        if (strlen($digits) === 9) {
            return '+93'.$digits;
        }

        return str_starts_with($raw, '+') ? '+'.$digits : $digits;
    }

    private function customerResponse(Customer $customer): Customer
    {
        return $customer->load([
            'serviceArea:id,name',
            'meterAssignments.meter:id,meter_number,status',
            'meterAssignments.installer:id,name',
            'meterAssignments.seals.sealer:id,name',
            'meterAssignments.seals.remover:id,name',
            'documentFiles.uploader:id,name',
            'contracts' => fn ($query) => $query->latest('id'),
            'contracts.creator:id,name',
            'contracts.updater:id,name',
            'contracts.submitter:id,name',
            'contracts.confirmer:id,name',
            'contracts.approver:id,name',
            'contracts.rejector:id,name',
            'contracts.deposits.paymentMethod:id,name,code',
            'contracts.deposits.account:id,name,code,type,current_balance',
            'contracts.deposits.receiver:id,name',
            'contracts.deposits.applier:id,name',
            'contracts.deposits.refunder:id,name',
            'latestContract.submitter:id,name',
            'latestContract.confirmer:id,name',
            'latestContract.approver:id,name',
            'latestContract.rejector:id,name',
            'latestContract.deposits.paymentMethod:id,name,code',
            'latestContract.deposits.account:id,name,code,type,current_balance',
            'latestContract.deposits.receiver:id,name',
        ])->loadCount('documentFiles');
    }

    private function authorizeAgreementManagement(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user?->hasAnyRole(['Manager', 'Admin', 'Super Admin'])
                || $user?->can('customer-contracts.update'),
            403,
            'You do not have permission to manage customer contracts.',
        );
    }

    private function ensureSubscriptionCode(Customer $customer): void
    {
        if ($customer->subscription_code) {
            return;
        }

        $baseCode = 'CUS-'.str_pad((string) $customer->id, 6, '0', STR_PAD_LEFT);
        $code = $baseCode;
        $suffix = 1;
        while (Customer::query()->where('subscription_code', $code)->whereKeyNot($customer->id)->exists()) {
            $code = "{$baseCode}-{$suffix}";
            $suffix++;
        }
        $customer->forceFill(['subscription_code' => $code])->save();
    }
}
