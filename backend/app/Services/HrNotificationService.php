<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\HrWorkflowNotification;
use Illuminate\Support\Collection;

class HrNotificationService
{
    public function notifyRoles(array $roles, HrWorkflowNotification $notification, ?int $exceptUserId = null): void
    {
        User::query()
            ->where('status', 'active')
            ->whereHas('roles', fn ($query) => $query->whereIn('name', $roles))
            ->when($exceptUserId, fn ($query) => $query->whereKeyNot($exceptUserId))
            ->get()
            ->each->notify($notification);
    }

    public function notifyUsers(Collection|array $users, HrWorkflowNotification $notification): void
    {
        collect($users)->filter()->unique('id')->each->notify($notification);
    }
}
