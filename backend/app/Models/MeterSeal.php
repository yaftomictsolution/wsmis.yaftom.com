<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeterSeal extends Model
{
    use HasFactory;

    protected $fillable = [
        'meter_assignment_id',
        'sealed_by',
        'removed_by',
        'seal_number',
        'sealed_at',
        'status',
        'removed_at',
        'removal_reason',
        'photo_path',
        'photo_original_name',
        'photo_mime_type',
        'photo_size',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'sealed_at' => 'datetime',
            'removed_at' => 'datetime',
            'photo_size' => 'integer',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(MeterAssignment::class, 'meter_assignment_id');
    }

    public function sealer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sealed_by');
    }

    public function remover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'removed_by');
    }
}
