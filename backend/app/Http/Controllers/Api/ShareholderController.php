<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shareholder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ShareholderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        return response()->json([
            'data' => Shareholder::query()->withSum(['distributionItems as entitled_amount' => fn ($query) => $query->whereHas('distribution', fn ($distribution) => $distribution->whereIn('status', ['approved', 'partially_paid', 'paid']))], 'entitlement_amount')->withSum('distributionItems as paid_amount', 'paid_amount')->orderBy('name')->get(),
            'ownership_total' => (float) Shareholder::query()->where('status', 'active')->sum('ownership_percentage'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $data = $this->validateShareholder($request);
        $this->ensureOwnershipLimit((float) $data['ownership_percentage']);
        $shareholder = Shareholder::query()->create($data + ['shareholder_number' => Shareholder::nextNumber()]);

        return response()->json(['data' => $shareholder], 201);
    }

    public function update(Request $request, Shareholder $shareholder): JsonResponse
    {
        $this->authorizeManage($request);
        $data = $this->validateShareholder($request);
        $this->ensureOwnershipLimit((float) $data['ownership_percentage'], $shareholder->id);
        $shareholder->update($data);

        return response()->json(['data' => $shareholder->fresh()]);
    }

    public function destroy(Request $request, Shareholder $shareholder): JsonResponse
    {
        $this->authorizeManage($request);
        abort_if($shareholder->distributionItems()->exists(), 422, 'A shareholder with distribution history cannot be deleted. Set the shareholder inactive instead.');
        $shareholder->delete();

        return response()->json(['message' => 'Shareholder deleted.']);
    }

    private function validateShareholder(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'father_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'investment_amount' => ['nullable', 'numeric', 'min:0'],
            'ownership_percentage' => ['required', 'numeric', 'gt:0', 'lte:100'],
            'joined_on' => ['nullable', 'date'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string'],
        ]);
    }

    private function ensureOwnershipLimit(float $percentage, ?int $exceptId = null): void
    {
        $existing = (float) Shareholder::query()->where('status', 'active')->when($exceptId, fn ($query) => $query->whereKeyNot($exceptId))->sum('ownership_percentage');
        if ($existing + $percentage > 100.0001) {
            throw ValidationException::withMessages(['ownership_percentage' => ['Active shareholder ownership cannot exceed 100%.']]);
        }
    }

    private function authorizeManage(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Accountant', 'Manager', 'Admin', 'Super Admin']), 403, 'You cannot manage shareholders.');
    }
}
