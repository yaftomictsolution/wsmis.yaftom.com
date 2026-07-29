<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class EmployeeDocumentController extends Controller
{
    use AuthorizesHrRequests;

    public function store(Request $request, Employee $employee): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $request->validate([
            'documents' => ['required', 'array', 'min:1', 'max:10'],
            'documents.*' => ['file', 'mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx', 'max:10240'],
            'document_type' => ['nullable', 'string', 'max:100'],
            'expires_on' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);
        $documents = [];
        foreach ($request->file('documents', []) as $file) {
            $path = $file->store("employee-documents/{$employee->id}", 'public');
            $documents[] = $employee->documents()->create([
                'uploaded_by' => $request->user()->id,
                'document_type' => $data['document_type'] ?? 'other',
                'original_name' => $file->getClientOriginalName(),
                'stored_name' => basename($path),
                'path' => $path,
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'expires_on' => $data['expires_on'] ?? null,
                'notes' => $data['notes'] ?? null,
            ])->load('uploader:id,name');
        }

        return response()->json(['data' => $documents], 201);
    }

    public function download(Request $request, EmployeeDocument $employeeDocument)
    {
        $this->authorizeDocumentAccess($request, $employeeDocument);
        abort_unless(Storage::disk('public')->exists($employeeDocument->path), 404, 'Document file not found.');

        return Storage::disk('public')->download($employeeDocument->path, $employeeDocument->original_name);
    }

    public function destroy(Request $request, EmployeeDocument $employeeDocument): JsonResponse
    {
        $this->authorizeHrView($request);
        Storage::disk('public')->delete($employeeDocument->path);
        $employeeDocument->delete();

        return response()->json(['message' => 'Employee document deleted.']);
    }

    private function authorizeDocumentAccess(Request $request, EmployeeDocument $document): void
    {
        if (! $this->canManageHr($request)) {
            abort_unless($document->employee()->where('user_id', $request->user()?->id)->exists(), 403, 'You can only access your own documents.');
        }
    }
}
