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
        $existingProfile = SystemSetting::query()
            ->where('key', 'system_profile')
            ->first()?->value ?? [];

        $data = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'system_name' => ['required', 'string', 'max:255'],
            'currency' => ['required', 'string', 'max:20'],
            'language' => ['required', 'string', 'max:20'],
            'calendar_system' => ['sometimes', 'string', 'in:shamsi,gregorian'],
            'show_gregorian_secondary' => ['sometimes', 'boolean'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string'],
        ]);

        $data['calendar_system'] = $data['calendar_system']
            ?? ($existingProfile['calendar_system'] ?? 'shamsi');
        $data['show_gregorian_secondary'] = (bool) ($data['show_gregorian_secondary']
            ?? ($existingProfile['show_gregorian_secondary'] ?? false));

        SystemSetting::query()->updateOrCreate(
            ['key' => 'system_profile'],
            ['value' => $data],
        );

        return response()->json(['data' => SystemSetting::query()->pluck('value', 'key')]);
    }
}
