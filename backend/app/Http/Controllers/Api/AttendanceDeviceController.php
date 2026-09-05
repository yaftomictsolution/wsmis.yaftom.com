<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\AttendanceDevice;
use App\Models\AttendanceDeviceEvent;
use App\Models\AttendanceDeviceMapping;
use App\Models\BiometricImportBatch;
use App\Models\Employee;
use App\Services\AttendanceDeviceFileService;
use App\Services\AttendanceDevicePunchService;
use App\Services\ZktecoDeviceGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class AttendanceDeviceController extends Controller
{
    use AuthorizesHrRequests;

    public function __construct(
        private readonly ZktecoDeviceGateway $gateway,
        private readonly AttendanceDevicePunchService $punches,
        private readonly AttendanceDeviceFileService $files,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);

        $devices = AttendanceDevice::query()
            ->withCount([
                'mappings as active_mappings_count' => fn ($query) => $query->where('status', 'active'),
                'events',
                'events as unmatched_events_count' => fn ($query) => $query->where('status', 'unmatched'),
                'events as conflict_events_count' => fn ($query) => $query->whereIn('status', ['conflict', 'invalid']),
            ])
            ->latest('id')
            ->get();

        return response()->json([
            'data' => $devices,
            'meta' => [
                'network_connector_enabled' => (bool) config('attendance-devices.network_enabled'),
                'server_mode' => config('sync.mode', 'standalone'),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $this->validatedDevice($request);
        $device = AttendanceDevice::query()->create($data + [
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
            'connection_status' => 'unknown',
        ]);

        return response()->json(['data' => $this->device($device)], 201);
    }

    public function update(Request $request, AttendanceDevice $attendanceDevice): JsonResponse
    {
        $this->authorizeHrView($request);
        $attendanceDevice->update($this->validatedDevice($request, $attendanceDevice) + [
            'updated_by' => $request->user()->id,
            'connection_status' => 'unknown',
            'last_error' => null,
        ]);

        return response()->json(['data' => $this->device($attendanceDevice->fresh())]);
    }

    public function destroy(Request $request, AttendanceDevice $attendanceDevice): JsonResponse
    {
        $this->authorizeHrView($request);
        abort_if(
            $attendanceDevice->events()->exists(),
            422,
            'A device with attendance history cannot be deleted. Set it inactive instead.',
        );
        $attendanceDevice->delete();

        return response()->json(['message' => 'Attendance device deleted.']);
    }

    public function testConnection(Request $request, AttendanceDevice $attendanceDevice): JsonResponse
    {
        $this->authorizeHrView($request);
        $details = $this->gateway->test($attendanceDevice);

        return response()->json([
            'message' => 'Attendance device is ready.',
            'data' => [
                'device' => $this->device($attendanceDevice->fresh()),
                'details' => $details,
            ],
        ]);
    }

    public function synchronize(Request $request, AttendanceDevice $attendanceDevice): JsonResponse
    {
        $this->authorizeHrView($request);
        $batch = $this->batch($attendanceDevice, $request, 'network', 'Network download');

        try {
            $download = $this->gateway->pull($attendanceDevice);
            $counts = $this->punches->ingest(
                $attendanceDevice,
                $download['punches'],
                $batch,
                $request->user()->id,
                'network',
            );
            $this->completeBatch($batch, $counts);
        } catch (Throwable $exception) {
            $batch->update([
                'status' => 'failed',
                'errors' => [['row' => 0, 'message' => $this->message($exception)]],
            ]);
            throw $exception;
        }

        return response()->json([
            'message' => $this->summaryMessage($counts),
            'data' => [
                'device' => $this->device($attendanceDevice->fresh()),
                'batch' => $batch->fresh()->load('device:id,name,code'),
                'counts' => $counts,
            ],
        ]);
    }

    public function simulate(Request $request, AttendanceDevice $attendanceDevice): JsonResponse
    {
        $this->authorizeHrView($request);
        abort_unless($attendanceDevice->connection_mode === 'simulator', 422, 'Test punches can only be created on a simulator device.');
        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'device_user_id' => ['required', 'string', 'max:120'],
            'attendance_date' => ['required', 'date'],
            'check_in' => ['required', 'date_format:H:i'],
            'check_out' => ['nullable', 'date_format:H:i', 'after:check_in'],
            'verification_type' => ['required', Rule::in(['face', 'fingerprint', 'card', 'pin'])],
        ]);
        $employee = Employee::query()->findOrFail($data['employee_id']);
        $this->punches->mapDeviceUser(
            $attendanceDevice,
            $employee,
            $data['device_user_id'],
            $employee->full_name,
            null,
            $request->user()->id,
        );
        $rows = [[
            'device_user_id' => $data['device_user_id'],
            'device_user_name' => $employee->full_name,
            'timestamp' => $data['attendance_date'].' '.$data['check_in'].':00',
            'verification_type' => $data['verification_type'],
            'punch_state' => 'check_in',
        ]];
        if (! empty($data['check_out'])) {
            $rows[] = [
                'device_user_id' => $data['device_user_id'],
                'device_user_name' => $employee->full_name,
                'timestamp' => $data['attendance_date'].' '.$data['check_out'].':00',
                'verification_type' => $data['verification_type'],
                'punch_state' => 'check_out',
            ];
        }
        $batch = $this->batch($attendanceDevice, $request, 'simulator', 'Simulator test');
        $counts = $this->punches->ingest($attendanceDevice, $rows, $batch, $request->user()->id, 'simulator');
        $this->completeBatch($batch, $counts);
        $attendanceDevice->forceFill([
            'connection_status' => 'online',
            'last_seen_at' => now(),
            'last_sync_at' => now(),
            'last_error' => null,
        ])->save();

        return response()->json([
            'message' => $this->summaryMessage($counts),
            'data' => ['batch' => $batch->fresh(), 'counts' => $counts],
        ]);
    }

    public function import(Request $request, AttendanceDevice $attendanceDevice): JsonResponse
    {
        $this->authorizeHrView($request);
        $request->validate([
            'file' => ['required', 'file', 'extensions:csv,txt,dat', 'max:20480'],
        ]);
        $file = $request->file('file');
        $path = $file->store('biometric-imports');
        $batch = $this->batch($attendanceDevice, $request, 'usb', $file->getClientOriginalName(), $path);

        try {
            $rows = $this->files->read(Storage::path($path));
            $counts = $this->punches->ingest($attendanceDevice, $rows, $batch, $request->user()->id, 'usb');
            $this->completeBatch($batch, $counts);
        } catch (Throwable $exception) {
            $batch->update([
                'status' => 'failed',
                'errors' => [['row' => 0, 'message' => $this->message($exception)]],
            ]);
            throw $exception;
        }

        return response()->json([
            'message' => $this->summaryMessage($counts),
            'data' => ['batch' => $batch->fresh()->load('device:id,name,code'), 'counts' => $counts],
        ], 201);
    }

    public function importTemplate(Request $request): StreamedResponse
    {
        $this->authorizeHrView($request);

        return response()->streamDownload(function (): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['device_user_id', 'timestamp', 'verification_type', 'punch_state', 'device_user_name', 'event_id']);
            fputcsv($handle, ['1001', now()->startOfDay()->addHours(8)->format('Y-m-d H:i:s'), 'fingerprint', 'check_in', 'Ahmad Karimi', 'DEVICE-00001']);
            fputcsv($handle, ['1001', now()->startOfDay()->addHours(16)->format('Y-m-d H:i:s'), 'fingerprint', 'check_out', 'Ahmad Karimi', 'DEVICE-00002']);
            fclose($handle);
        }, 'zkteco-raw-punch-template.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function mappings(Request $request, AttendanceDevice $attendanceDevice): JsonResponse
    {
        $this->authorizeHrView($request);

        return response()->json(['data' => $attendanceDevice->mappings()
            ->with('employee:id,employee_number,first_name,last_name,biometric_id,status')
            ->latest('id')
            ->get()]);
    }

    public function storeMapping(Request $request, AttendanceDevice $attendanceDevice): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'device_user_id' => ['required', 'string', 'max:120'],
            'device_user_name' => ['nullable', 'string', 'max:255'],
            'card_number' => ['nullable', 'string', 'max:120'],
        ]);
        $result = $this->punches->mapDeviceUser(
            $attendanceDevice,
            Employee::query()->findOrFail($data['employee_id']),
            $data['device_user_id'],
            $data['device_user_name'] ?? null,
            $data['card_number'] ?? null,
            $request->user()->id,
        );

        return response()->json([
            'message' => 'Device user mapped to employee.',
            'data' => $result,
        ], 201);
    }

    public function destroyMapping(Request $request, AttendanceDevice $attendanceDevice, AttendanceDeviceMapping $mapping): JsonResponse
    {
        $this->authorizeHrView($request);
        abort_unless($mapping->attendance_device_id === $attendanceDevice->id, 404);
        $mapping->delete();

        return response()->json(['message' => 'Device user mapping removed.']);
    }

    public function events(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $events = AttendanceDeviceEvent::query()
            ->with([
                'device:id,name,code,timezone',
                'employee:id,employee_number,first_name,last_name,biometric_id',
                'mapping:id,device_user_id,card_number',
                'attendanceRecord:id,attendance_date,check_in,check_out,approval_status',
            ])
            ->when($request->filled('device_id'), fn ($query) => $query->where('attendance_device_id', $request->integer('device_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('attendance_date', '>=', $request->input('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('attendance_date', '<=', $request->input('to')))
            ->latest('occurred_at')
            ->latest('id')
            ->limit(500)
            ->get();

        return response()->json(['data' => $events]);
    }

    public function resolveEvent(Request $request, AttendanceDeviceEvent $event): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $request->validate(['employee_id' => ['required', 'integer', 'exists:employees,id']]);
        $result = $this->punches->mapDeviceUser(
            $event->device,
            Employee::query()->findOrFail($data['employee_id']),
            $event->device_user_id,
            $event->device_user_name,
            null,
            $request->user()->id,
        );

        return response()->json(['message' => 'Punch mapped and processed.', 'data' => $result]);
    }

    public function reprocessEvent(Request $request, AttendanceDeviceEvent $event): JsonResponse
    {
        $this->authorizeHrView($request);

        return response()->json([
            'message' => 'Punch processing retried.',
            'data' => $this->punches->reprocess($event, $request->user()->id),
        ]);
    }

    public function ignoreEvent(Request $request, AttendanceDeviceEvent $event): JsonResponse
    {
        $this->authorizeHrView($request);

        return response()->json([
            'message' => 'Punch ignored.',
            'data' => $this->punches->ignore($event),
        ]);
    }

    private function validatedDevice(Request $request, ?AttendanceDevice $device = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:80', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique('attendance_devices', 'code')->ignore($device?->id)],
            'vendor' => ['required', 'string', 'max:80'],
            'model' => ['nullable', 'string', 'max:120'],
            'serial_number' => ['nullable', 'string', 'max:120'],
            'connection_mode' => ['required', Rule::in(['network', 'usb', 'simulator'])],
            'ip_address' => ['nullable', 'required_if:connection_mode,network', 'ipv4'],
            'port' => ['required', 'integer', 'between:1,65535'],
            'timeout_seconds' => ['required', 'integer', 'between:2,30'],
            'timezone' => ['required', 'timezone:all'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ]);
    }

    private function batch(
        AttendanceDevice $device,
        Request $request,
        string $source,
        string $name,
        ?string $path = null,
    ): BiometricImportBatch {
        return BiometricImportBatch::query()->create([
            'attendance_device_id' => $device->id,
            'imported_by' => $request->user()->id,
            'batch_number' => BiometricImportBatch::nextNumber(),
            'original_name' => $name,
            'path' => $path ?: "device://{$device->id}/".now()->format('YmdHis'),
            'source' => $source,
            'status' => 'processing',
        ]);
    }

    private function completeBatch(BiometricImportBatch $batch, array $counts): void
    {
        $failed = (int) $counts['invalid'] + (int) $counts['conflicts'];
        $hasIssues = $failed > 0 || (int) $counts['unmatched'] > 0 || count($counts['errors']) > 0;
        $batch->update([
            'total_rows' => $counts['total'],
            'imported_rows' => $counts['processed'],
            'skipped_rows' => $counts['duplicates'],
            'unmatched_rows' => $counts['unmatched'],
            'failed_rows' => $failed,
            'status' => $hasIssues ? 'completed_with_errors' : 'completed',
            'errors' => $counts['errors'] ?: null,
        ]);
    }

    private function device(AttendanceDevice $device): AttendanceDevice
    {
        return $device->loadCount([
            'mappings as active_mappings_count' => fn ($query) => $query->where('status', 'active'),
            'events',
            'events as unmatched_events_count' => fn ($query) => $query->where('status', 'unmatched'),
            'events as conflict_events_count' => fn ($query) => $query->whereIn('status', ['conflict', 'invalid']),
        ]);
    }

    private function summaryMessage(array $counts): string
    {
        return "Attendance sync finished: {$counts['processed']} processed, {$counts['duplicates']} duplicates skipped, {$counts['unmatched']} need employee mapping.";
    }

    private function message(Throwable $exception): string
    {
        if ($exception instanceof ValidationException) {
            return collect($exception->errors())->flatten()->first() ?: 'Attendance processing failed.';
        }

        return $exception->getMessage() ?: 'Attendance processing failed.';
    }
}
