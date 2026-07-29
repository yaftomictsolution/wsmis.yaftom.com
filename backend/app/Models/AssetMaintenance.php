<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetMaintenance extends Model
{
    use HasFactory;

    protected $table = 'asset_maintenance';

    protected $fillable = [
        'asset_id',
        'maintenance_type',
        'title',
        'description',
        'cost',
        'performed_at',
        'next_due_date',
        'status',
        'performed_by',
        'created_by',
        'notes',
    ];

    protected $casts = [
        'cost' => 'decimal:2',
        'performed_at' => 'date',
        'next_due_date' => 'date',
    ];

    // Relationships
    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Scopes
    public function scopeScheduled($query)
    {
        return $query->where('status', 'scheduled');
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeUpcoming($query)
    {
        return $query->where('next_due_date', '<=', now()->addDays(7))
                     ->where('status', '!=', 'completed');
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('maintenance_type', $type);
    }
}
