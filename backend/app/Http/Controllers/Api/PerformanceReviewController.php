<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\PerformanceReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PerformanceReviewController extends Controller
{
    use AuthorizesHrRequests;

    public function store(Request $request, Employee $employee): JsonResponse
    {
        $this->authorizeHrView($request);
        $review = $employee->performanceReviews()->create($this->validated($request) + [
            'reviewed_by' => $request->user()->id,
            'status' => 'draft',
        ]);

        return response()->json(['data' => $review->load('reviewer:id,name')], 201);
    }

    public function update(Request $request, PerformanceReview $performanceReview): JsonResponse
    {
        $this->authorizeHrView($request);
        abort_unless($performanceReview->status === 'draft', 422, 'A finalized review cannot be edited.');
        $performanceReview->update($this->validated($request));

        return response()->json(['data' => $performanceReview->fresh()->load('reviewer:id,name')]);
    }

    public function finalize(Request $request, PerformanceReview $performanceReview): JsonResponse
    {
        $this->authorizeHrApproval($request);
        abort_unless($performanceReview->status === 'draft', 422, 'Only draft reviews can be finalized.');
        $performanceReview->update(['status' => 'finalized', 'finalized_at' => now()]);

        return response()->json(['data' => $performanceReview->fresh()->load('reviewer:id,name')]);
    }

    public function destroy(Request $request, PerformanceReview $performanceReview): JsonResponse
    {
        $this->authorizeHrApproval($request);
        abort_unless($performanceReview->status === 'draft', 422, 'A finalized review cannot be deleted.');
        $performanceReview->delete();

        return response()->json(['message' => 'Performance review deleted.']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'rating' => ['required', 'integer', 'between:1,5'],
            'achievements' => ['nullable', 'string'],
            'concerns' => ['nullable', 'string'],
            'goals' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);
    }
}
