<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\JobPosition;
use App\Models\ServiceArea;
use App\Models\Shareholder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class HrStructureController extends Controller
{
    use AuthorizesHrRequests;

    public function index(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);

        return response()->json(['data' => [
            'departments' => Department::query()->withCount('positions')->orderBy('name')->get(),
            'positions' => JobPosition::query()->with('department:id,code,name')->withCount('employees')->orderBy('title')->get(),
            'roles' => Role::query()
                ->where('guard_name', 'web')
                ->when(! $request->user()?->hasAnyRole(['Admin', 'Super Admin']), fn ($query) => $query->whereNotIn('name', ['Admin', 'Super Admin']))
                ->orderBy('name')
                ->get(['id', 'name']),
            'service_areas' => ServiceArea::query()->where('status', 'active')->orderBy('name')->get(['id', 'name']),
            'shareholders' => Shareholder::query()->where('status', 'active')->orderBy('name')->get(['id', 'shareholder_number', 'name']),
        ]]);
    }

    public function storeDepartment(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $department = Department::query()->create($this->departmentData($request));

        return response()->json(['data' => $department], 201);
    }

    public function updateDepartment(Request $request, Department $department): JsonResponse
    {
        $this->authorizeHrView($request);
        $department->update($this->departmentData($request, $department));

        return response()->json(['data' => $department->fresh()]);
    }

    public function destroyDepartment(Request $request, Department $department): JsonResponse
    {
        $this->authorizeHrApproval($request);
        abort_if($department->positions()->exists(), 422, 'Move or delete this department positions first.');
        $department->delete();

        return response()->json(['message' => 'Department deleted.']);
    }

    public function storePosition(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $position = JobPosition::query()->create($this->positionData($request));

        return response()->json(['data' => $position->load('department:id,code,name')], 201);
    }

    public function updatePosition(Request $request, JobPosition $jobPosition): JsonResponse
    {
        $this->authorizeHrView($request);
        $jobPosition->update($this->positionData($request, $jobPosition));

        return response()->json(['data' => $jobPosition->fresh()->load('department:id,code,name')]);
    }

    public function destroyPosition(Request $request, JobPosition $jobPosition): JsonResponse
    {
        $this->authorizeHrApproval($request);
        abort_if($jobPosition->employees()->exists(), 422, 'This position is assigned to employees and cannot be deleted.');
        $jobPosition->delete();

        return response()->json(['message' => 'Position deleted.']);
    }

    private function departmentData(Request $request, ?Department $department = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:100', Rule::unique('departments', 'code')->ignore($department?->id)],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ]);
    }

    private function positionData(Request $request, ?JobPosition $position = null): array
    {
        return $request->validate([
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'code' => ['required', 'string', 'max:100', Rule::unique('job_positions', 'code')->ignore($position?->id)],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ]);
    }
}
