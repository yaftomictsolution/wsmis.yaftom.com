<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryIssue extends Model
{
    use HasFactory;

    protected $fillable = [
        'issue_number',
        'issue_date',
        'type',
        'department_id',
        'requested_by',
        'approved_by',
        'customer_id',
        'customer_contract_id',
        'status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'issue_date' => 'date',
    ];

    // Relationships
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(CustomerContract::class, 'customer_contract_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InventoryIssueItem::class);
    }

    // Scopes
    public function scopeInternal($query)
    {
        return $query->where('type', 'internal');
    }

    public function scopeCustomer($query)
    {
        return $query->where('type', 'customer');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending_approval');
    }

    public function scopeIssued($query)
    {
        return $query->where('status', 'issued');
    }
}
