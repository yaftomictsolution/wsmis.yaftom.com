<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkShift extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'name', 'start_time', 'end_time', 'break_minutes', 'late_grace_minutes',
        'overtime_after_minutes', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'break_minutes' => 'integer', 'late_grace_minutes' => 'integer', 'overtime_after_minutes' => 'integer',
        ];
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(EmployeeShiftAssignment::class);
    }
}
