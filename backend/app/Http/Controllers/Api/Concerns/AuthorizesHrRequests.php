<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Employee;
use Illuminate\Http\Request;

trait AuthorizesHrRequests
{
    private function authorizeHrView(Request $request): void
    {
        abort_unless($this->canManageHr($request), 403, 'You cannot access human resources.');
    }

    private function authorizeHrApproval(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Manager', 'Admin', 'Super Admin']), 403, 'Only managers or admins can approve HR records.');
    }

    private function authorizePayrollWork(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['HR', 'Accountant', 'Manager', 'Admin', 'Super Admin']), 403, 'You cannot manage payroll.');
    }

    private function canManageHr(Request $request): bool
    {
        return (bool) $request->user()?->hasAnyRole(['HR', 'Manager', 'Admin', 'Super Admin']);
    }

    private function currentEmployee(Request $request): ?Employee
    {
        return Employee::query()->where('user_id', $request->user()?->id)->first();
    }
}
