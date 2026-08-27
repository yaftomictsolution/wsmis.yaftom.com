<?php

namespace App\Notifications;

use App\Models\ContractCancellationRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class ContractCancellationResolved extends Notification
{
    use Queueable;

    public function __construct(private readonly ContractCancellationRequest $cancellation) {}

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        $contract = $this->cancellation->contract;

        return [
            'title' => 'Contract cancellation '.ucfirst($this->cancellation->status),
            'message' => "{$contract->contract_number} cancellation was {$this->cancellation->status}.",
            'type' => 'contract_cancellation_update',
            'event' => 'contract_cancellation_resolved',
            'contract_cancellation_request_id' => $this->cancellation->id,
            'contract_id' => $contract->id,
            'contract_number' => $contract->contract_number,
            'customer_id' => $contract->customer_id,
            'href' => "/dashboard/customers/{$contract->customer_id}?tab=contract",
        ];
    }
}
