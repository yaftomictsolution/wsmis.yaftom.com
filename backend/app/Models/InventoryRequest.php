<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryRequest extends Model
{
    protected $fillable = [
        'request_number',
        'type',
        'issue_type',
        'status',
        'supplier_id',
        'customer_id',
        'department_id',
        'accounting_account_id',
        'payment_method_id',
        'invoice_id',
        'warehouse_id',
        'request_date',
        'notes',
        'total_amount',
        'initial_payment_amount',
        'total_items',
        'requested_by',
        'approved_by',
        'approved_at',
        'approval_notes',
    ];

    protected $casts = [
        'request_date' => 'date',
        'approved_at' => 'datetime',
        'total_amount' => 'decimal:2',
        'initial_payment_amount' => 'decimal:2',
    ];

    // Relationships
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'accounting_account_id');
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InventoryRequestItem::class);
    }

    // Scopes
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeByType($query, string $type)
    {
        return $query->where('type', $type);
    }

    // Generate next request number
    public static function nextNumber(string $type): string
    {
        $prefix = $type === 'purchase' ? 'PO' : 'SI';
        $nextId = (int) (self::query()->max('id') ?? 0) + 1;

        return $prefix.'-'.now()->format('Ymd').'-'.str_pad((string) $nextId, 5, '0', STR_PAD_LEFT);
    }
}
