<?php

namespace App\Notifications;

use App\Models\InventoryRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InventoryRequestSubmitted extends Notification
{
    use Queueable;

    public InventoryRequest $request;

    public function __construct(InventoryRequest $request)
    {
        $this->request = $request;
    }

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return [
            'title' => ucfirst($this->request->type) . ' Request Submitted',
            'message' => "New {$this->request->type} request {$this->request->request_number} submitted for approval",
            'type' => 'inventory_request',
            'request_id' => $this->request->request_number,
            'href' => "/dashboard/inventory-manager?view={$this->request->type}",
        ];
    }
}
