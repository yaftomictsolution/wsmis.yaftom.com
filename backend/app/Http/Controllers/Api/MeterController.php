<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meter;
use App\Models\Warehouse;
use App\Services\MeterInventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MeterController extends Controller
{
    public function __construct(private readonly MeterInventoryService $inventory) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Meter::query()->with($this->relations())->latest()->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()?->hasAnyRole(['Admin', 'Super Admin']),
            403,
            'Only an administrator can register opening meter stock. Purchased meters must be received through Purchase Goods.',
        );

        $data = $request->validate([
            'meter_number' => ['required', 'string', 'max:100', Rule::unique('meters', 'meter_number')],
            'good_id' => [
                'required',
                'integer',
                Rule::exists('goods', 'id')->where(fn ($query) => $query->where('category', 'meter')->where('status', 'active')),
            ],
            'warehouse_id' => [
                'required',
                'integer',
                Rule::exists('warehouses', 'id')->where('status', 'active'),
            ],
            'purchase_cost' => ['required', 'numeric', 'min:0'],
            'received_at' => ['required', 'date', 'before_or_equal:today'],
            'purchased_at' => ['nullable', 'date', 'before_or_equal:received_at'],
            'type' => ['nullable', 'string', 'max:100'],
            'condition_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json([
            'message' => 'Opening meter stock registered.',
            'data' => $this->inventory->registerOpeningStock($data, $request->user()),
        ], 201);
    }

    public function show(Meter $meter): JsonResponse
    {
        return response()->json(['data' => $meter->load($this->relations())]);
    }

    public function update(Request $request, Meter $meter): JsonResponse
    {
        $data = $request->validate([
            'meter_number' => ['sometimes', 'string', 'max:100', Rule::unique('meters', 'meter_number')->ignore($meter->id)],
            'type' => ['nullable', 'string', 'max:100'],
            'condition_notes' => ['nullable', 'string', 'max:2000'],
        ]);
        if (
            isset($data['meter_number'])
            && $data['meter_number'] !== $meter->meter_number
            && $meter->assignments()->exists()
        ) {
            throw ValidationException::withMessages([
                'meter_number' => ['A meter serial with assignment history cannot be changed.'],
            ]);
        }
        $meter->update($data);

        return response()->json(['data' => $meter->fresh()->load($this->relations())]);
    }

    public function destroy(Request $request, Meter $meter): JsonResponse
    {
        abort_unless(
            $request->user()?->hasAnyRole(['Admin', 'Super Admin']),
            403,
            'Only an administrator can retire a meter.',
        );
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);
        $this->inventory->retire(
            $meter,
            $request->user(),
            $data['reason'] ?? 'Meter retired from the serialized register.',
        );

        return response()->json(['message' => 'Meter retired. Its purchase and movement history was preserved.']);
    }

    public function returnToStock(Request $request, Meter $meter): JsonResponse
    {
        abort_unless(
            $request->user()?->hasAnyRole(['Admin', 'Super Admin', 'Warehouse Officer', 'Technician']),
            403,
            'Only authorized warehouse or technical staff can return a repaired meter to stock.',
        );
        $data = $request->validate([
            'warehouse_id' => [
                'required',
                'integer',
                Rule::exists('warehouses', 'id')->where('status', 'active'),
            ],
            'returned_at' => ['required', 'date', 'before_or_equal:today'],
            'notes' => ['required', 'string', 'max:2000'],
        ]);

        return response()->json([
            'message' => 'Repaired meter returned to warehouse stock.',
            'data' => $this->inventory->returnFromRepair(
                $meter,
                Warehouse::query()->findOrFail($data['warehouse_id']),
                $request->user(),
                $data['notes'],
                $data['returned_at'],
            ),
        ]);
    }

    private function relations(): array
    {
        return [
            'good:id,name,code,category',
            'inventoryItem:id,good_id,warehouse_id,name,code,quantity,unit_cost',
            'supplier:id,name',
            'sourceWarehouse:id,name,code',
            'currentWarehouse:id,name,code',
            'purchaseItem.request:id,request_number,supplier_id,warehouse_id,request_date',
            'activeAssignment.customer:id,name,house_number',
            'assignments.customer:id,name,house_number',
            'movements.fromWarehouse:id,name,code',
            'movements.toWarehouse:id,name,code',
            'movements.customer:id,name',
            'movements.creator:id,name',
        ];
    }
}
