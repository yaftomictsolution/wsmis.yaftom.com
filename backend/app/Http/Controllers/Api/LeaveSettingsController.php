<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\LeavePolicy;
use App\Services\LeaveBalanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaveSettingsController extends Controller
{
    public function __construct(private readonly LeaveBalanceService $balances) {}

    public function show(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json(['data' => $this->settings()]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'annual_leave_days' => ['required', 'numeric', 'between:0,365'],
            'carry_forward_days' => ['required', 'numeric', 'between:0,365', 'lte:annual_leave_days'],
            'sick_leave_days' => ['required', 'numeric', 'between:0,365'],
            'emergency_leave_days' => ['required', 'numeric', 'between:0,365'],
        ]);

        DB::transaction(function () use ($data): void {
            $policies = collect([
                'annual' => [
                    'name' => 'Annual Leave',
                    'days_per_year' => $data['annual_leave_days'],
                    'is_paid' => true,
                    'tracks_balance' => true,
                    'carry_forward_limit' => $data['carry_forward_days'],
                    'max_consecutive_days' => 15,
                    'payout_on_termination' => true,
                    'status' => 'active',
                ],
                'sick' => [
                    'name' => 'Sick Leave',
                    'days_per_year' => $data['sick_leave_days'],
                    'is_paid' => true,
                    'tracks_balance' => true,
                    'carry_forward_limit' => 0,
                    'attachment_after_days' => 2,
                    'payout_on_termination' => false,
                    'status' => 'active',
                ],
                'emergency' => [
                    'name' => 'Emergency Leave',
                    'days_per_year' => $data['emergency_leave_days'],
                    'is_paid' => true,
                    'tracks_balance' => true,
                    'carry_forward_limit' => 0,
                    'max_consecutive_days' => 3,
                    'payout_on_termination' => false,
                    'status' => 'active',
                ],
                'unpaid' => [
                    'name' => 'Unpaid Leave',
                    'days_per_year' => 0,
                    'is_paid' => false,
                    'tracks_balance' => false,
                    'carry_forward_limit' => 0,
                    'payout_on_termination' => false,
                    'status' => 'active',
                ],
            ])->map(function (array $attributes, string $code): LeavePolicy {
                return LeavePolicy::query()->updateOrCreate(['code' => $code], $attributes);
            });

            LeavePolicy::query()->where('code', 'other')->update(['status' => 'inactive']);

            $year = (int) now()->year;
            Employee::query()
                ->whereIn('status', ['active', 'on_leave', 'suspended'])
                ->get()
                ->each(function (Employee $employee) use ($policies, $year): void {
                    $policies->each(fn (LeavePolicy $policy) => $this->balances->refresh($employee, $policy, $year));
                });
        });

        return response()->json(['data' => $this->settings()]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless(
            $request->user()?->hasAnyRole(['Admin', 'Super Admin']),
            403,
            'Only administrators can change leave settings.',
        );
    }

    private function settings(): array
    {
        $policies = LeavePolicy::query()->whereIn('code', ['annual', 'sick', 'emergency'])->get()->keyBy('code');

        return [
            'annual_leave_days' => (float) ($policies->get('annual')?->days_per_year ?? 20),
            'carry_forward_days' => (float) ($policies->get('annual')?->carry_forward_limit ?? 5),
            'sick_leave_days' => (float) ($policies->get('sick')?->days_per_year ?? 10),
            'emergency_leave_days' => (float) ($policies->get('emergency')?->days_per_year ?? 5),
        ];
    }
}
