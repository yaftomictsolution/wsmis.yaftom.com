<?php

namespace Tests\Feature;

use App\Models\AttendanceDevice;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ElectronicAttendanceDeviceTest extends TestCase
{
    use RefreshDatabase;

    public function test_simulator_creates_pending_biometric_attendance_and_ignores_duplicate_punches(): void
    {
        $hr = $this->hrUser();
        $employee = $this->employee($hr, ['biometric_id' => '1001']);
        Sanctum::actingAs($hr);

        $deviceId = $this->createDevice('simulator', 'SIM-01');
        $payload = [
            'employee_id' => $employee->id,
            'device_user_id' => '1001',
            'attendance_date' => '2026-08-20',
            'check_in' => '08:00',
            'check_out' => '16:30',
            'verification_type' => 'fingerprint',
        ];

        $this->postJson("/api/attendance-devices/{$deviceId}/simulate", $payload)
            ->assertOk()
            ->assertJsonPath('data.counts.processed', 2)
            ->assertJsonPath('data.counts.duplicates', 0);

        $record = AttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', '2026-08-20')
            ->firstOrFail();
        $this->assertSame('08:00:00', $record->check_in);
        $this->assertSame('16:30:00', $record->check_out);
        $this->assertSame('biometric', $record->source);
        $this->assertSame('pending', $record->approval_status);
        $this->assertDatabaseCount('attendance_device_events', 2);

        $this->postJson("/api/attendance-devices/{$deviceId}/simulate", $payload)
            ->assertOk()
            ->assertJsonPath('data.counts.processed', 0)
            ->assertJsonPath('data.counts.duplicates', 2);

        $this->assertDatabaseCount('attendance_device_events', 2);
        $this->assertDatabaseCount('attendance_records', 1);
    }

    public function test_usb_import_holds_unknown_device_users_for_mapping_then_processes_them(): void
    {
        $hr = $this->hrUser();
        $employee = $this->employee($hr);
        $device = AttendanceDevice::query()->create($this->deviceAttributes($hr, 'usb', 'USB-01'));
        Sanctum::actingAs($hr);

        $csv = implode("\n", [
            'device_user_id,timestamp,verification_type,punch_state,device_user_name,event_id',
            'ZK-2001,2026-08-21 08:05:00,face,check_in,Test Employee,USB-001',
            'ZK-2001,2026-08-21 16:10:00,face,check_out,Test Employee,USB-002',
        ]);

        $this->post("/api/attendance-devices/{$device->id}/import", [
            'file' => UploadedFile::fake()->createWithContent('zkteco-punches.csv', $csv),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.counts.unmatched', 2);

        $this->assertDatabaseCount('attendance_records', 0);
        $this->assertDatabaseCount('attendance_device_events', 2);
        $this->assertDatabaseHas('attendance_device_events', ['device_user_id' => 'ZK-2001', 'status' => 'unmatched']);

        $this->postJson("/api/attendance-devices/{$device->id}/mappings", [
            'employee_id' => $employee->id,
            'device_user_id' => 'ZK-2001',
            'device_user_name' => 'Test Employee',
        ])
            ->assertCreated()
            ->assertJsonPath('data.processed_events', 2)
            ->assertJsonPath('data.remaining_conflicts', 0);

        $record = AttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', '2026-08-21')
            ->firstOrFail();
        $this->assertSame('biometric', $record->source);
        $this->assertSame('pending', $record->approval_status);
        $this->assertDatabaseCount('attendance_device_events', 2);
    }

    public function test_device_punches_never_overwrite_approved_attendance(): void
    {
        $hr = $this->hrUser();
        $employee = $this->employee($hr, ['biometric_id' => '1002']);
        AttendanceRecord::query()->create([
            'employee_id' => $employee->id,
            'recorded_by' => $hr->id,
            'approved_by' => $hr->id,
            'attendance_date' => '2026-08-22',
            'check_in' => '07:45',
            'check_out' => '16:00',
            'attendance_status' => 'present',
            'is_paid' => true,
            'worked_minutes' => 495,
            'source' => 'manual',
            'approval_status' => 'approved',
            'approved_at' => now(),
        ]);
        Sanctum::actingAs($hr);

        $deviceId = $this->createDevice('simulator', 'SIM-02');
        $this->postJson("/api/attendance-devices/{$deviceId}/simulate", [
            'employee_id' => $employee->id,
            'device_user_id' => '1002',
            'attendance_date' => '2026-08-22',
            'check_in' => '08:00',
            'check_out' => '16:30',
            'verification_type' => 'face',
        ])
            ->assertOk()
            ->assertJsonPath('data.counts.conflicts', 2);

        $record = AttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', '2026-08-22')
            ->firstOrFail();
        $this->assertSame('07:45', $record->check_in);
        $this->assertSame('approved', $record->approval_status);
        $this->assertDatabaseCount('attendance_records', 1);
        $this->assertDatabaseCount('attendance_device_events', 2);
        $this->assertDatabaseHas('attendance_device_events', ['status' => 'conflict']);
    }

    private function hrUser(): User
    {
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole(Role::findOrCreate('HR', 'web'));

        return $user;
    }

    private function employee(User $user, array $overrides = []): Employee
    {
        return Employee::query()->create(array_merge([
            'created_by' => $user->id,
            'updated_by' => $user->id,
            'employee_number' => 'EMP-'.str_pad((string) (Employee::query()->count() + 1), 5, '0', STR_PAD_LEFT),
            'first_name' => 'Test',
            'last_name' => 'Employee',
            'hire_date' => '2026-01-01',
            'employment_type' => 'permanent',
            'salary_type' => 'fixed',
            'base_salary' => 10000,
            'standard_daily_hours' => 8,
            'work_start_time' => '08:00',
            'work_end_time' => '16:00',
            'work_days' => [1, 2, 3, 4, 5, 6],
            'status' => 'active',
        ], $overrides));
    }

    private function createDevice(string $mode, string $code): int
    {
        return $this->postJson('/api/attendance-devices', $this->devicePayload($mode, $code))
            ->assertCreated()
            ->json('data.id');
    }

    private function devicePayload(string $mode, string $code): array
    {
        return [
            'name' => 'Test Attendance Device',
            'code' => $code,
            'vendor' => 'ZKTeco',
            'model' => 'uFace 950',
            'serial_number' => null,
            'connection_mode' => $mode,
            'ip_address' => $mode === 'network' ? '192.168.1.201' : null,
            'port' => 4370,
            'timeout_seconds' => 8,
            'timezone' => 'Asia/Kabul',
            'status' => 'active',
        ];
    }

    private function deviceAttributes(User $user, string $mode, string $code): array
    {
        return $this->devicePayload($mode, $code) + [
            'created_by' => $user->id,
            'updated_by' => $user->id,
            'connection_status' => 'unknown',
        ];
    }
}
