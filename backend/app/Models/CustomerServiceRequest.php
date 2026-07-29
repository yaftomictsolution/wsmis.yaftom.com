<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerServiceRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'assigned_to',
        'created_by',
        'closed_by',
        'request_number',
        'type',
        'priority',
        'description',
        'status',
        'requested_at',
        'assigned_at',
        'resolved_at',
        'closed_at',
        'resolution',
    ];

    protected function casts(): array
    {
        return [
            'requested_at' => 'date',
            'assigned_at' => 'datetime',
            'resolved_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }
}
