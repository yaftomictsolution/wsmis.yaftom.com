<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\BiometricImportBatch;
use App\Models\Employee;
use App\Services\AttendanceService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class BiometricAttendanceController extends Controller
{
    use AuthorizesHrRequests;

    public function __construct(private readonly AttendanceService $attendance) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);

        return response()->json(['data' => BiometricImportBatch::query()
            ->with(['importer:id,name', 'device:id,name,code'])
            ->latest()
            ->limit(50)
            ->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:10240']]);
        $file = $request->file('file');
        $path = $file->store('biometric-imports');
        $batch = BiometricImportBatch::query()->create([
            'imported_by' => $request->user()->id,
            'batch_number' => BiometricImportBatch::nextNumber(),
            'original_name' => $file->getClientOriginalName(),
            'path' => $path,
            'status' => 'processing',
        ]);

        try {
            [$total, $imported, $errors] = $this->importFile(Storage::path($path), $batch, $request->user()->id);
            $batch->update([
                'total_rows' => $total,
                'imported_rows' => $imported,
                'failed_rows' => count($errors),
                'status' => $errors ? 'completed_with_errors' : 'completed',
                'errors' => $errors ?: null,
            ]);
        } catch (Throwable $exception) {
            $batch->update(['status' => 'failed', 'errors' => [['row' => 0, 'message' => $exception->getMessage()]]]);
            throw $exception;
        }

        return response()->json(['data' => $batch->fresh()->load(['importer:id,name', 'device:id,name,code'])], 201);
    }

    public function template(Request $request): StreamedResponse
    {
        $this->authorizeHrView($request);

        return response()->streamDownload(function (): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['employee_number', 'attendance_date', 'check_in', 'check_out', 'external_reference']);
            fputcsv($handle, ['EMP-00001', now()->toDateString(), '08:00', '16:00', 'DEVICE-ROW-001']);
            fclose($handle);
        }, 'biometric-attendance-template.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function importFile(string $path, BiometricImportBatch $batch, int $userId): array
    {
        $handle = fopen($path, 'r');
        if (! $handle) {
            throw ValidationException::withMessages(['file' => ['The uploaded CSV file could not be opened.']]);
        }
        $headers = fgetcsv($handle);
        if (! $headers) {
            fclose($handle);
            throw ValidationException::withMessages(['file' => ['The CSV file is empty.']]);
        }
        $headers = array_map(fn ($header): string => str_replace(' ', '_', strtolower(trim((string) $header, "\xEF\xBB\xBF \t\n\r\0\x0B"))), $headers);
        foreach (['employee_number', 'attendance_date', 'check_in', 'check_out'] as $required) {
            if (! in_array($required, $headers, true)) {
                fclose($handle);
                throw ValidationException::withMessages(['file' => ["Missing required CSV column: {$required}."]]);
            }
        }

        $total = 0;
        $imported = 0;
        $errors = [];
        while (($values = fgetcsv($handle)) !== false) {
            if (count(array_filter($values, fn ($value): bool => trim((string) $value) !== '')) === 0) {
                continue;
            }
            $total++;
            $rowNumber = $total + 1;
            $values = array_pad($values, count($headers), null);
            $row = array_combine($headers, array_slice($values, 0, count($headers)));
            try {
                $employee = Employee::query()
                    ->where('employee_number', trim((string) $row['employee_number']))
                    ->orWhere('biometric_id', trim((string) $row['employee_number']))
                    ->firstOrFail();
                $date = $this->date((string) $row['attendance_date']);
                abort_if($date->isFuture(), 422, 'Attendance date cannot be in the future.');
                $existing = AttendanceRecord::query()->where('employee_id', $employee->id)->whereDate('attendance_date', $date)->first();
                abort_if($existing?->approval_status === 'approved', 422, 'Approved attendance already exists for this employee and date.');
                $record = $existing ?: new AttendanceRecord([
                    'employee_id' => $employee->id,
                    'attendance_date' => $date->toDateString(),
                ]);
                $record->fill([
                    'biometric_import_batch_id' => $batch->id,
                    'recorded_by' => $userId,
                    'attendance_status' => 'present',
                    'is_paid' => true,
                    'check_in' => $this->time((string) $row['check_in']),
                    'check_out' => $this->time((string) $row['check_out']),
                    'source' => 'biometric',
                    'external_reference' => trim((string) ($row['external_reference'] ?? '')) ?: null,
                    'approval_status' => 'pending',
                    'approved_by' => null,
                    'approved_at' => null,
                    'rejection_reason' => null,
                ]);
                $record->attendance_date = $date->toDateString();
                $this->attendance->recalculate($record, $employee)->save();
                $imported++;
            } catch (Throwable $exception) {
                $errors[] = ['row' => $rowNumber, 'message' => $exception->getMessage()];
            }
        }
        fclose($handle);

        return [$total, $imported, array_slice($errors, 0, 100)];
    }

    private function date(string $value): Carbon
    {
        $date = Carbon::createFromFormat('Y-m-d', trim($value));
        if (! $date || $date->format('Y-m-d') !== trim($value)) {
            throw new \InvalidArgumentException('Attendance date must use YYYY-MM-DD.');
        }

        return $date->startOfDay();
    }

    private function time(string $value): string
    {
        foreach (['H:i', 'H:i:s'] as $format) {
            $time = Carbon::createFromFormat($format, trim($value));
            if ($time && $time->format($format) === trim($value)) {
                return $time->format('H:i:s');
            }
        }

        throw new \InvalidArgumentException('Check-in and check-out must use HH:MM.');
    }
}
