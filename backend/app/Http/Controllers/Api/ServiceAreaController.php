<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceArea;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ServiceAreaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ServiceArea::query()
                ->with('mosques')
                ->withCount(['customers', 'mosques'])
                ->latest()
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateArea($request);
        $mosques = $data['mosques'] ?? null;
        unset($data['mosques']);

        $serviceArea = DB::transaction(function () use ($data, $mosques): ServiceArea {
            $serviceArea = ServiceArea::query()->create($data);

            if (is_array($mosques)) {
                $this->syncMosques($serviceArea, $mosques);
            } elseif (filled($serviceArea->mosque_name)) {
                $this->syncMosques($serviceArea, [[
                    'name' => $serviceArea->mosque_name,
                    'status' => 'active',
                ]]);
            }

            return $serviceArea;
        });

        return response()->json(['data' => $this->areaResponse($serviceArea)], 201);
    }

    public function show(ServiceArea $serviceArea): JsonResponse
    {
        return response()->json(['data' => $serviceArea->load([
            'mosques',
            'customers:id,service_area_id,service_area_mosque_id,name,phone,house_number,status',
            'customers.serviceAreaMosque:id,service_area_id,name,status',
        ])]);
    }

    public function update(Request $request, ServiceArea $serviceArea): JsonResponse
    {
        $data = $this->validateArea($request, $serviceArea, partial: true);
        $mosquesWereSubmitted = array_key_exists('mosques', $data);
        $mosques = $data['mosques'] ?? [];
        unset($data['mosques']);

        DB::transaction(function () use ($serviceArea, $data, $mosques, $mosquesWereSubmitted): void {
            $serviceArea->update($data);

            if ($mosquesWereSubmitted) {
                $this->syncMosques($serviceArea, $mosques);
            }
        });

        return response()->json(['data' => $this->areaResponse($serviceArea)]);
    }

    public function destroy(ServiceArea $serviceArea): JsonResponse
    {
        $customerCount = $serviceArea->customers()->count();

        if ($customerCount > 0) {
            $customerLabel = $customerCount === 1 ? 'customer' : 'customers';

            throw ValidationException::withMessages([
                'service_area' => "{$serviceArea->name} cannot be deleted because it has {$customerCount} registered {$customerLabel}. Mark the service area inactive instead to preserve customer history.",
            ]);
        }

        try {
            $serviceArea->delete();
        } catch (QueryException $exception) {
            if ((string) $exception->getCode() !== '23000') {
                throw $exception;
            }

            throw ValidationException::withMessages([
                'service_area' => "{$serviceArea->name} cannot be deleted because related records still use it. Mark the service area inactive instead.",
            ]);
        }

        return response()->json(['message' => 'Service area deleted.']);
    }

    private function validateArea(Request $request, ?ServiceArea $serviceArea = null, bool $partial = false): array
    {
        if ($request->has('mosques') && is_array($request->input('mosques'))) {
            $mosques = collect($request->input('mosques'))
                ->filter(fn ($mosque) => is_array($mosque))
                ->map(function (array $mosque): array {
                    $name = preg_replace('/\s+/u', ' ', trim((string) ($mosque['name'] ?? '')));

                    $normalized = [
                        'name' => $name,
                        'status' => $mosque['status'] ?? 'active',
                        'notes' => filled($mosque['notes'] ?? null) ? trim((string) $mosque['notes']) : null,
                    ];

                    if (isset($mosque['id'])) {
                        $normalized['id'] = (int) $mosque['id'];
                    }

                    return $normalized;
                })
                ->filter(fn (array $mosque) => $mosque['name'] !== '')
                ->values()
                ->all();

            $request->merge(['mosques' => $mosques]);
        }

        $required = $partial ? 'sometimes' : 'required';
        $mosqueIdRule = $serviceArea
            ? Rule::exists('service_area_mosques', 'id')->where('service_area_id', $serviceArea->id)
            : 'prohibited';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'mosque_name' => ['nullable', 'string', 'max:255'],
            'district' => ['nullable', 'string', 'max:255'],
            'street_block_village' => ['nullable', 'string', 'max:255'],
            'representative_name' => ['nullable', 'string', 'max:255'],
            'representative_phone' => ['nullable', 'string', 'max:50'],
            'households_count' => ['nullable', 'integer', 'min:0'],
            'rate_per_cubic_meter' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'inactive_reason' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'mosques' => ['sometimes', 'array', 'max:50'],
            'mosques.*.id' => ['nullable', 'integer', $mosqueIdRule],
            'mosques.*.name' => ['required', 'string', 'max:255', 'distinct:ignore_case'],
            'mosques.*.status' => ['required', Rule::in(['active', 'inactive'])],
            'mosques.*.notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'mosques.max' => 'A service area may contain at most 50 mosques.',
            'mosques.*.id.exists' => 'One of the selected mosques does not belong to this service area.',
            'mosques.*.name.distinct' => 'Mosque names must be unique within the service area.',
        ]);
    }

    private function syncMosques(ServiceArea $serviceArea, array $mosques): void
    {
        $existing = $serviceArea->mosques()->withCount('customers')->get()->keyBy('id');
        $submittedIds = collect($mosques)
            ->pluck('id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->values();

        foreach ($existing->whereNotIn('id', $submittedIds) as $mosque) {
            if ($mosque->customers_count > 0) {
                throw ValidationException::withMessages([
                    'mosques' => "{$mosque->name} is assigned to customers and cannot be deleted. Mark it inactive instead.",
                ]);
            }

            $mosque->delete();
        }

        foreach ($mosques as $mosqueData) {
            $attributes = [
                'name' => $mosqueData['name'],
                'status' => $mosqueData['status'],
                'notes' => $mosqueData['notes'] ?? null,
            ];

            if (! empty($mosqueData['id'])) {
                $existing->get((int) $mosqueData['id'])->update($attributes);
            } else {
                $serviceArea->mosques()->create($attributes);
            }
        }

        $primaryMosque = collect($mosques)->firstWhere('status', 'active') ?? ($mosques[0] ?? null);
        $legacyMosqueName = $primaryMosque['name'] ?? null;

        $serviceArea->forceFill(['mosque_name' => $legacyMosqueName])->saveQuietly();
    }

    private function areaResponse(ServiceArea $serviceArea): ServiceArea
    {
        return $serviceArea->fresh()->load('mosques')->loadCount(['customers', 'mosques']);
    }
}
