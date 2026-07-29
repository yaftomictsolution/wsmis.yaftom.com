<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerDepositAllocation extends Model
{
    use HasFactory;

    protected $fillable = ['customer_deposit_id', 'customer_charge_id', 'amount'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function deposit(): BelongsTo
    {
        return $this->belongsTo(CustomerDeposit::class, 'customer_deposit_id');
    }

    public function charge(): BelongsTo
    {
        return $this->belongsTo(CustomerCharge::class, 'customer_charge_id');
    }
}
