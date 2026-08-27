<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\FinancialPeriodClosing;
use App\Services\FinancialReportingService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinancialPeriodClosingController extends Controller
{
    public function __construct(private readonly FinancialReportingService $reports) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizePrepare($request);
        $closings = FinancialPeriodClosing::with($this->relations())
            ->latest('period_end')
            ->get()
            ->each(fn (FinancialPeriodClosing $closing) => $this->attachReadiness($closing));

        return response()->json(['data' => $closings]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePrepare($request);
        $data = $request->validate([
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'notes' => ['nullable', 'string'],
        ]);
        [$start, $end, $code] = $this->validateMonth($data['period_start'], $data['period_end']);
        $this->ensurePeriodEnded($end);
        abort_if(FinancialPeriodClosing::query()->where('period_code', $code)->exists(), 422, 'This month already has a closing record.');

        $snapshot = $this->reports->periodSnapshot($start, $end);
        $closing = FinancialPeriodClosing::query()->create($this->snapshotPayload($snapshot) + [
            'prepared_by' => $request->user()->id,
            'period_code' => $code,
            'period_start' => $start,
            'period_end' => $end,
            'status' => 'draft',
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json(['data' => $closing->load($this->relations())], 201);
    }

    public function refresh(Request $request, FinancialPeriodClosing $financialPeriodClosing): JsonResponse
    {
        $this->authorizePrepare($request);
        abort_unless(in_array($financialPeriodClosing->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected periods can be refreshed.');
        $this->refreshSnapshot($financialPeriodClosing);

        return response()->json(['data' => $financialPeriodClosing->fresh()->load($this->relations())]);
    }

    public function destroy(Request $request, FinancialPeriodClosing $financialPeriodClosing): JsonResponse
    {
        $this->authorizePrepare($request);
        abort_unless(in_array($financialPeriodClosing->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected closing records can be deleted.');
        abort_if($financialPeriodClosing->distribution()->exists(), 422, 'A closing linked to a profit distribution cannot be deleted.');
        $financialPeriodClosing->delete();

        return response()->json(['message' => 'Financial closing draft deleted.']);
    }

    public function submit(Request $request, FinancialPeriodClosing $financialPeriodClosing): JsonResponse
    {
        $this->authorizePrepare($request);
        abort_unless(in_array($financialPeriodClosing->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected periods can be submitted.');
        $this->refreshSnapshot($financialPeriodClosing);
        $this->ensureReadyToClose($financialPeriodClosing->fresh());
        $financialPeriodClosing->update([
            'status' => 'pending_review',
            'submitted_at' => now(),
            'rejected_by' => null,
            'rejected_at' => null,
            'rejection_reason' => null,
        ]);

        return response()->json(['data' => $financialPeriodClosing->fresh()->load($this->relations())]);
    }

    public function review(Request $request, FinancialPeriodClosing $financialPeriodClosing): JsonResponse
    {
        $this->authorizeReview($request);
        abort_unless($financialPeriodClosing->status === 'pending_review', 422, 'Only periods awaiting review can be reviewed.');
        $this->ensureReadyToClose($financialPeriodClosing);
        $financialPeriodClosing->update(['status' => 'pending_approval', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);

        return response()->json(['data' => $financialPeriodClosing->fresh()->load($this->relations())]);
    }

    public function close(Request $request, FinancialPeriodClosing $financialPeriodClosing): JsonResponse
    {
        $this->authorizeApprove($request);
        abort_unless(in_array($financialPeriodClosing->status, ['pending_review', 'pending_approval'], true), 422, 'Only pending periods can be closed.');

        DB::transaction(function () use ($request, $financialPeriodClosing): void {
            $this->refreshSnapshot($financialPeriodClosing);
            $this->ensureReadyToClose($financialPeriodClosing->fresh());
            $updates = [
                'status' => 'closed',
                'closed_by' => $request->user()->id,
                'closed_at' => now(),
            ];
            if (! $financialPeriodClosing->reviewed_by) {
                $updates += ['reviewed_by' => $request->user()->id, 'reviewed_at' => now()];
            }
            $financialPeriodClosing->update($updates);
        });

        return response()->json(['data' => $financialPeriodClosing->fresh()->load($this->relations())]);
    }

    public function reject(Request $request, FinancialPeriodClosing $financialPeriodClosing): JsonResponse
    {
        $this->authorizeApprove($request);
        abort_unless(in_array($financialPeriodClosing->status, ['pending_review', 'pending_approval'], true), 422, 'Only pending periods can be rejected.');
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:1000']]);
        $financialPeriodClosing->update(['status' => 'rejected', 'rejected_by' => $request->user()->id, 'rejected_at' => now(), 'rejection_reason' => $data['rejection_reason']]);

        return response()->json(['data' => $financialPeriodClosing->fresh()->load($this->relations())]);
    }

    public function reopen(Request $request, FinancialPeriodClosing $financialPeriodClosing): JsonResponse
    {
        $this->authorizeApprove($request);
        abort_unless($financialPeriodClosing->status === 'closed', 422, 'Only a closed period can be reopened.');
        abort_if($financialPeriodClosing->distribution()->exists(), 422, 'Remove or reverse the shareholder distribution before reopening this period.');
        $data = $request->validate(['reopen_reason' => ['required', 'string', 'max:1000']]);
        $financialPeriodClosing->update([
            'status' => 'draft',
            'reopened_by' => $request->user()->id,
            'reopened_at' => now(),
            'reopen_reason' => $data['reopen_reason'],
            'closed_by' => null,
            'closed_at' => null,
        ]);

        return response()->json(['data' => $financialPeriodClosing->fresh()->load($this->relations())]);
    }

    private function refreshSnapshot(FinancialPeriodClosing $closing): void
    {
        $snapshot = $this->reports->periodSnapshot($closing->period_start->toDateString(), $closing->period_end->toDateString());
        $closing->update($this->snapshotPayload($snapshot));
    }

    private function snapshotPayload(array $snapshot): array
    {
        return [
            'total_income' => $snapshot['total_income'],
            'total_expense' => $snapshot['total_expense'],
            'payroll_expense' => $snapshot['payroll_expense'],
            'net_income' => $snapshot['net_income'],
            'receivables' => $snapshot['receivables'],
            'supplier_payables' => $snapshot['supplier_payables'],
            'cash_balance' => $snapshot['cash_balance'],
            'bank_balance' => $snapshot['bank_balance'],
            'distributable_profit' => max(0, (float) $snapshot['net_income']),
            'reconciliation_complete' => $snapshot['reconciliation_complete'],
            'report_snapshot' => $snapshot,
        ];
    }

    private function ensureReadyToClose(FinancialPeriodClosing $closing): void
    {
        $this->ensurePeriodEnded($closing->period_end->toDateString());
        $readiness = $this->closingReadiness($closing);
        if ($readiness['pending_transactions'] > 0) {
            throw ValidationException::withMessages(['transactions' => ["Resolve {$readiness['pending_transactions']} pending financial transaction(s) before closing {$closing->period_code}."]]);
        }
        if (! $readiness['reconciliation']['complete']) {
            $statusLabels = [
                'missing' => 'not created',
                'draft' => 'draft',
                'pending_review' => 'awaiting review',
                'pending_approval' => 'awaiting admin approval',
                'rejected' => 'rejected',
            ];
            $blockers = collect($readiness['reconciliation']['accounts'])
                ->reject(fn (array $account): bool => $account['status'] === 'approved')
                ->map(fn (array $account): string => $account['name'].' ('.($statusLabels[$account['status']] ?? $account['status']).')')
                ->join(', ');

            throw ValidationException::withMessages([
                'reconciliation' => ["Reconciliation is required for {$closing->period_code}: {$blockers}. Create, submit, and approve each record with period end {$closing->period_end->toDateString()} in Cash & Bank Reconciliation."],
            ]);
        }
    }

    private function attachReadiness(FinancialPeriodClosing $closing): FinancialPeriodClosing
    {
        $readiness = $this->closingReadiness($closing);
        $closing->setAttribute('reconciliation_complete', $readiness['reconciliation']['complete']);
        $closing->setAttribute('readiness', $readiness);

        return $closing;
    }

    private function closingReadiness(FinancialPeriodClosing $closing): array
    {
        $start = $closing->period_start->toDateString();
        $end = $closing->period_end->toDateString();
        $pending = AccountingTransaction::query()
            ->whereDate('transaction_date', '>=', $start)
            ->whereDate('transaction_date', '<=', $end)
            ->whereIn('status', ['pending_review', 'pending_approval'])
            ->count();
        $reconciliation = $this->reports->reconciliationReadiness($end);
        $periodEnded = Carbon::parse($end)->isBefore(Carbon::today());

        return [
            'period_ended' => $periodEnded,
            'available_after' => Carbon::parse($end)->addDay()->toDateString(),
            'pending_transactions' => $pending,
            'reconciliation' => $reconciliation,
            'can_close' => $periodEnded && $pending === 0 && $reconciliation['complete'],
        ];
    }

    private function ensurePeriodEnded(string $end): void
    {
        $periodEnd = Carbon::parse($end);
        if ($periodEnd->isBefore(Carbon::today())) {
            return;
        }

        $latestCompletedMonth = Carbon::today()->startOfMonth()->subMonth()->format('F Y');
        throw ValidationException::withMessages([
            'period_end' => ["{$periodEnd->format('F Y')} is still open. It can be closed after {$periodEnd->format('F j, Y')}. The latest completed month is {$latestCompletedMonth}."],
        ]);
    }

    private function validateMonth(string $start, string $end): array
    {
        $startDate = Carbon::parse($start);
        $endDate = Carbon::parse($end);
        if (! $startDate->isSameMonth($endDate) || ! $startDate->isStartOfMonth() || ! $endDate->isEndOfMonth()) {
            throw ValidationException::withMessages(['period_end' => ['Monthly closing must start on the first day and end on the last day of the same month.']]);
        }

        return [$startDate->toDateString(), $endDate->toDateString(), $startDate->format('Y-m')];
    }

    private function relations(): array
    {
        return ['preparer:id,name', 'reviewer:id,name', 'closer:id,name', 'rejector:id,name', 'reopener:id,name', 'distribution:id,financial_period_closing_id,distribution_number,status,distributable_amount,paid_amount'];
    }

    private function authorizePrepare(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Accountant', 'Manager', 'Admin', 'Super Admin']), 403, 'You cannot prepare financial closing.');
    }

    private function authorizeReview(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Manager', 'Admin', 'Super Admin']), 403, 'Only managers or admins can review closing.');
    }

    private function authorizeApprove(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can close or reopen financial periods.');
    }
}
