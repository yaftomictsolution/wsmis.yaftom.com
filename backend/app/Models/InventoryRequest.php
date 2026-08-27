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
        'issue_purpose',
        'status',
        'return_status',
        'supplier_id',
        'customer_id',
        'customer_contract_id',
        'department_id',
        'accounting_account_id',
        'payment_method_id',
        'invoice_id',
        'document_number',
        'document_generated_at',
        'warehouse_id',
        'request_date',
        'notes',
        'total_amount',
        'initial_payment_amount',
        'paid_amount',
        'remaining_amount',
        'payment_status',
        'total_items',
        'requested_by',
        'approved_by',
        'approved_at',
        'returned_by',
        'returned_at',
        'approval_notes',
    ];

    protected $casts = [
        'request_date' => 'date',
        'approved_at' => 'datetime',
        'returned_at' => 'datetime',
        'document_generated_at' => 'datetime',
        'total_amount' => 'decimal:2',
        'initial_payment_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
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

    public function contract(): BelongsTo
    {
        return $this->belongsTo(CustomerContract::class, 'customer_contract_id');
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

    public function returner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'returned_by');
    }

    public function cancellationItems(): HasMany
    {
        return $this->hasMany(ContractCancellationItem::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InventoryRequestItem::class);
    }

    public function purchasePayments(): HasMany
    {
        return $this->hasMany(InventoryPurchasePayment::class);
    }

    public function refreshPurchasePaymentStatus(): void
    {
        $total = round((float) $this->total_amount, 2);
        $paid = min($total, round((float) $this->purchasePayments()->where('status', 'posted')->sum('amount'), 2));
        $remaining = max(0, round($total - $paid, 2));

        $this->update([
            'paid_amount' => $paid,
            'remaining_amount' => $remaining,
            'payment_status' => $remaining <= 0.005
                ? 'paid'
                : ($paid > 0.005 ? 'partially_paid' : 'unpaid'),
        ]);
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

    public function purchaseBillNumber(): string
    {
        $suffix = str_starts_with($this->request_number, 'PO-')
            ? substr($this->request_number, 3)
            : str_pad((string) $this->id, 8, '0', STR_PAD_LEFT);

        return 'PB-'.$suffix;
    }
}
