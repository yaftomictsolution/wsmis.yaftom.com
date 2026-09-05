<?php

namespace App\Services;

use App\Models\AttendanceDevice;
use App\Models\AttendanceDeviceEvent;
use App\Models\AttendanceDeviceMapping;
use App\Models\AttendanceRecord;
use App\Models\BiometricImportBatch;
use App\Models\Employee;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class AttendanceDevicePunchService
{
    public function __construct(
        private readonly AttendanceService $attendance,
        private readonly BusinessClock $clock,
    ) {}

    public function ingest(
        AttendanceDevice $device,
        array $punches,
        ?BiometricImportBatch $batch,
        ?int $actorId,
        string $source,
    ): array {
        $counts = [
            'total' => count($punches),
            'created' => 0,
            'processed' => 0,
            'duplicates' => 0,
            'unmatched' => 0,
            'conflicts' => 0,
            'invalid' => 0,
            'errors' => [],
        ];

        foreach ($punches as $index => $punch) {
            try {
                $normalized = $this->normalizePunch($device, (array) $punch, $source);
                $event = AttendanceDeviceEvent::query()->firstOrCreate(
                    [
                        'attendance_device_id' => $device->id,
                        'event_uid' => $normalized['event_uid'],
                    ],
                    $normalized + ['biometric_import_batch_id' => $batch?->id],
                );

                if (! $event->wasRecentlyCreated) {
                    $counts['duplicates']++;

                    continue;
                }

                $counts['created']++;
                $this->applyEvent($event, $actorId);
                $status = $event->fresh()->status;
                if ($status === 'conflict') {
                    $counts['conflicts']++;
                } elseif (isset($counts[$status])) {
                    $counts[$status]++;
                } elseif ($status === 'processed') {
                    $counts['processed']++;
                }
            } catch (Throwable $exception) {
                $counts['invalid']++;
                if (count($counts['errors']) < 100) {
                    $counts['errors'][] = [
                        'row' => (int) (($punch['_row'] ?? null) ?: ($index + 1)),
                        'message' => $this->safeMessage($exception),
                    ];
                }
            }
        }

        $lastPunch = AttendanceDeviceEvent::query()
            ->where('attendance_device_id', $device->id)
            ->max('occurred_at');
        if ($lastPunch) {
            $device->forceFill(['last_punch_at' => $lastPunch])->save();
        }

        return $counts;
    }

    public function mapDeviceUser(
        AttendanceDevice $device,
        Employee $employee,
        string $deviceUserId,
        ?string $deviceUserName,
        ?string $cardNumber,
        ?int $actorId,
    ): array {
        $deviceUserId = trim($deviceUserId);
        if ($deviceUserId === '') {
            throw ValidationException::withMessages(['device_user_id' => ['Device User ID is required.']]);
        }

        $mapping = DB::transaction(function () use ($device, $employee, $deviceUserId, $deviceUserName, $cardNumber, $actorId): AttendanceDeviceMapping {
            $existingUser = AttendanceDeviceMapping::query()
                ->where('attendance_device_id', $device->id)
                ->where('device_user_id', $deviceUserId)
                ->first();
            if ($existingUser && $existingUser->employee_id !== $employee->id) {
                throw ValidationException::withMessages([
                    'device_user_id' => ['This Device User ID is already mapped to another employee.'],
                ]);
            }

            $existingEmployee = AttendanceDeviceMapping::query()
                ->where('attendance_device_id', $device->id)
                ->where('employee_id', $employee->id)
                ->first();
            if ($existingEmployee && $existingEmployee->device_user_id !== $deviceUserId) {
                throw ValidationException::withMessages([
                    'employee_id' => ['This employee is already mapped to another user on this device.'],
                ]);
            }

            return AttendanceDeviceMapping::query()->updateOrCreate(
                ['attendance_device_id' => $device->id, 'device_user_id' => $deviceUserId],
                [
                    'employee_id' => $employee->id,
                    'created_by' => $actorId,
                    'device_user_name' => $deviceUserName ?: null,
                    'card_number' => $cardNumber ?: null,
                    'mapping_source' => 'manual',
                    'status' => 'active',
                ],
            );
        });

        $processed = 0;
        $conflicts = 0;
        AttendanceDeviceEvent::query()
            ->where('attendance_device_id', $device->id)
            ->where('device_user_id', $deviceUserId)
            ->whereIn('status', ['unmatched', 'invalid'])
            ->orderBy('occurred_at')
            ->get()
            ->each(function (AttendanceDeviceEvent $event) use ($actorId, &$processed, &$conflicts): void {
                $event->forceFill(['status' => 'unmatched', 'error_message' => null])->save();
                $this->applyEvent($event, $actorId);
                $event->refresh();
                $event->status === 'processed' ? $processed++ : $conflicts++;
            });

        return [
            'mapping' => $mapping->fresh()->load('employee:id,employee_number,first_name,last_name,biometric_id'),
            'processed_events' => $processed,
            'remaining_conflicts' => $conflicts,
        ];
    }

    public function reprocess(AttendanceDeviceEvent $event, ?int $actorId): AttendanceDeviceEvent
    {
        $event->forceFill(['status' => 'unmatched', 'error_message' => null, 'processed_at' => null])->save();
        $this->applyEvent($event, $actorId);

        return $event->fresh($this->eventRelations());
    }

    public function ignore(AttendanceDeviceEvent $event): AttendanceDeviceEvent
    {
        $event->forceFill([
            'status' => 'ignored',
            'error_message' => null,
            'processed_at' => now(),
        ])->save();

        return $event->fresh($this->eventRelations());
    }

    private function applyEvent(AttendanceDeviceEvent $event, ?int $actorId): void
    {
        $mapping = AttendanceDeviceMapping::query()
            ->where('attendance_device_id', $event->attendance_device_id)
            ->where('device_user_id', $event->device_user_id)
            ->where('status', 'active')
            ->first();
        $employee = $mapping?->employee;

        if (! $employee) {
            $employee = Employee::query()
                ->where('biometric_id', $event->device_user_id)
                ->orWhere('employee_number', $event->device_user_id)
                ->first();

            if ($employee) {
                try {
                    $existingEmployeeMapping = AttendanceDeviceMapping::query()
                        ->where('attendance_device_id', $event->attendance_device_id)
                        ->where('employee_id', $employee->id)
                        ->first();

                    if ($existingEmployeeMapping && $existingEmployeeMapping->device_user_id !== $event->device_user_id) {
                        $employee = null;
                    } else {
                        $mapping = $existingEmployeeMapping ?: AttendanceDeviceMapping::query()->create([
                            'attendance_device_id' => $event->attendance_device_id,
                            'employee_id' => $employee->id,
                            'device_user_id' => $event->device_user_id,
                            'device_user_name' => $event->device_user_name,
                            'mapping_source' => 'automatic',
                            'status' => 'active',
                        ]);
                    }
                } catch (UniqueConstraintViolationException) {
                    $mapping = null;
                    $employee = null;
                }
            }
        }

        if (! $employee) {
            $event->forceFill([
                'status' => 'unmatched',
                'error_message' => 'Map this Device User ID to an employee before processing the punch.',
            ])->save();

            return;
        }

        $date = $event->attendance_date->toDateString();
        if ($date > $this->clock->effectiveDate()) {
            $this->markInvalid($event, 'The device punch date is in the future. Check the device clock and timezone.');

            return;
        }
        if ($date < $employee->hire_date->toDateString()) {
            $this->markInvalid($event, 'The device punch is earlier than the employee hire date.');

            return;
        }
        if ($employee->termination_date && $date > $employee->termination_date->toDateString()) {
            $this->markInvalid($event, 'The device punch is later than the employee termination date.');

            return;
        }

        $event->forceFill([
            'attendance_device_mapping_id' => $mapping?->id,
            'employee_id' => $employee->id,
            'status' => 'processing',
            'error_message' => null,
        ])->save();
        $mapping?->forceFill(['last_seen_at' => $event->occurred_at])->save();

        $this->rebuildAttendance($event, $employee, $actorId);
    }

    private function rebuildAttendance(AttendanceDeviceEvent $event, Employee $employee, ?int $actorId): void
    {
        $date = $event->attendance_date->toDateString();
        $existing = AttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', $date)
            ->first();

        if ($existing?->source === 'leave') {
            $this->markConflict($event, 'Approved leave exists on this date. Resolve the leave before using this punch.');

            return;
        }

        if ($existing?->approval_status === 'approved') {
            if ($this->matchesApprovedTime($event, $existing)) {
                $event->forceFill([
                    'attendance_record_id' => $existing->id,
                    'status' => 'processed',
                    'processed_at' => now(),
                    'error_message' => null,
                ])->save();

                return;
            }

            $this->markConflict($event, 'Approved attendance already exists. Delete or correct it before reprocessing this punch.');

            return;
        }

        if ($existing && ! in_array($existing->source, ['biometric'], true)) {
            $this->markConflict($event, 'Manual attendance already exists. Review it before replacing it with device punches.');

            return;
        }

        $events = AttendanceDeviceEvent::query()
            ->with('device:id,timezone')
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', $date)
            ->whereIn('status', ['processing', 'processed'])
            ->orderBy('occurred_at')
            ->orderBy('id')
            ->get()
            ->unique(fn (AttendanceDeviceEvent $item): string => $item->occurred_at->format('Y-m-d H:i:s'))
            ->values();

        $first = $events->first();
        $last = $events->count() > 1 ? $events->last() : null;
        $record = $existing ?: new AttendanceRecord([
            'employee_id' => $employee->id,
            'attendance_date' => $date,
        ]);
        $record->fill([
            'biometric_import_batch_id' => $event->biometric_import_batch_id,
            'recorded_by' => $actorId,
            'attendance_status' => 'present',
            'is_paid' => true,
            'check_in' => $this->localTime($first),
            'check_out' => $last ? $this->localTime($last) : null,
            'source' => 'biometric',
            'external_reference' => 'DEVICE-'.$event->attendance_device_id.'-'.$date,
            'approval_status' => 'pending',
            'approved_by' => null,
            'approved_at' => null,
            'rejection_reason' => null,
            'notes' => $last
                ? 'Generated from electronic attendance punches.'
                : 'One device punch received; check-out is still missing.',
        ]);
        $record->attendance_date = $date;
        $this->attendance->recalculate($record, $employee)->save();

        AttendanceDeviceEvent::query()
            ->whereIn('id', $events->pluck('id'))
            ->update([
                'attendance_record_id' => $record->id,
                'status' => 'processed',
                'processed_at' => now(),
                'error_message' => null,
            ]);
    }

    private function normalizePunch(AttendanceDevice $device, array $punch, string $source): array
    {
        $deviceUserId = $this->firstValue($punch, [
            'device_user_id', 'deviceUserId', 'user_id', 'userId', 'userid', 'pin',
            'employee_number', 'enroll_number', 'enrollNumber', 'ac_no', 'uid',
        ]);
        if ($deviceUserId === null || trim((string) $deviceUserId) === '') {
            throw new \InvalidArgumentException('Device User ID is missing.');
        }

        $timestamp = $this->firstValue($punch, [
            'occurred_at', 'timestamp', 'date_time', 'datetime', 'record_time', 'recordTime',
            'att_time', 'attTime', 'punch_time', 'check_time',
        ]);
        if (! $timestamp) {
            $date = $this->firstValue($punch, ['attendance_date', 'date', 'punch_date']);
            $time = $this->firstValue($punch, ['time', 'attendance_time', 'clock_time']);
            $timestamp = $date && $time ? "{$date} {$time}" : null;
        }
        if (! $timestamp) {
            throw new \InvalidArgumentException('Punch date and time are missing.');
        }

        try {
            $localTime = Carbon::parse($timestamp, $device->timezone ?: config('attendance-devices.default_timezone'));
        } catch (Throwable) {
            throw new \InvalidArgumentException('Punch date and time could not be read. Use YYYY-MM-DD HH:MM:SS.');
        }
        $localTime->setTimezone($device->timezone ?: config('attendance-devices.default_timezone'));

        $state = $this->firstValue($punch, ['punch_state', 'state', 'status', 'type']);
        $verification = $this->verificationType($this->firstValue($punch, [
            'verification_type', 'verification', 'verify_mode', 'verifyMode', 'method',
        ]));
        $externalId = $this->firstValue($punch, ['event_uid', 'event_id', 'record_id', 'transaction_id', 'id']);
        $fingerprint = implode('|', [
            $device->id,
            trim((string) $deviceUserId),
            $localTime->copy()->utc()->format('Y-m-d H:i:s'),
            trim((string) $state),
            $externalId === null ? '' : trim((string) $externalId),
        ]);

        return [
            'event_uid' => hash('sha256', $fingerprint),
            'device_user_id' => trim((string) $deviceUserId),
            'device_user_name' => ($name = $this->firstValue($punch, ['device_user_name', 'user_name', 'name'])) ? trim((string) $name) : null,
            'attendance_date' => $localTime->toDateString(),
            'occurred_at' => $localTime->copy()->utc()->format('Y-m-d H:i:s'),
            'verification_type' => $verification,
            'punch_state' => $state === null ? null : substr(trim((string) $state), 0, 30),
            'source' => $source,
            'status' => 'unmatched',
            'raw_payload' => $this->safePayload($punch),
        ];
    }

    private function firstValue(array $data, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $data) && $data[$key] !== null && $data[$key] !== '') {
                return $data[$key];
            }
        }

        return null;
    }

    private function verificationType(mixed $value): string
    {
        $normalized = strtolower(trim((string) ($value ?? '')));
        foreach (['face', 'fingerprint', 'card', 'pin', 'password'] as $method) {
            if (str_contains($normalized, $method)) {
                return $method === 'password' ? 'pin' : $method;
            }
        }

        return $normalized === '' ? 'unknown' : substr('mode_'.$normalized, 0, 30);
    }

    private function localTime(?AttendanceDeviceEvent $event): ?string
    {
        if (! $event) {
            return null;
        }

        $timezone = $event->device?->timezone ?: config('attendance-devices.default_timezone');

        return $event->occurred_at->copy()->setTimezone($timezone)->format('H:i:s');
    }

    private function matchesApprovedTime(AttendanceDeviceEvent $event, AttendanceRecord $record): bool
    {
        $time = $this->localTime($event);

        return $time && in_array($time, [$record->check_in, $record->check_out], true);
    }

    private function markInvalid(AttendanceDeviceEvent $event, string $message): void
    {
        $event->forceFill(['status' => 'invalid', 'error_message' => $message])->save();
    }

    private function markConflict(AttendanceDeviceEvent $event, string $message): void
    {
        $event->forceFill(['status' => 'conflict', 'error_message' => $message])->save();
    }

    private function safePayload(array $payload): array
    {
        unset($payload['password'], $payload['template'], $payload['fingerprint'], $payload['face']);

        return collect($payload)
            ->except(['_row'])
            ->map(fn ($value) => is_scalar($value) || $value === null ? $value : json_encode($value))
            ->all();
    }

    private function safeMessage(Throwable $exception): string
    {
        if ($exception instanceof ValidationException) {
            return collect($exception->errors())->flatten()->first() ?: 'The punch could not be processed.';
        }

        return $exception->getMessage() ?: 'The punch could not be processed.';
    }

    private function eventRelations(): array
    {
        return [
            'device:id,name,code,timezone',
            'employee:id,employee_number,first_name,last_name,biometric_id',
            'mapping:id,device_user_id,card_number',
            'attendanceRecord:id,attendance_date,check_in,check_out,approval_status',
        ];
    }
}
