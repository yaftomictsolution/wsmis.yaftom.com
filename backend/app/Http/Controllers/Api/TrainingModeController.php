<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BusinessClock;
use App\Services\TrainingDataResetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class TrainingModeController extends Controller
{
    public function __construct(
        private readonly BusinessClock $clock,
        private readonly TrainingDataResetService $resetter,
    ) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->clock->status($request->user())]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->authorizeManagement($request);
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'business_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01'],
        ]);

        if ($data['business_date'] > $this->clock->realDate()) {
            throw ValidationException::withMessages([
                'business_date' => ['The training business date cannot be later than the real date.'],
            ]);
        }

        $this->clock->update((bool) $data['enabled'], $data['business_date']);

        return response()->json([
            'message' => $data['enabled'] ? 'Training mode enabled.' : 'Training mode disabled.',
            'data' => $this->clock->status($request->user()),
        ]);
    }

    public function reset(Request $request): JsonResponse
    {
        $this->authorizeManagement($request);
        $this->validateResetRequest($request);

        $result = $this->resetter->reset();

        return response()->json([
            'message' => 'Training records were reset. Users, roles, permissions, and system catalogs were preserved.',
            'data' => $result + ['training_mode' => $this->clock->status($request->user())],
        ]);
    }

    public function startReset(Request $request): JsonResponse
    {
        $this->authorizeManagement($request);
        $this->validateResetRequest($request);

        return response()->json([
            'message' => 'Training data reset started.',
            'data' => $this->resetter->start((int) $request->user()->id),
        ]);
    }

    public function advanceReset(Request $request, string $operation): JsonResponse
    {
        $this->authorizeManagement($request);

        try {
            $progress = $this->resetter->advance($operation, (int) $request->user()->id);
        } catch (\RuntimeException $exception) {
            abort(409, $exception->getMessage());
        }

        return response()->json([
            'message' => $progress['status'] === 'completed'
                ? 'Training records were reset. Users, roles, permissions, and system catalogs were preserved.'
                : $progress['message'],
            'data' => $progress,
        ]);
    }

    private function validateResetRequest(Request $request): void
    {
        $data = $request->validate([
            'confirmation' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        if (! hash_equals((string) config('training.reset_confirmation'), $data['confirmation'])) {
            throw ValidationException::withMessages([
                'confirmation' => ['Type the exact reset confirmation shown on the page.'],
            ]);
        }

        if (! Hash::check($data['password'], $request->user()->password)) {
            throw ValidationException::withMessages([
                'password' => ['The password is incorrect.'],
            ]);
        }
    }

    private function authorizeManagement(Request $request): void
    {
        abort_unless($this->clock->isTrainingEnvironment(), 403, 'Training controls are disabled in production.');
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can manage training mode.');
    }
}
