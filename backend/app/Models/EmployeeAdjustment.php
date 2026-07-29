<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeAdjustment extends Model
{
    use HasFactory;

    protected $fillable = ['employee_id', 'payroll_item_id', 'created_by', 'approved_by', 'adjustment_number', 'type', 'amount', 'effective_date', 'status', 'approved_at', 'rejection_reason', 'title', 'notes'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'effective_date' => 'date', 'approved_at' => 'datetime'];
    }

    public static function nextNumber(): string
    {
        return 'ADJ-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function payrollItem(): BelongsTo
    {
        return $this->belongsTo(PayrollItem::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
