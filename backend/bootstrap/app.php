<?php

use App\Console\Commands\InitializeSync;
use App\Console\Commands\ProvisionFreshLocalSync;
use App\Console\Commands\RebaselineLocalSync;
use App\Console\Commands\RegisterSyncDevice;
use App\Console\Commands\ResetCloudSyncBaseline;
use App\Http\Middleware\ApplyTrainingBusinessClock;
use App\Http\Middleware\EnforceSyncWriterLease;
use App\Http\Middleware\VerifySyncDevice;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withCommands([
        InitializeSync::class,
        ProvisionFreshLocalSync::class,
        RebaselineLocalSync::class,
        RegisterSyncDevice::class,
        ResetCloudSyncBaseline::class,
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'sync.device' => VerifySyncDevice::class,
        ]);
        $middleware->appendToGroup('api', EnforceSyncWriterLease::class);
        $middleware->appendToGroup('api', ApplyTrainingBusinessClock::class);
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson()
        );

        $exceptions->render(
            fn (AuthenticationException $exception, Request $request) => response()->json(['message' => 'Unauthenticated.'], 401)
        );
    })->create();
