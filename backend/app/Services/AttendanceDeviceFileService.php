<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

class AttendanceDeviceFileService
{
    public function read(string $path): array
    {
        $handle = fopen($path, 'r');
        if (! $handle) {
            throw ValidationException::withMessages(['file' => ['The attendance file could not be opened.']]);
        }

        try {
            $firstLine = fgets($handle);
            if ($firstLine === false) {
                throw ValidationException::withMessages(['file' => ['The attendance file is empty.']]);
            }
            $delimiter = $this->delimiter($firstLine);
            $headers = array_map(
                fn ($header): string => $this->header((string) $header),
                str_getcsv($firstLine, $delimiter),
            );
            $this->validateHeaders($headers);

            $rows = [];
            $rowNumber = 1;
            $maximum = (int) config('attendance-devices.maximum_import_rows', 100000);
            while (($values = fgetcsv($handle, 0, $delimiter)) !== false) {
                $rowNumber++;
                if (count(array_filter($values, fn ($value): bool => trim((string) $value) !== '')) === 0) {
                    continue;
                }
                if (count($rows) >= $maximum) {
                    throw ValidationException::withMessages([
                        'file' => ["The file has more than {$maximum} attendance rows."],
                    ]);
                }
                $values = array_pad($values, count($headers), null);
                $row = array_combine($headers, array_slice($values, 0, count($headers)));
                $row['_row'] = $rowNumber;
                $rows[] = $row;
            }

            return $rows;
        } finally {
            fclose($handle);
        }
    }

    private function delimiter(string $line): string
    {
        $counts = [
            ',' => substr_count($line, ','),
            "\t" => substr_count($line, "\t"),
            ';' => substr_count($line, ';'),
        ];
        arsort($counts);

        return (string) array_key_first($counts);
    }

    private function header(string $header): string
    {
        $header = strtolower(trim($header, "\xEF\xBB\xBF \t\n\r\0\x0B"));

        return trim((string) preg_replace('/[^a-z0-9]+/', '_', $header), '_');
    }

    private function validateHeaders(array $headers): void
    {
        $identity = ['device_user_id', 'user_id', 'userid', 'pin', 'employee_number', 'enroll_number', 'ac_no', 'uid'];
        $timestamp = ['occurred_at', 'timestamp', 'date_time', 'datetime', 'record_time', 'att_time', 'punch_time', 'check_time'];
        $dates = ['attendance_date', 'date', 'punch_date'];
        $times = ['time', 'attendance_time', 'clock_time'];

        if (! array_intersect($identity, $headers)) {
            throw ValidationException::withMessages(['file' => ['Missing a Device User ID column.']]);
        }
        if (! array_intersect($timestamp, $headers)
            && (! array_intersect($dates, $headers) || ! array_intersect($times, $headers))) {
            throw ValidationException::withMessages(['file' => ['Missing punch date and time columns.']]);
        }
    }
}
