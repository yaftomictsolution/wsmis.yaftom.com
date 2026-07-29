<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Role::with('permissions:id,name')->orderBy('name')->get(),
            'permissions' => Permission::query()->orderBy('name')->pluck('name'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateRole($request);
        $role = Role::query()->create(['name' => $data['name'], 'guard_name' => 'web']);
        $role->syncPermissions($data['permissions'] ?? []);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['data' => $role->load('permissions:id,name')], 201);
    }

    public function show(Role $role): JsonResponse
    {
        return response()->json(['data' => $role->load('permissions:id,name')]);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $data = $this->validateRole($request, $role->id, partial: true);
        $permissions = $data['permissions'] ?? null;
        unset($data['permissions']);

        $role->update($data);

        if (is_array($permissions)) {
            $role->syncPermissions($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['data' => $role->fresh()->load('permissions:id,name')]);
    }

    public function destroy(Role $role): JsonResponse
    {
        abort_if($role->name === 'Admin', 422, 'The Admin role cannot be deleted.');

        $role->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['message' => 'Role deleted.']);
    }

    private function validateRole(Request $request, ?int $id = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255', Rule::unique('roles', 'name')->ignore($id)],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);
    }
}
