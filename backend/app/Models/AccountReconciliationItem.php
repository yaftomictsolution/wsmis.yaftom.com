<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountReconciliationItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'account_reconciliation_id',
        'kind',
        'direction',
        'description',
        'reference',
        'amount',
        'cleared',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'cleared' => 'boolean',
        ];
    }

    public function reconciliation(): BelongsTo
    {
        return $this->belongsTo(AccountReconciliation::class, 'account_reconciliation_id');
    }
}
