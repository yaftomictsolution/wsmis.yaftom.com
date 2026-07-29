<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PerformanceReview extends Model
{
    use HasFactory;

    protected $fillable = ['employee_id', 'reviewed_by', 'period_start', 'period_end', 'rating', 'achievements', 'concerns', 'goals', 'notes', 'status', 'finalized_at'];

    protected function casts(): array
    {
        return ['period_start' => 'date', 'period_end' => 'date', 'finalized_at' => 'datetime'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
