<?php

namespace App\Notifications;

use App\Models\ContractCancellationRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class ContractCancellationSubmitted extends Notification
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
            'title' => 'Contract cancellation needs approval',
            'message' => "{$contract->contract_number} is waiting for your decision.",
            'type' => 'contract_cancellation',
            'event' => 'contract_cancellation_submitted',
            'contract_cancellation_request_id' => $this->cancellation->id,
            'contract_id' => $contract->id,
            'contract_number' => $contract->contract_number,
            'customer_id' => $contract->customer_id,
            'href' => "/dashboard/customers/{$contract->customer_id}?tab=contract",
        ];
    }
}
