<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerDocumentController extends Controller
{
    public function index(Customer $customer): JsonResponse
    {
        return response()->json([
            'data' => $customer->documentFiles()
                ->with('uploader:id,name')
                ->latest()
                ->get(),
        ]);
    }

    public function store(Request $request, Customer $customer): JsonResponse
    {
        $data = $request->validate([
            'documents' => ['required', 'array', 'min:1', 'max:10'],
            'documents.*' => ['required', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx,txt'],
            'document_type' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ], [
            'documents.max' => 'You can upload a maximum of 10 customer documents at one time.',
            'documents.*.max' => 'Each customer document must not exceed 10 MB.',
            'documents.*.mimes' => 'Customer documents must be PDF, image, Word, Excel, or text files.',
        ]);

        $documents = collect($request->file('documents', []))->map(function ($file) use ($customer, $data, $request): CustomerDocument {
            $extension = $file->getClientOriginalExtension();
            $storedName = Str::uuid()->toString().($extension ? ".{$extension}" : '');
            $path = $file->storeAs("customer-documents/{$customer->id}", $storedName, 'local');

            return $customer->documentFiles()->create([
                'uploaded_by' => $request->user()?->id,
                'document_type' => $data['document_type'] ?? null,
                'original_name' => $file->getClientOriginalName(),
                'stored_name' => $storedName,
                'path' => $path,
                'mime_type' => $file->getClientMimeType(),
                'size' => $file->getSize(),
                'notes' => $data['notes'] ?? null,
            ])->load('uploader:id,name');
        });

        return response()->json([
            'data' => $documents,
        ], 201);
    }

    public function download(CustomerDocument $customerDocument): StreamedResponse|Response
    {
        if (! Storage::disk('local')->exists($customerDocument->path)) {
            abort(404, 'Document file not found.');
        }

        return Storage::disk('local')->download(
            $customerDocument->path,
            $customerDocument->original_name,
            array_filter(['Content-Type' => $customerDocument->mime_type]),
        );
    }

    public function destroy(CustomerDocument $customerDocument): JsonResponse
    {
        Storage::disk('local')->delete($customerDocument->path);
        $customerDocument->delete();

        return response()->json(['message' => 'Customer document deleted.']);
    }
}
