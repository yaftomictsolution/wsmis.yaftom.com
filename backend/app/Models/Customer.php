<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Customer extends Model
{
    use HasFactory;

    protected $appends = [
        'has_photo',
    ];

    protected $hidden = [
        'photo_path',
    ];

    public const INVENTORY_SALE_ELIGIBLE_STATUSES = [
        'registered',
        'awaiting_approval',
        'awaiting_installation',
        'active',
        'suspended',
        'disconnected',
    ];

    protected $fillable = [
        'service_area_id',
        'service_area_mosque_id',
        'subscription_code',
        'subscription_date',
        'name',
        'last_name',
        'father_name',
        'grandfather_name',
        'phone',
        'secondary_phone',
        'tazkira_number',
        'house_number',
        'nearest_house_number',
        'street_number',
        'original_residence',
        'current_residence',
        'meter_size',
        'connection_fee',
        'meter_fee',
        'agreement_discount_amount',
        'agreement_paid_amount',
        'agreement_payment_method_id',
        'agreement_accounting_account_id',
        'agreement_payment_received_by',
        'agreement_payment_date',
        'agreement_payment_reference',
        'agreement_payment_id',
        'agreement_remaining_amount',
        'discount_approved_by',
        'agreement_status',
        'agreement_printed_at',
        'submitted_for_approval_at',
        'approved_by',
        'approved_at',
        'rejected_by',
        'rejected_at',
        'rejection_reason',
        'address',
        'opening_balance',
        'current_balance',
        'status',
        'documents',
        'photo_path',
        'photo_original_name',
        'photo_mime_type',
        'photo_size',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'documents' => 'array',
            'subscription_date' => 'date',
            'agreement_printed_at' => 'datetime',
            'submitted_for_approval_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'connection_fee' => 'decimal:2',
            'meter_fee' => 'decimal:2',
            'agreement_discount_amount' => 'decimal:2',
            'agreement_paid_amount' => 'decimal:2',
            'agreement_payment_date' => 'date',
            'agreement_remaining_amount' => 'decimal:2',
            'opening_balance' => 'decimal:2',
            'current_balance' => 'decimal:2',
        ];
    }

    public function contractAllowsWorkflow(): bool
    {
        $contract = $this->relationLoaded('latestContract')
            ? $this->latestContract
            : $this->latestContract()->first();

        if ($contract) {
            return in_array($contract->status, ['installation_pending', 'active'], true);
        }

        return in_array($this->agreement_status, ['approved', 'installation_pending', 'signed', 'active'], true);
    }

    public function canReceiveInventorySale(): bool
    {
        return in_array($this->status, self::INVENTORY_SALE_ELIGIBLE_STATUSES, true);
    }

    protected function hasPhoto(): Attribute
    {
        return Attribute::get(fn (): bool => filled($this->photo_path));
    }

    public function serviceArea(): BelongsTo
    {
        return $this->belongsTo(ServiceArea::class);
    }

    public function serviceAreaMosque(): BelongsTo
    {
        return $this->belongsTo(ServiceAreaMosque::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function agreementPaymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'agreement_payment_method_id');
    }

    public function agreementAccount(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'agreement_accounting_account_id');
    }

    public function agreementPaymentReceiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agreement_payment_received_by');
    }

    public function agreementPayment(): BelongsTo
    {
        return $this->belongsTo(Payment::class, 'agreement_payment_id');
    }

    public function meterAssignments(): HasMany
    {
        return $this->hasMany(MeterAssignment::class);
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(CustomerContract::class);
    }

    public function latestContract(): HasOne
    {
        return $this->hasOne(CustomerContract::class)->latestOfMany();
    }

    public function deposits(): HasMany
    {
        return $this->hasMany(CustomerDeposit::class);
    }

    public function meterReadings(): HasMany
    {
        return $this->hasMany(MeterReading::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function documentFiles(): HasMany
    {
        return $this->hasMany(CustomerDocument::class);
    }

    public function charges(): HasMany
    {
        return $this->hasMany(CustomerCharge::class);
    }

    public function serviceRequests(): HasMany
    {
        return $this->hasMany(CustomerServiceRequest::class);
    }

    public function connectionEvents(): HasMany
    {
        return $this->hasMany(CustomerConnectionEvent::class);
    }
}
