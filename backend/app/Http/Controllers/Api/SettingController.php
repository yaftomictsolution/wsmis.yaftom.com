<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinancialCategory;
use App\Models\CustomerChargeType;
use App\Models\PaymentMethod;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => [
                'system' => SystemSetting::query()->pluck('value', 'key'),
                'payment_methods' => PaymentMethod::query()->orderBy('name')->get(),
                'financial_categories' => FinancialCategory::query()->orderBy('type')->orderBy('name')->get(),
                'customer_charge_types' => CustomerChargeType::query()
                    ->withCount('charges')
                    ->orderByDesc('is_system')
                    ->orderBy('name')
                    ->get(),
            ],
        ]);
    }

    public function updateSystemProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'system_name' => ['required', 'string', 'max:255'],
            'currency' => ['required', 'string', 'max:20'],
            'language' => ['required', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string'],
        ]);

        SystemSetting::query()->updateOrCreate(
            ['key' => 'system_profile'],
            ['value' => $data],
        );

        return response()->json(['data' => SystemSetting::query()->pluck('value', 'key')]);
    }
}
