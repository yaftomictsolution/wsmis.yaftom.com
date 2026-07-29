<?php

namespace App\Notifications;

use App\Models\CustomerContract;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class CustomerContractConfirmedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly CustomerContract $contract,
        private readonly User $confirmedBy,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $this->contract->loadMissing('customer:id,name,last_name');
        $customerName = trim(implode(' ', array_filter([
            $this->contract->customer?->name,
            $this->contract->customer?->last_name,
        ])));

        return [
            'event' => 'customer_contract_confirmed',
            'title' => 'New customer contract confirmed',
            'message' => "{$this->contract->contract_number} for {$customerName} was confirmed by {$this->confirmedBy->name}.",
            'href' => "/dashboard/customers/{$this->contract->customer_id}?tab=contract",
            'contract_id' => $this->contract->id,
            'contract_number' => $this->contract->contract_number,
            'customer_id' => $this->contract->customer_id,
            'customer_name' => $customerName,
            'confirmed_by_id' => $this->confirmedBy->id,
            'confirmed_by_name' => $this->confirmedBy->name,
        ];
    }
}
