<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Authority;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthorityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAction($request, 'view');

        return response()->json([
            'data' => Authority::query()->withCount(['contracts', 'discountPayments'])->latest('id')->get(),
        ]);
    }

    public function options(): JsonResponse
    {
        return response()->json([
            'data' => Authority::query()
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'authority_number', 'name', 'father_name', 'title', 'status']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAction($request, 'create');
        $authority = Authority::query()->create($this->validateAuthority($request) + [
            'authority_number' => Authority::nextNumber(),
        ]);

        return response()->json(['data' => $authority->loadCount(['contracts', 'discountPayments'])], 201);
    }

    public function update(Request $request, Authority $authority): JsonResponse
    {
        $this->authorizeAction($request, 'update');
        $authority->update($this->validateAuthority($request, $authority));

        return response()->json(['data' => $authority->fresh()->loadCount(['contracts', 'discountPayments'])]);
    }

    public function destroy(Request $request, Authority $authority): JsonResponse
    {
        $this->authorizeAction($request, 'delete');
        $contractCount = $authority->contracts()->count();
        $paymentCount = $authority->discountPayments()->count();

        if ($contractCount > 0 || $paymentCount > 0) {
            $contractLabel = $contractCount === 1 ? 'contract' : 'contracts';
            $paymentLabel = $paymentCount === 1 ? 'payment discount' : 'payment discounts';
            $history = collect([
                $contractCount > 0 ? "{$contractCount} customer {$contractLabel}" : null,
                $paymentCount > 0 ? "{$paymentCount} {$paymentLabel}" : null,
            ])->filter()->join(' and ');
            throw ValidationException::withMessages([
                'authority' => "{$authority->name} cannot be deleted because it is used by {$history}. Mark the authority inactive instead to preserve discount history.",
            ]);
        }

        $authority->delete();

        return response()->json(['message' => 'Authority deleted.']);
    }

    private function validateAuthority(Request $request, ?Authority $authority = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'father_name' => ['nullable', 'string', 'max:255'],
            'title' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50', Rule::unique('authorities', 'phone')->ignore($authority?->id)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('authorities', 'email')->ignore($authority?->id)],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    private function authorizeAction(Request $request, string $action): void
    {
        $user = $request->user();
        abort_unless(
            $user?->hasAnyRole(['Manager', 'Admin', 'Super Admin']) || $user?->can("authorities.{$action}"),
            403,
            'You do not have permission to manage authorities.',
        );
    }
}
