<?php

namespace App\Http\Middleware;

use App\Services\BusinessClock;
use Carbon\Carbon as BaseCarbon;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

class ApplyTrainingBusinessClock
{
    public function __construct(private readonly BusinessClock $clock) {}

    public function handle(Request $request, Closure $next): Response
    {
        $simulatedNow = $this->clock->simulatedNow();
        if (! $simulatedNow) {
            return $next($request);
        }

        Carbon::setTestNow($simulatedNow);
        BaseCarbon::setTestNow($simulatedNow);
        CarbonImmutable::setTestNow($simulatedNow->toImmutable());

        try {
            $response = $next($request);
            $response->headers->set('X-WSMIS-Environment', 'training');
            $response->headers->set('X-WSMIS-Business-Date', $simulatedNow->toDateString());

            return $response;
        } finally {
            Carbon::setTestNow();
            BaseCarbon::setTestNow();
            CarbonImmutable::setTestNow();
        }
    }
}
