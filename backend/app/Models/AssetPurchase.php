<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetPurchase extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_number',
        'asset_code_prefix',
        'name',
        'type',
        'quantity',
        'unit_cost',
        'total_amount',
        'supplier_id',
        'service_area_id',
        'financial_category_id',
        'payment_method_id',
        'accounting_account_id',
        'accounting_transaction_id',
        'created_by',
        'status',
        'asset_status',
        'purchase_date',
        'warranty_expiry',
        'invoice_number',
        'address',
        'attachment_path',
        'attachment_original_name',
        'attributes',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_cost' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'purchase_date' => 'date',
            'warranty_expiry' => 'date',
            'attributes' => 'array',
        ];
    }

    public static function nextNumber(): string
    {
        return 'ASP-'.now()->format('Ymd').'-'.str_pad(
            (string) ((self::query()->max('id') ?? 0) + 1),
            5,
            '0',
            STR_PAD_LEFT,
        );
    }

    public function generatedAssetCodes(): array
    {
        if ($this->quantity === 1) {
            return [$this->asset_code_prefix];
        }

        return collect(range(1, $this->quantity))
            ->map(fn (int $number): string => $this->asset_code_prefix.'-'.str_pad((string) $number, 3, '0', STR_PAD_LEFT))
            ->all();
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function serviceArea(): BelongsTo
    {
        return $this->belongsTo(ServiceArea::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class, 'financial_category_id');
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'accounting_account_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(AccountingTransaction::class, 'accounting_transaction_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
    }
}
