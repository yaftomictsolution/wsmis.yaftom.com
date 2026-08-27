<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CustomerContract extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'created_by',
        'updated_by',
        'confirmed_by',
        'approved_by',
        'rejected_by',
        'contract_number',
        'subscription_date',
        'meter_size',
        'connection_fee',
        'meter_fee',
        'discount_amount',
        'net_amount',
        'required_initial_payment',
        'deposited_amount',
        'applied_amount',
        'remaining_amount',
        'discount_approved_by',
        'discount_authority_id',
        'status',
        'printed_at',
        'submitted_at',
        'submitted_by',
        'confirmed_at',
        'approved_at',
        'rejected_at',
        'activated_at',
        'cancelled_at',
        'rejection_reason',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'subscription_date' => 'date',
            'connection_fee' => 'decimal:2',
            'meter_fee' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'required_initial_payment' => 'decimal:2',
            'deposited_amount' => 'decimal:2',
            'applied_amount' => 'decimal:2',
            'remaining_amount' => 'decimal:2',
            'printed_at' => 'datetime',
            'submitted_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'activated_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    protected $appends = [
        'paid_amount',
        'payment_status',
    ];

    public static function nextNumber(): string
    {
        return 'CTR-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function confirmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function rejector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function discountAuthority(): BelongsTo
    {
        return $this->belongsTo(Authority::class, 'discount_authority_id');
    }

    public function deposits(): HasMany
    {
        return $this->hasMany(CustomerDeposit::class);
    }

    public function meterAssignments(): HasMany
    {
        return $this->hasMany(MeterAssignment::class);
    }

    public function cancellationRequests(): HasMany
    {
        return $this->hasMany(ContractCancellationRequest::class);
    }

    public function pendingCancellation(): HasOne
    {
        return $this->hasOne(ContractCancellationRequest::class)
            ->where('status', 'pending')
            ->latestOfMany();
    }

    public function contractMaterialIssues(): HasMany
    {
        return $this->hasMany(InventoryRequest::class)
            ->where('type', 'issue')
            ->where('issue_type', 'customer')
            ->where('issue_purpose', 'contract_material');
    }

    public function charges(): HasMany
    {
        return $this->hasMany(CustomerCharge::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class, 'customer_contract_id');
    }

    public function getPaidAmountAttribute(): float
    {
        return round(max(0, (float) $this->net_amount - (float) $this->remaining_amount), 2);
    }

    public function getPaymentStatusAttribute(): string
    {
        if ((float) $this->remaining_amount <= 0.005) {
            return 'paid';
        }

        return $this->paid_amount > 0.005 ? 'partially_paid' : 'unpaid';
    }
}
