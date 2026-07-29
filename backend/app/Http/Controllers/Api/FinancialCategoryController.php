<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinancialCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FinancialCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => FinancialCategory::query()
            ->withCount('transactions')
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
            ->orderBy('type')
            ->orderBy('name')
            ->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $data = $this->validateCategory($request);
        $data['code'] = $this->categoryCode($data['name'], $data['code'] ?? null);

        return response()->json(['data' => FinancialCategory::query()->create($data)], 201);
    }

    public function update(Request $request, FinancialCategory $financialCategory): JsonResponse
    {
        $this->authorizeManage($request);
        $data = $this->validateCategory($request, $financialCategory->id, partial: true);
        if (isset($data['type']) && $data['type'] !== $financialCategory->type && $this->isUsed($financialCategory)) {
            throw ValidationException::withMessages([
                'type' => ['The type cannot be changed after this category has been used.'],
            ]);
        }
        if (array_key_exists('code', $data) && ! $data['code']) {
            $data['code'] = $this->categoryCode($data['name'] ?? $financialCategory->name);
        }
        $financialCategory->update($data);

        return response()->json(['data' => $financialCategory->fresh()->loadCount('transactions')]);
    }

    public function destroy(Request $request, FinancialCategory $financialCategory): JsonResponse
    {
        $this->authorizeManage($request);
        abort_if(
            $this->isUsed($financialCategory),
            422,
            'This expense type is already used by financial records. Set it inactive instead.',
        );
        $financialCategory->delete();

        return response()->json(['message' => 'Financial category deleted.']);
    }

    private function validateCategory(Request $request, ?int $id = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:100', Rule::unique('financial_categories', 'code')->ignore($id)],
            'type' => [$required, Rule::in(['income', 'expense'])],
            'description' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);
    }

    private function categoryCode(string $name, ?string $code = null): string
    {
        $resolved = Str::of($code ?: $name)->lower()->slug('_')->toString();
        if ($resolved === '') {
            throw ValidationException::withMessages(['code' => ['Enter a valid category name or code.']]);
        }
        if (FinancialCategory::query()->where('code', $resolved)->exists()) {
            throw ValidationException::withMessages(['code' => ['This category code is already in use.']]);
        }

        return $resolved;
    }

    private function isUsed(FinancialCategory $category): bool
    {
        return collect([
            ['accounting_transactions', 'financial_category_id'],
            ['asset_purchases', 'financial_category_id'],
            ['customer_charges', 'financial_category_id'],
            ['invoice_items', 'financial_category_id'],
            ['payroll_runs', 'financial_category_id'],
            ['supplier_purchase_contracts', 'financial_category_id'],
        ])->contains(
            fn (array $reference): bool => DB::table($reference[0])->where($reference[1], $category->id)->exists(),
        );
    }

    private function authorizeManage(Request $request): void
    {
        abort_unless(
            $request->user()?->hasAnyRole(['Admin', 'Super Admin']),
            403,
            'Only administrators can manage expense types.',
        );
    }
}
