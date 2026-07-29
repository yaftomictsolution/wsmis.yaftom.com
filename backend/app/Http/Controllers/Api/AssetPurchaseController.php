<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\Asset;
use App\Models\AssetPurchase;
use App\Models\FinancialCategory;
use App\Services\AccountingWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AssetPurchaseController extends Controller
{
    public function __construct(private readonly AccountingWorkflowService $accounting) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeFinance($request);

        $purchases = AssetPurchase::query()
            ->with($this->relations())
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = trim($request->string('search')->toString());
                $query->where(function ($builder) use ($search): void {
                    $builder->where('purchase_number', 'like', "%{$search}%")
                        ->orWhere('asset_code_prefix', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%");
                });
            })
            ->latest('purchase_date')
            ->latest('id')
            ->paginate(20);

        return response()->json($purchases);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeFinance($request);
        $data = $this->validatePurchase($request);
        $total = round((int) $data['quantity'] * (float) $data['unit_cost'], 2);

        $this->validateFinancialSelection($data, $total);
        $this->ensureAssetCodesAvailable($data['asset_code_prefix'], (int) $data['quantity']);

        $storedPath = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $storedPath = $file->store('asset-purchases', 'public');
            $data['attachment_path'] = $storedPath;
            $data['attachment_original_name'] = $file->getClientOriginalName();
        }
        unset($data['attachment']);

        try {
            $purchase = DB::transaction(function () use ($data, $total, $request): AssetPurchase {
                $purchase = AssetPurchase::query()->create($data + [
                    'purchase_number' => AssetPurchase::nextNumber(),
                    'total_amount' => $total,
                    'created_by' => $request->user()?->id,
                    'status' => 'pending_review',
                ]);

                $category = FinancialCategory::query()->findOrFail($data['financial_category_id']);
                $supplierName = $purchase->supplier()->value('name');
                $transaction = AccountingTransaction::query()->create([
                    'financial_category_id' => $category->id,
                    'payment_method_id' => $data['payment_method_id'],
                    'accounting_account_id' => $data['accounting_account_id'],
                    'supplier_id' => $data['supplier_id'] ?? null,
                    'recorded_by' => $request->user()?->id,
                    'transaction_number' => AccountingTransaction::nextNumber('expense'),
                    'type' => 'expense',
                    'title' => 'Asset Purchase - '.$purchase->purchase_number,
                    'amount' => $total,
                    'paid_to' => $supplierName,
                    'transaction_date' => $data['purchase_date'],
                    'receipt_number' => $data['invoice_number'] ?? null,
                    'reference' => $purchase->purchase_number,
                    'source_type' => 'asset_purchase',
                    'source_id' => $purchase->id,
                    'status' => 'pending_review',
                    'attachment_path' => $data['attachment_path'] ?? null,
                    'attachment_original_name' => $data['attachment_original_name'] ?? null,
                    'description' => $data['notes'] ?? null,
                ]);
                $purchase->update(['accounting_transaction_id' => $transaction->id]);

                return $purchase;
            });
        } catch (\Throwable $exception) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw $exception;
        }

        return response()->json([
            'message' => 'Asset purchase sent for financial review.',
            'data' => $purchase->fresh()->load($this->relations()),
        ], 201);
    }

    public function show(Request $request, AssetPurchase $assetPurchase): JsonResponse
    {
        $this->authorizeFinance($request);

        return response()->json(['data' => $assetPurchase->load($this->relations())]);
    }

    public function update(Request $request, AssetPurchase $assetPurchase): JsonResponse
    {
        $this->authorizeFinance($request);
        abort_unless(
            in_array($assetPurchase->status, ['pending_review', 'rejected'], true),
            422,
            'Only purchases awaiting review or rejected purchases can be edited.',
        );

        $data = $this->validatePurchase($request);
        $total = round((int) $data['quantity'] * (float) $data['unit_cost'], 2);
        $this->validateFinancialSelection($data, $total);
        $this->ensureAssetCodesAvailable($data['asset_code_prefix'], (int) $data['quantity']);

        $oldPath = $assetPurchase->attachment_path;
        $newPath = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $newPath = $file->store('asset-purchases', 'public');
            $data['attachment_path'] = $newPath;
            $data['attachment_original_name'] = $file->getClientOriginalName();
        }
        unset($data['attachment']);

        try {
            DB::transaction(function () use ($assetPurchase, $data, $total, $request): void {
                $transaction = AccountingTransaction::query()
                    ->whereKey($assetPurchase->accounting_transaction_id)
                    ->lockForUpdate()
                    ->firstOrFail();
                abort_if($transaction->posted_at, 422, 'A posted asset purchase cannot be edited.');

                $assetPurchase->update($data + [
                    'total_amount' => $total,
                    'status' => 'pending_review',
                ]);
                $supplierName = $assetPurchase->supplier()->value('name');
                $transaction->update([
                    'financial_category_id' => $data['financial_category_id'],
                    'payment_method_id' => $data['payment_method_id'],
                    'accounting_account_id' => $data['accounting_account_id'],
                    'supplier_id' => $data['supplier_id'] ?? null,
                    'recorded_by' => $request->user()?->id,
                    'title' => 'Asset Purchase - '.$assetPurchase->purchase_number,
                    'amount' => $total,
                    'paid_to' => $supplierName,
                    'transaction_date' => $data['purchase_date'],
                    'receipt_number' => $data['invoice_number'] ?? null,
                    'status' => 'pending_review',
                    'reviewed_by' => null,
                    'approved_by' => null,
                    'rejected_by' => null,
                    'reviewed_at' => null,
                    'approved_at' => null,
                    'rejected_at' => null,
                    'rejection_reason' => null,
                    'attachment_path' => $data['attachment_path'] ?? $transaction->attachment_path,
                    'attachment_original_name' => $data['attachment_original_name'] ?? $transaction->attachment_original_name,
                    'description' => $data['notes'] ?? null,
                ]);
            });
        } catch (\Throwable $exception) {
            if ($newPath) {
                Storage::disk('public')->delete($newPath);
            }
            throw $exception;
        }

        if ($newPath && $oldPath && $oldPath !== $newPath) {
            Storage::disk('public')->delete($oldPath);
        }

        return response()->json([
            'message' => 'Asset purchase updated and returned for review.',
            'data' => $assetPurchase->fresh()->load($this->relations()),
        ]);
    }

    public function destroy(Request $request, AssetPurchase $assetPurchase): JsonResponse
    {
        $this->authorizeFinance($request);
        abort_unless(
            in_array($assetPurchase->status, ['pending_review', 'rejected'], true),
            422,
            'Approved or reviewed purchases cannot be deleted. Reverse the linked expense instead.',
        );
        abort_if($assetPurchase->assets()->exists(), 422, 'A purchase that generated assets cannot be deleted.');

        $attachment = $assetPurchase->attachment_path;
        DB::transaction(function () use ($assetPurchase): void {
            $transaction = AccountingTransaction::query()->find($assetPurchase->accounting_transaction_id);
            abort_if($transaction?->posted_at, 422, 'A posted asset purchase cannot be deleted.');
            $assetPurchase->delete();
            $transaction?->delete();
        });

        if ($attachment) {
            Storage::disk('public')->delete($attachment);
        }

        return response()->json(['message' => 'Asset purchase deleted.']);
    }

    public function downloadAttachment(Request $request, AssetPurchase $assetPurchase)
    {
        $this->authorizeFinance($request);
        abort_unless(
            $assetPurchase->attachment_path && Storage::disk('public')->exists($assetPurchase->attachment_path),
            404,
            'Attachment not found.',
        );

        return Storage::disk('public')->download(
            $assetPurchase->attachment_path,
            $assetPurchase->attachment_original_name ?: basename($assetPurchase->attachment_path),
        );
    }

    private function validatePurchase(Request $request): array
    {
        return $request->validate([
            'asset_code_prefix' => ['required', 'string', 'max:100', 'regex:/^[A-Za-z0-9_-]+$/'],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['well', 'reservoir', 'generator', 'solar', 'technical'])],
            'quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'unit_cost' => ['required', 'numeric', 'gt:0'],
            'supplier_id' => [
                'nullable',
                'integer',
                Rule::exists('suppliers', 'id')->where('status', 'active'),
            ],
            'service_area_id' => ['nullable', 'integer', 'exists:service_areas,id'],
            'financial_category_id' => [
                'required',
                'integer',
                Rule::exists('financial_categories', 'id')->where(
                    fn ($query) => $query->where('type', 'expense')->where('status', 'active'),
                ),
            ],
            'payment_method_id' => [
                'required',
                'integer',
                Rule::exists('payment_methods', 'id')->where('status', 'active'),
            ],
            'accounting_account_id' => [
                'required',
                'integer',
                Rule::exists('accounting_accounts', 'id')->where('status', 'active'),
            ],
            'asset_status' => ['nullable', Rule::in(['active', 'inactive'])],
            'purchase_date' => ['required', 'date', 'before_or_equal:today'],
            'warranty_expiry' => ['nullable', 'date', 'after_or_equal:purchase_date'],
            'invoice_number' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:2000'],
            'attributes' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:10240'],
        ]);
    }

    private function validateFinancialSelection(array $data, float $total): void
    {
        $this->accounting->ensureDateIsOpen($data['purchase_date']);
        $account = $this->accounting->ensureCompatibleAccount(
            (int) $data['payment_method_id'],
            (int) $data['accounting_account_id'],
        );

        if ((float) $account->current_balance + 0.005 < $total) {
            throw ValidationException::withMessages([
                'accounting_account_id' => ['The selected account does not have enough available balance for this purchase.'],
            ]);
        }
    }

    private function ensureAssetCodesAvailable(string $prefix, int $quantity): void
    {
        $codes = $quantity === 1
            ? [$prefix]
            : collect(range(1, $quantity))
                ->map(fn (int $number): string => $prefix.'-'.str_pad((string) $number, 3, '0', STR_PAD_LEFT))
                ->all();
        $existing = Asset::query()->whereIn('asset_code', $codes)->pluck('asset_code');

        if ($existing->isNotEmpty()) {
            throw ValidationException::withMessages([
                'asset_code_prefix' => ['The generated asset code already exists: '.$existing->first()],
            ]);
        }
    }

    private function authorizeFinance(Request $request): void
    {
        abort_unless(
            $request->user()?->hasAnyRole(['Accountant', 'Manager', 'Admin', 'Super Admin']),
            403,
            'You cannot manage asset purchases.',
        );
    }

    private function relations(): array
    {
        return [
            'supplier:id,name,supplier_type',
            'serviceArea:id,name',
            'category:id,name,code,type',
            'paymentMethod:id,name,code',
            'account:id,name,code,type,current_balance,status',
            'transaction:id,transaction_number,status,reviewed_by,approved_by,rejected_by,rejection_reason,posted_at,reversed_at',
            'creator:id,name',
            'assets:id,asset_purchase_id,asset_code,name,status',
        ];
    }
}
