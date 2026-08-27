<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\LeavePolicy;
use App\Services\LeaveBalanceService;
use App\Services\LeavePolicyDefaultsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaveSettingsController extends Controller
{
    public function __construct(
        private readonly LeaveBalanceService $balances,
        private readonly LeavePolicyDefaultsService $policyDefaults,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $this->policyDefaults->ensure();

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
            $policies = $this->policyDefaults->synchronize($data);

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
