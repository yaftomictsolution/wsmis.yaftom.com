<?php

namespace App\Notifications;

use App\Models\InventoryRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class InventoryRequestApproved extends Notification
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
        $status = $this->request->status;
        return [
            'title' => 'Request ' . ucfirst($status),
            'message' => "Your {$this->request->type} request {$this->request->request_number} has been {$status}",
            'type' => 'inventory_request_update',
            'request_id' => $this->request->request_number,
            'href' => "/dashboard/inventory-manager?view={$this->request->type}",
        ];
    }
}
