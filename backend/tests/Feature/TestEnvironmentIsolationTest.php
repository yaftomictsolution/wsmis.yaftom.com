<?php

namespace Tests\Feature;

use Tests\TestCase;

class TestEnvironmentIsolationTest extends TestCase
{
    public function test_automated_tests_are_isolated_from_the_mysql_application_database(): void
    {
        $this->assertTrue(app()->environment('testing'));
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
    }
}
