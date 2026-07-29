<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OperationalReportingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OperationalReportController extends Controller
{
    public function __construct(private readonly OperationalReportingService $reports) {}

    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['nullable', Rule::in(['overview', 'customer', 'inventory', 'hr', 'asset', 'all'])],
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        return response()->json([
            'data' => $this->reports->report(
                $data['type'] ?? 'overview',
                $data['from'],
                $data['to'],
            ),
        ]);
    }
}
