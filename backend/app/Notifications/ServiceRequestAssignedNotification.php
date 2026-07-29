<?php

namespace App\Notifications;

use App\Models\CustomerServiceRequest;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class ServiceRequestAssignedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly CustomerServiceRequest $serviceRequest,
        private readonly User $assignedBy,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $this->serviceRequest->loadMissing('customer:id,name,last_name');
        $customerName = trim(implode(' ', array_filter([
            $this->serviceRequest->customer?->name,
            $this->serviceRequest->customer?->last_name,
        ])));

        return [
            'event' => 'service_request_assigned',
            'title' => 'Service request assigned',
            'message' => "{$this->serviceRequest->request_number} for {$customerName} was assigned to you by {$this->assignedBy->name}.",
            'href' => "/dashboard/customers/{$this->serviceRequest->customer_id}?tab=requests",
            'service_request_id' => $this->serviceRequest->id,
            'request_number' => $this->serviceRequest->request_number,
            'customer_id' => $this->serviceRequest->customer_id,
            'customer_name' => $customerName,
            'assigned_by_id' => $this->assignedBy->id,
            'assigned_by_name' => $this->assignedBy->name,
        ];
    }
}
