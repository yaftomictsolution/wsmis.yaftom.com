<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FinancialReportingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinancialReportController extends Controller
{
    public function __construct(private readonly FinancialReportingService $reports)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user?->hasAnyRole(['Accountant', 'Manager', 'Admin', 'Super Admin'])
                || $user?->can('financial-reports.view'),
            403,
            'You cannot view financial reports.',
        );

        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'account_id' => ['nullable', 'integer', 'exists:accounting_accounts,id'],
        ]);

        return response()->json(['data' => $this->reports->report($data['from'], $data['to'], isset($data['account_id']) ? (int) $data['account_id'] : null)]);
    }
}
