<?php

namespace App\Notifications;

use App\Models\InventoryRequest;
use Illuminate\Bus\Queueable;
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
        $label = $this->request->type === 'purchase' ? 'Purchase' : 'Issue';

        return [
            'title' => "{$label} awaiting approval",
            'message' => "{$this->request->request_number} was submitted and needs admin approval.",
            'type' => 'inventory_request',
            'event' => 'inventory_request_submitted',
            'inventory_request_id' => $this->request->id,
            'request_id' => $this->request->id,
            'request_number' => $this->request->request_number,
            'href' => "/dashboard/inventory-manager?view={$this->request->type}",
        ];
    }
}
