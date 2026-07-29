<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountReconciliation;
use App\Models\AccountingAccount;
use App\Services\AccountingWorkflowService;
use App\Services\FinancialReportingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AccountReconciliationController extends Controller
{
    public function __construct(
        private readonly FinancialReportingService $reports,
        private readonly AccountingWorkflowService $workflow,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeCreate($request);
        return response()->json(['data' => AccountReconciliation::with($this->relations())->latest('period_end')->latest()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeCreate($request);
        $data = $this->validateReconciliation($request);
        $reconciliation = DB::transaction(fn (): AccountReconciliation => $this->persist(new AccountReconciliation(), $data, $request->user()->id));

        return response()->json(['data' => $reconciliation->load($this->relations())], 201);
    }

    public function update(Request $request, AccountReconciliation $accountReconciliation): JsonResponse
    {
        $this->authorizeCreate($request);
        abort_unless(in_array($accountReconciliation->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected reconciliations can be edited.');
        $data = $this->validateReconciliation($request, $accountReconciliation->id);
        $reconciliation = DB::transaction(fn (): AccountReconciliation => $this->persist($accountReconciliation, $data, $request->user()->id));

        return response()->json(['data' => $reconciliation->load($this->relations())]);
    }

    public function destroy(Request $request, AccountReconciliation $accountReconciliation): JsonResponse
    {
        $this->authorizeCreate($request);
        abort_unless(in_array($accountReconciliation->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected reconciliations can be deleted.');
        $accountReconciliation->delete();

        return response()->json(['message' => 'Reconciliation deleted.']);
    }

    public function submit(Request $request, AccountReconciliation $accountReconciliation): JsonResponse
    {
        $this->authorizeCreate($request);
        abort_unless(in_array($accountReconciliation->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected reconciliations can be submitted.');
        $this->workflow->ensureDateIsOpen($accountReconciliation->period_end->toDateString());
        $this->ensureBalanced($accountReconciliation);
        $accountReconciliation->update(['status' => 'pending_review', 'submitted_at' => now(), 'rejected_by' => null, 'rejected_at' => null, 'rejection_reason' => null]);

        return response()->json(['data' => $accountReconciliation->fresh()->load($this->relations())]);
    }

    public function review(Request $request, AccountReconciliation $accountReconciliation): JsonResponse
    {
        $this->authorizeReview($request);
        abort_unless($accountReconciliation->status === 'pending_review', 422, 'Only reconciliations awaiting review can be reviewed.');
        $this->ensureBalanced($accountReconciliation);
        $accountReconciliation->update(['status' => 'pending_approval', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);

        return response()->json(['data' => $accountReconciliation->fresh()->load($this->relations())]);
    }

    public function approve(Request $request, AccountReconciliation $accountReconciliation): JsonResponse
    {
        $this->authorizeApprove($request);
        abort_unless(in_array($accountReconciliation->status, ['pending_review', 'pending_approval'], true), 422, 'Only pending reconciliations can be approved.');
        $this->ensureBalanced($accountReconciliation);
        $updates = ['status' => 'approved', 'approved_by' => $request->user()->id, 'approved_at' => now()];
        if (!$accountReconciliation->reviewed_by) {
            $updates += ['reviewed_by' => $request->user()->id, 'reviewed_at' => now()];
        }
        $accountReconciliation->update($updates);

        return response()->json(['data' => $accountReconciliation->fresh()->load($this->relations())]);
    }

    public function reject(Request $request, AccountReconciliation $accountReconciliation): JsonResponse
    {
        $this->authorizeApprove($request);
        abort_unless(in_array($accountReconciliation->status, ['pending_review', 'pending_approval'], true), 422, 'Only pending reconciliations can be rejected.');
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:1000']]);
        $accountReconciliation->update(['status' => 'rejected', 'rejected_by' => $request->user()->id, 'rejected_at' => now(), 'rejection_reason' => $data['rejection_reason']]);

        return response()->json(['data' => $accountReconciliation->fresh()->load($this->relations())]);
    }

    private function persist(AccountReconciliation $reconciliation, array $data, int $userId): AccountReconciliation
    {
        $account = AccountingAccount::query()->findOrFail($data['accounting_account_id']);
        $book = $this->reports->bookBalance($account, $data['period_end']);
        $adjustment = collect($data['items'] ?? [])->sum(fn (array $item): float => ($item['direction'] === 'add' ? 1 : -1) * (float) $item['amount']);
        $adjusted = round((float) $data['statement_balance'] + $adjustment, 2);

        $payload = collect($data)->except('items')->all() + [
            'book_balance' => $book,
            'adjusted_statement_balance' => $adjusted,
            'difference' => round($book - $adjusted, 2),
            'status' => 'draft',
            'rejection_reason' => null,
        ];
        if (!$reconciliation->exists) {
            $payload += ['reconciliation_number' => AccountReconciliation::nextNumber(), 'created_by' => $userId];
        }
        $reconciliation->fill($payload)->save();
        $reconciliation->items()->delete();
        foreach ($data['items'] ?? [] as $item) {
            $reconciliation->items()->create($item);
        }

        return $reconciliation->fresh();
    }

    private function validateReconciliation(Request $request, ?int $exceptId = null): array
    {
        return $request->validate([
            'accounting_account_id' => ['required', 'integer', 'exists:accounting_accounts,id'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start', function ($attribute, $value, $fail) use ($request, $exceptId): void {
                $exists = AccountReconciliation::query()->where('accounting_account_id', $request->input('accounting_account_id'))->whereDate('period_end', $value)->when($exceptId, fn ($query) => $query->whereKeyNot($exceptId))->exists();
                if ($exists) {
                    $fail('This account already has a reconciliation for the selected period end.');
                }
            }],
            'statement_balance' => ['required', 'numeric'],
            'notes' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.kind' => ['required', 'string', 'max:100'],
            'items.*.direction' => ['required', 'in:add,subtract'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.reference' => ['nullable', 'string', 'max:255'],
            'items.*.amount' => ['required', 'numeric', 'gt:0'],
            'items.*.cleared' => ['nullable', 'boolean'],
        ]);
    }

    private function ensureBalanced(AccountReconciliation $reconciliation): void
    {
        if (abs((float) $reconciliation->difference) > 0.01) {
            throw ValidationException::withMessages(['difference' => ['Reconciliation difference must be zero before submission or approval.']]);
        }
    }

    private function relations(): array
    {
        return ['account:id,name,code,type,current_balance', 'items', 'creator:id,name', 'reviewer:id,name', 'approver:id,name', 'rejector:id,name'];
    }

    private function authorizeCreate(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Accountant', 'Manager', 'Admin', 'Super Admin']), 403, 'You cannot manage reconciliations.');
    }

    private function authorizeReview(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Manager', 'Admin', 'Super Admin']), 403, 'Only managers or admins can review reconciliations.');
    }

    private function authorizeApprove(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can approve reconciliations.');
    }
}
