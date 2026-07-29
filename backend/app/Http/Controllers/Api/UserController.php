<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => User::with('roles:id,name')->latest()->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateUser($request);
        $roles = $data['roles'] ?? [];
        unset($data['roles']);

        $user = User::query()->create($data);
        $user->syncRoles($roles);

        return response()->json(['data' => $user->load('roles:id,name')], 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json(['data' => $user->load('roles:id,name')]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $this->validateUser($request, $user->id, partial: true);
        $roles = $data['roles'] ?? null;
        unset($data['roles']);

        if (array_key_exists('password', $data) && blank($data['password'])) {
            unset($data['password']);
        }

        $user->update($data);

        if (is_array($roles)) {
            $user->syncRoles($roles);
        }

        return response()->json(['data' => $user->fresh()->load('roles:id,name')]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        abort_if($request->user()->is($user), 422, 'You cannot delete your own account.');

        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }

    private function validateUser(Request $request, ?int $id = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'email' => [$required, 'email', 'max:255', Rule::unique('users', 'email')->ignore($id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'password' => [$partial ? 'nullable' : 'required', 'string', 'min:6'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['string', 'exists:roles,name'],
        ]);
    }
}
