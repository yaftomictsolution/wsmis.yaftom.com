<?php

namespace Database\Seeders;

use App\Http\Controllers\Api\CustomerContractController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\CustomerDocumentController;
use App\Http\Controllers\Api\CustomerOperationsController;
use App\Http\Controllers\Api\MeterAssignmentController;
use App\Http\Controllers\Api\MeterReadingController;
use App\Http\Controllers\Api\PaymentController;
use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\BillingPeriod;
use App\Models\Customer;
use App\Models\CustomerCharge;
use App\Models\CustomerChargeType;
use App\Models\CustomerContract;
use App\Models\CustomerServiceRequest;
use App\Models\Employee;
use App\Models\Invoice;
use App\Models\Meter;
use App\Models\MeterAssignment;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\ServiceArea;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class BillingWorkflowDemoSeeder extends Seeder
{
    private const CUSTOMER_CODES = ['TEST-SUB-0001', 'TEST-SUB-0002', 'TEST-SUB-0003'];

    public function run(): void
    {
        $references = $this->bootstrapReferenceData();

        if (! Customer::query()->where('subscription_code', self::CUSTOMER_CODES[0])->exists()) {
            DB::transaction(fn () => $this->createPartialPaymentScenario($references));
        }

        if (! Customer::query()->where('subscription_code', self::CUSTOMER_CODES[1])->exists()) {
            DB::transaction(fn () => $this->createPaidReplacementScenario($references));
        }

        if (! Customer::query()->where('subscription_code', self::CUSTOMER_CODES[2])->exists()) {
            DB::transaction(fn () => $this->createOutstandingScenario($references));
        }

        $summary = $this->verifyDemoData();
        $this->command?->info('Invoice-first billing demo records are ready and reconciled.');
        $this->command?->table(
            ['Customer', 'Contract', 'Invoices', 'Payments', 'Balance'],
            $summary,
        );
        $this->command?->line('Demo logins use password: password');
    }

    private function bootstrapReferenceData(): array
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        DB::table('model_has_roles')
            ->where('model_type', User::class)
            ->whereNotIn('model_id', User::query()->select('id'))
            ->delete();
        DB::table('model_has_permissions')
            ->where('model_type', User::class)
            ->whereNotIn('model_id', User::query()->select('id'))
            ->delete();
        DB::table('personal_access_tokens')
            ->where('tokenable_type', User::class)
            ->whereNotIn('tokenable_id', User::query()->select('id'))
            ->delete();

        $modules = [
            'dashboard', 'users', 'roles', 'settings', 'service-areas', 'customers',
            'customer-contracts', 'meters', 'meter-assignments',
            'billing-periods', 'meter-readings', 'invoices', 'payments', 'accounting',
            'suppliers', 'supplier-contracts', 'finance-transactions', 'payroll',
            'shareholders', 'reconciliation', 'financial-closing', 'financial-reports',
        ];
        foreach ($modules as $module) {
            foreach (['view', 'create', 'update', 'delete'] as $action) {
                Permission::query()->firstOrCreate([
                    'name' => "{$module}.{$action}",
                    'guard_name' => 'web',
                ]);
            }
        }

        Permission::query()->firstOrCreate([
            'name' => 'customer-deposits.view',
            'guard_name' => 'web',
        ]);

        $adminRole = Role::findOrCreate('Admin', 'web');
        $managerRole = Role::findOrCreate('Manager', 'web');
        $collectorRole = Role::findOrCreate('Collector', 'web');
        $technicianRole = Role::findOrCreate('Technician', 'web');
        $meterAssignerRole = Role::findOrCreate('Meter Assigner', 'web');
        $readerRole = Role::findOrCreate('Meter Reader', 'web');
        $adminRole->givePermissionTo(Permission::query()->get());
        $managerRole->givePermissionTo(Permission::query()->whereIn('name', [
            'dashboard.view', 'customers.view', 'customers.create', 'customers.update',
            'customer-contracts.view', 'customer-contracts.create', 'customer-contracts.update',
            'customer-deposits.view', 'meter-assignments.view',
            'meter-assignments.create', 'meter-readings.view', 'meter-readings.create',
            'invoices.view', 'payments.view', 'payments.create', 'payments.update',
        ])->get());
        $collectorRole->givePermissionTo(Permission::query()->whereIn('name', [
            'dashboard.view', 'customers.view', 'customer-contracts.view',
            'customer-deposits.view', 'invoices.view',
            'payments.view', 'payments.create',
        ])->get());
        $technicianRole->givePermissionTo(Permission::query()->whereIn('name', [
            'dashboard.view', 'customers.view', 'meters.view', 'meter-assignments.view',
            'meter-assignments.create',
        ])->get());
        $meterAssignerRole->givePermissionTo(Permission::query()->whereIn('name', [
            'dashboard.view', 'customers.view', 'meters.view', 'meter-assignments.view',
            'meter-assignments.create', 'meter-assignments.update',
        ])->get());
        $readerRole->givePermissionTo(Permission::query()->whereIn('name', [
            'dashboard.view', 'customers.view', 'meters.view', 'meter-assignments.view',
            'billing-periods.view', 'meter-readings.view', 'meter-readings.create',
        ])->get());

        $users = [
            'admin' => $this->demoUser('WaterNet Demo Admin', 'admin@waternet.local', '0799000000', $adminRole),
            'manager' => $this->demoUser('WaterNet Demo Manager', 'manager@waternet.local', '0799000001', $managerRole),
            'collector' => $this->demoUser('WaterNet Demo Collector', 'collector@waternet.local', '0799000002', $collectorRole),
            'technician' => $this->demoUser('WaterNet Demo Technician', 'technician@waternet.local', '0799000003', $technicianRole),
            'reader' => $this->demoUser('WaterNet Demo Reader', 'reader@waternet.local', '0799000004', $readerRole),
        ];
        $users['technician']->assignRole($meterAssignerRole);
        Employee::query()->updateOrCreate(
            ['user_id' => $users['technician']->id],
            [
                'employee_number' => 'EMP-METER-ASSIGNER-DEMO',
                'first_name' => 'WaterNet Demo',
                'last_name' => 'Technician',
                'email' => $users['technician']->email,
                'hire_date' => '2026-01-01',
                'employment_type' => 'permanent',
                'salary_type' => 'fixed',
                'base_salary' => 18000,
                'standard_daily_hours' => 8,
                'work_start_time' => '08:00',
                'work_end_time' => '16:00',
                'work_days' => [1, 2, 3, 4, 5, 6],
                'status' => 'active',
            ],
        );

        SystemSetting::query()->updateOrCreate(
            ['key' => 'system_profile'],
            ['value' => [
                'company_name' => 'WaterNet MIS',
                'system_name' => 'Water Supply Management Information System',
                'currency' => 'AFN',
                'language' => 'en',
                'calendar_system' => 'shamsi',
                'show_gregorian_secondary' => false,
                'phone' => '0799000000',
                'address' => 'Kabul, Afghanistan',
            ]],
        );

        $cashMethod = PaymentMethod::query()->updateOrCreate(
            ['code' => 'cash'],
            ['name' => 'Cash', 'status' => 'active'],
        );
        $bankMethod = PaymentMethod::query()->updateOrCreate(
            ['code' => 'bank_transfer'],
            ['name' => 'Bank Transfer', 'status' => 'active'],
        );
        PaymentMethod::query()->updateOrCreate(
            ['code' => 'mobile_money'],
            ['name' => 'Mobile Money', 'status' => 'active'],
        );

        $cashAccount = AccountingAccount::query()->firstOrCreate(
            ['code' => 'test_cash_on_hand'],
            [
                'name' => 'TEST Cash on Hand', 'type' => 'cash',
                'opening_balance' => 10000, 'current_balance' => 10000,
                'status' => 'active', 'notes' => 'Account used by invoice-first demo records.',
            ],
        );
        $cashAccount->update(['name' => 'TEST Cash on Hand', 'type' => 'cash', 'status' => 'active']);
        $bankAccount = AccountingAccount::query()->firstOrCreate(
            ['code' => 'test_bank_account'],
            [
                'name' => 'TEST Bank Account', 'type' => 'bank',
                'opening_balance' => 25000, 'current_balance' => 25000,
                'status' => 'active', 'notes' => 'Account used by invoice-first demo records.',
            ],
        );
        $bankAccount->update(['name' => 'TEST Bank Account', 'type' => 'bank', 'status' => 'active']);

        $area = ServiceArea::query()->updateOrCreate(
            ['name' => 'TEST Billing Zone'],
            [
                'mosque_name' => 'TEST Central Mosque', 'district' => 'District 4',
                'street_block_village' => 'TEST Block A', 'representative_name' => 'TEST Representative',
                'representative_phone' => '0797000000', 'households_count' => 20,
                'rate_per_cubic_meter' => 65, 'status' => 'active',
                'notes' => 'Dedicated area for repeatable invoice-first workflow demonstrations.',
            ],
        );
        $mosque = $area->mosques()->updateOrCreate(
            ['name' => 'TEST Central Mosque'],
            ['status' => 'active'],
        );
        $period = BillingPeriod::query()->updateOrCreate(
            ['code' => 'TEST-2026-07'],
            [
                'name' => 'TEST July 2026', 'starts_on' => '2026-07-01',
                'ends_on' => '2026-07-31', 'status' => 'open',
                'locked_at' => null, 'notes' => 'Open period used by demo meter readings.',
            ],
        );
        $serviceType = CustomerChargeType::query()->updateOrCreate(
            ['code' => 'test_service_fee'],
            [
                'name' => 'TEST Service Fee', 'description' => 'General demo service charge.',
                'status' => 'active', 'is_system' => false,
            ],
        );

        return $users + compact(
            'cashMethod', 'bankMethod', 'cashAccount', 'bankAccount',
            'area', 'mosque', 'period', 'serviceType',
        );
    }

    private function demoUser(string $name, string $email, string $phone, Role $role): User
    {
        $user = User::query()->updateOrCreate(
            ['email' => $email],
            ['name' => $name, 'phone' => $phone, 'password' => 'password', 'status' => 'active'],
        );
        $user->syncRoles([$role]);

        return $user;
    }

    private function request(User $user, array $data = [], array $files = [], string $method = 'POST'): Request
    {
        $request = Request::create('/api/demo-workflow', $method, $data, [], $files, [
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    private function responseData(JsonResponse $response, int $expectedStatus): array
    {
        if ($response->getStatusCode() !== $expectedStatus) {
            throw new RuntimeException("Unexpected demo API status {$response->getStatusCode()}: {$response->getContent()}");
        }

        return $response->getData(true)['data'] ?? [];
    }

    private function createPartialPaymentScenario(array $references): void
    {
        $customer = $this->createCustomer($references['manager'], [
            'service_area_id' => $references['area']->id,
            'service_area_mosque_id' => $references['mosque']->id,
            'subscription_code' => self::CUSTOMER_CODES[0],
            'name' => 'TEST Ahmad',
            'last_name' => 'Rahimi',
            'father_name' => 'TEST Karim',
            'grandfather_name' => 'TEST Abdul',
            'phone' => '0797001001',
            'secondary_phone' => '0797002001',
            'tazkira_number' => 'TEST-TAZKIRA-1001',
            'house_number' => 'TEST-H-01',
            'street_number' => 'TEST-S-01',
            'current_residence' => 'Kabul',
            'address' => 'TEST Billing Zone, House 1',
            'notes' => 'Demo customer intentionally left with partially paid contract and water invoices.',
        ]);
        $contract = $this->createContract($customer, $references['manager'], [
            'subscription_date' => '2026-07-18',
            'meter_size' => 'Half inch',
            'connection_fee' => 1000,
            'meter_fee' => 500,
            'discount_amount' => 0,
            'notes' => 'TEST contract confirmed without collecting money in advance.',
        ]);
        $contract = $this->confirmContract($contract, $references['manager']);
        $meter = $this->createMeter($references['admin'], 'TEST-MTR-0001');
        $assignment = $this->installMeter(
            $customer,
            $contract,
            $meter,
            $references['technician'],
            'TEST-SEAL-0001',
        );
        $waterInvoice = $this->recordReading(
            $assignment,
            $references['period'],
            $references['reader'],
            12,
        );
        $serviceInvoice = $this->addCharge(
            $customer,
            $references['serviceType'],
            $references['manager'],
            'TEST Leak inspection service',
            150,
        );
        $this->addServiceRequest(
            $customer,
            $references['manager'],
            $references['technician'],
            'low_pressure',
            'normal',
            'TEST customer reports low pressure during evening hours.',
        );

        $contractInvoice = $contract->invoice()->firstOrFail();
        $this->postPayment($customer, $references['collector'], [
            'payment_method_id' => $references['cashMethod']->id,
            'accounting_account_id' => $references['cashAccount']->id,
            'paid_at' => '2026-07-18',
            'reference' => 'TEST-PAY-0001',
            'notes' => 'One receipt allocated across contract, water, and service invoices.',
            'items' => [
                ['type' => 'invoice', 'id' => $contractInvoice->id, 'amount' => 800],
                ['type' => 'invoice', 'id' => $waterInvoice->id, 'amount' => 500],
                ['type' => 'invoice', 'id' => $serviceInvoice->id, 'amount' => 150],
            ],
        ]);
        $this->uploadDocument($customer, $references['manager'], 'TEST-customer-0001.txt');
    }

    private function createPaidReplacementScenario(array $references): void
    {
        $customer = $this->createCustomer($references['manager'], [
            'service_area_id' => $references['area']->id,
            'service_area_mosque_id' => $references['mosque']->id,
            'subscription_code' => self::CUSTOMER_CODES[1],
            'name' => 'TEST Laila',
            'last_name' => 'Noori',
            'father_name' => 'TEST Noor',
            'grandfather_name' => 'TEST Wahid',
            'phone' => '0797001002',
            'secondary_phone' => '0797002002',
            'tazkira_number' => 'TEST-TAZKIRA-1002',
            'house_number' => 'TEST-H-02',
            'street_number' => 'TEST-S-02',
            'current_residence' => 'Kabul',
            'address' => 'TEST Billing Zone, House 2',
            'notes' => 'Fully paid demo customer with meter replacement and connection history.',
        ]);
        $contract = $this->createContract($customer, $references['manager'], [
            'subscription_date' => '2026-07-18',
            'meter_size' => 'Half inch',
            'connection_fee' => 800,
            'meter_fee' => 400,
            'discount_amount' => 0,
            'notes' => 'TEST contract paid after meter installation.',
        ]);
        $contract = $this->confirmContract($contract, $references['manager']);
        $firstMeter = $this->createMeter($references['admin'], 'TEST-MTR-0002-A');
        $firstAssignment = $this->installMeter(
            $customer,
            $contract,
            $firstMeter,
            $references['technician'],
            'TEST-SEAL-0002-A',
        );
        $waterInvoice = $this->recordReading(
            $firstAssignment,
            $references['period'],
            $references['reader'],
            8,
        );
        $serviceInvoice = $this->addCharge(
            $customer,
            $references['serviceType'],
            $references['manager'],
            'TEST New booklet service',
            250,
        );
        $disconnectionInvoice = $this->addConnectionFee(
            $customer,
            $references['manager'],
            'disconnection',
            100,
        );
        $reconnectionInvoice = $this->addConnectionFee(
            $customer,
            $references['manager'],
            'reconnection',
            200,
        );
        $this->addServiceRequest(
            $customer,
            $references['manager'],
            $references['technician'],
            'meter_problem',
            'high',
            'TEST meter glass is damaged and requires replacement.',
        );

        $contractInvoice = $contract->invoice()->firstOrFail();
        $cancelledPayment = $this->postPayment($customer, $references['collector'], [
            'payment_method_id' => $references['bankMethod']->id,
            'accounting_account_id' => $references['bankAccount']->id,
            'paid_at' => '2026-07-18',
            'reference' => 'TEST-CANCEL-0001',
            'items' => [
                ['type' => 'invoice', 'id' => $contractInvoice->id, 'amount' => 100],
            ],
        ]);
        $this->responseData(
            app(PaymentController::class)->update(
                $this->request($references['manager'], [
                    'status' => 'cancelled',
                    'notes' => 'TEST cancellation verifies invoice and account restoration.',
                ], method: 'PUT'),
                $cancelledPayment,
            ),
            200,
        );

        $secondMeter = $this->createMeter($references['admin'], 'TEST-MTR-0002-B');
        $this->installMeter(
            $customer,
            $contract->fresh(),
            $secondMeter,
            $references['technician'],
            'TEST-SEAL-0002-B',
        );

        $this->postPayment($customer, $references['collector'], [
            'payment_method_id' => $references['bankMethod']->id,
            'accounting_account_id' => $references['bankAccount']->id,
            'paid_at' => '2026-07-18',
            'reference' => 'TEST-PAY-0002',
            'notes' => 'Full payment across all outstanding invoice types.',
            'items' => [
                ['type' => 'invoice', 'id' => $contractInvoice->id],
                ['type' => 'invoice', 'id' => $waterInvoice->id],
                ['type' => 'invoice', 'id' => $serviceInvoice->id],
                ['type' => 'invoice', 'id' => $disconnectionInvoice->id],
                ['type' => 'invoice', 'id' => $reconnectionInvoice->id],
            ],
        ]);
        $this->uploadDocument($customer, $references['manager'], 'TEST-customer-0002.txt');
    }

    private function createOutstandingScenario(array $references): void
    {
        $customer = $this->createCustomer($references['manager'], [
            'service_area_id' => $references['area']->id,
            'service_area_mosque_id' => $references['mosque']->id,
            'subscription_code' => self::CUSTOMER_CODES[2],
            'name' => 'TEST Mariam',
            'last_name' => 'Azizi',
            'father_name' => 'TEST Hamid',
            'grandfather_name' => 'TEST Rahmat',
            'phone' => '0797001003',
            'secondary_phone' => '0797002003',
            'tazkira_number' => 'TEST-TAZKIRA-1003',
            'house_number' => 'TEST-H-03',
            'street_number' => 'TEST-S-03',
            'current_residence' => 'Kabul',
            'address' => 'TEST Billing Zone, House 3',
            'notes' => 'Outstanding demo customer used to verify receivables and overdue workflows.',
        ]);
        $contract = $this->confirmContract(
            $this->createContract($customer, $references['manager'], [
                'subscription_date' => '2026-07-18',
                'meter_size' => 'Half inch',
                'connection_fee' => 1200,
                'meter_fee' => 600,
                'discount_amount' => 0,
                'notes' => 'TEST contract with a remaining balance after partial payment.',
            ]),
            $references['manager'],
        );
        $assignment = $this->installMeter(
            $customer,
            $contract,
            $this->createMeter($references['admin'], 'TEST-MTR-0003'),
            $references['technician'],
            'TEST-SEAL-0003',
        );
        $waterInvoice = $this->recordReading($assignment, $references['period'], $references['reader'], 5);
        $disconnectionInvoice = $this->addConnectionFee(
            $customer,
            $references['manager'],
            'disconnection',
            100,
        );
        $this->addServiceRequest(
            $customer,
            $references['manager'],
            $references['technician'],
            'leak',
            'urgent',
            'TEST visible pipe leak awaiting technician inspection.',
        );
        $this->postPayment($customer, $references['collector'], [
            'payment_method_id' => $references['cashMethod']->id,
            'accounting_account_id' => $references['cashAccount']->id,
            'paid_at' => '2026-07-18',
            'reference' => 'TEST-PAY-0003',
            'notes' => 'Partial contract payment leaves all other invoices outstanding.',
            'items' => [
                ['type' => 'invoice', 'id' => $contract->invoice()->firstOrFail()->id, 'amount' => 500],
            ],
        ]);
        $this->assertDemo((float) $waterInvoice->fresh()->remaining_amount === 325.0, 'Third customer water invoice must remain unpaid.');
        $this->assertDemo((float) $disconnectionInvoice->fresh()->remaining_amount === 100.0, 'Third customer disconnection invoice must remain unpaid.');
        $this->uploadDocument($customer, $references['manager'], 'TEST-customer-0003.txt');
    }

    private function createCustomer(User $user, array $data): Customer
    {
        $demoSubscriptionCode = $data['subscription_code'] ?? null;
        $response = app(CustomerController::class)->store($this->request($user, $data));
        $created = $this->responseData($response, 201);
        $customer = Customer::query()->findOrFail($created['id']);

        // Customer codes are generated by the application. Demo records keep stable
        // TEST codes afterward so repeated seed runs can locate the same scenarios.
        if (is_string($demoSubscriptionCode) && $demoSubscriptionCode !== '') {
            $customer->update(['subscription_code' => $demoSubscriptionCode]);
        }

        return $customer->fresh();
    }

    private function createContract(Customer $customer, User $user, array $data): CustomerContract
    {
        $response = app(CustomerContractController::class)->store($this->request($user, $data), $customer);
        $created = $this->responseData($response, 201);

        return CustomerContract::query()->findOrFail($created['id']);
    }

    private function confirmContract(CustomerContract $contract, User $manager): CustomerContract
    {
        $this->responseData(
            app(CustomerContractController::class)->confirm($this->request($manager), $contract),
            200,
        );

        return $contract->fresh();
    }

    private function createMeter(User $user, string $number): Meter
    {
        return Meter::query()->updateOrCreate(
            ['meter_number' => $number],
            [
                'type' => 'Mechanical',
                'status' => 'available',
                'purchased_at' => '2026-07-01',
                'condition_notes' => 'TEST opening-stock meter for the invoice-first workflow.',
            ],
        );
    }

    private function installMeter(
        Customer $customer,
        CustomerContract $contract,
        Meter $meter,
        User $technician,
        string $sealNumber,
    ): MeterAssignment {
        $meterAssignerId = Employee::query()
            ->where('user_id', $technician->id)
            ->where('status', 'active')
            ->value('id');
        throw_unless($meterAssignerId, RuntimeException::class, 'The demo Meter Assigner employee is missing.');

        $created = $this->responseData(
            app(MeterAssignmentController::class)->store($this->request($technician, [
                'customer_id' => $customer->id,
                'customer_contract_id' => $contract->id,
                'meter_id' => $meter->id,
                'meter_assigner_id' => $meterAssignerId,
                'initial_reading' => 0,
                'installation_date' => '2026-07-18',
                'seal_number' => $sealNumber,
                'sealed_at' => '2026-07-18',
                'seal_notes' => 'TEST seal recorded by the authenticated installer.',
            ])),
            201,
        );

        return MeterAssignment::query()->findOrFail($created['id']);
    }

    private function recordReading(
        MeterAssignment $assignment,
        BillingPeriod $period,
        User $reader,
        float $currentReading,
    ): Invoice {
        $created = $this->responseData(
            app(MeterReadingController::class)->store($this->request($reader, [
                'billing_period_id' => $period->id,
                'meter_assignment_id' => $assignment->id,
                'reading_date' => '2026-07-18',
                'current_reading' => $currentReading,
                'due_date' => '2026-08-02',
                'status' => 'recorded',
                'notes' => 'TEST reading recorded by the authenticated meter reader.',
            ])),
            201,
        );

        return Invoice::query()->where('meter_reading_id', $created['id'])->firstOrFail();
    }

    private function addCharge(
        Customer $customer,
        CustomerChargeType $type,
        User $user,
        string $title,
        float $amount,
    ): Invoice {
        $created = $this->responseData(
            app(CustomerOperationsController::class)->storeCharge($this->request($user, [
                'customer_charge_type_id' => $type->id,
                'title' => $title,
                'amount' => $amount,
                'charge_date' => '2026-07-18',
                'notes' => 'TEST charge converted to a payable invoice automatically.',
            ]), $customer),
            201,
        );

        return CustomerCharge::query()->findOrFail($created['id'])->invoice()->firstOrFail();
    }

    private function addConnectionFee(Customer $customer, User $user, string $eventType, float $fee): Invoice
    {
        $dateField = $eventType === 'disconnection' ? 'disconnected_at' : 'reconnected_at';
        $created = $this->responseData(
            app(CustomerOperationsController::class)->storeConnectionEvent($this->request($user, [
                'event_type' => $eventType,
                'reason' => "TEST {$eventType} workflow.",
                'fee' => $fee,
                'status' => 'completed',
                $dateField => '2026-07-18',
                'notes' => 'TEST event fee converted to an invoice automatically.',
            ]), $customer),
            201,
        );

        return CustomerCharge::query()->findOrFail($created['charge']['id'])->invoice()->firstOrFail();
    }

    private function addServiceRequest(
        Customer $customer,
        User $creator,
        User $technician,
        string $type,
        string $priority,
        string $description,
    ): void {
        $this->responseData(
            app(CustomerOperationsController::class)->storeServiceRequest($this->request($creator, [
                'assigned_to' => $technician->id,
                'type' => $type,
                'priority' => $priority,
                'description' => $description,
                'requested_at' => '2026-07-18 09:00:00',
            ]), $customer),
            201,
        );
    }

    private function postPayment(Customer $customer, User $collector, array $data): Payment
    {
        $created = $this->responseData(
            app(PaymentController::class)->store($this->request($collector, $data + [
                'customer_id' => $customer->id,
            ])),
            201,
        );

        return Payment::query()->findOrFail($created['id']);
    }

    private function uploadDocument(Customer $customer, User $user, string $name): void
    {
        $file = UploadedFile::fake()->createWithContent(
            $name,
            "TEST customer attachment for {$customer->subscription_code}.\n",
        );
        $this->responseData(
            app(CustomerDocumentController::class)->store(
                $this->request(
                    $user,
                    ['document_type' => 'TEST Identity', 'notes' => 'Uploaded by demo workflow.'],
                    ['documents' => [$file]],
                ),
                $customer,
            ),
            201,
        );
    }

    private function verifyDemoData(): array
    {
        $customers = Customer::query()
            ->whereIn('subscription_code', self::CUSTOMER_CODES)
            ->orderBy('subscription_code')
            ->get();
        $this->assertDemo($customers->count() === 3, 'Expected exactly three demo customers.');

        $customerIds = $customers->pluck('id');
        $invoices = Invoice::query()->whereIn('customer_id', $customerIds)->with('items')->get();
        foreach ($invoices as $invoice) {
            $lineTotal = round((float) $invoice->items->sum('amount'), 2);
            $posted = round((float) $invoice->allocations()
                ->whereHas('payment', fn ($query) => $query->where('status', 'posted'))
                ->sum('amount'), 2);
            $remaining = round(max(0, (float) $invoice->total_amount - $posted), 2);
            $this->assertClose($lineTotal, (float) $invoice->total_amount, "Invoice {$invoice->invoice_number} item total");
            $this->assertClose($posted, (float) $invoice->paid_amount, "Invoice {$invoice->invoice_number} paid amount");
            $this->assertClose($remaining, (float) $invoice->remaining_amount, "Invoice {$invoice->invoice_number} remaining amount");
        }

        foreach ($customers as $customer) {
            $invoiceBalance = (float) $customer->invoices()->where('status', '!=', 'cancelled')->sum('remaining_amount');
            $this->assertClose($invoiceBalance, (float) $customer->current_balance, "Customer {$customer->subscription_code} balance");
            $this->assertDemo($customer->contracts()->where('status', 'active')->count() === 1, "{$customer->subscription_code} must have one active contract.");
            $this->assertDemo($customer->documentFiles()->count() === 1, "{$customer->subscription_code} must have one attachment.");
            $customer->documentFiles->each(fn ($document) => $this->assertDemo(
                Storage::disk('local')->exists($document->path),
                "Missing stored attachment {$document->original_name}.",
            ));
        }

        $first = $customers->firstWhere('subscription_code', self::CUSTOMER_CODES[0]);
        $second = $customers->firstWhere('subscription_code', self::CUSTOMER_CODES[1]);
        $third = $customers->firstWhere('subscription_code', self::CUSTOMER_CODES[2]);
        $this->assertClose(980, (float) $first->current_balance, 'Partial-payment customer balance');
        $this->assertClose(0, (float) $second->current_balance, 'Fully paid customer balance');
        $this->assertClose(1725, (float) $third->current_balance, 'Outstanding customer balance');
        $this->assertDemo($first->invoices()->count() === 3, 'Partial-payment customer must have three invoices.');
        $this->assertDemo($second->invoices()->count() === 5, 'Fully paid customer must have five invoices.');
        $this->assertDemo($third->invoices()->count() === 3, 'Outstanding customer must have three invoices.');
        $this->assertDemo($second->meterAssignments()->where('status', 'replaced')->count() === 1, 'Meter replacement history is missing.');
        $this->assertDemo($second->meterAssignments()->where('status', 'active')->count() === 1, 'Replacement meter is not active.');

        $technician = User::query()->where('email', 'technician@waternet.local')->firstOrFail();
        $reader = User::query()->where('email', 'reader@waternet.local')->firstOrFail();
        $this->assertDemo(
            MeterAssignment::query()->whereIn('customer_id', $customerIds)->where('installed_by', '!=', $technician->id)->doesntExist(),
            'A demo meter installer was not taken from the authenticated technician.',
        );
        $this->assertDemo(
            DB::table('meter_readings')->whereIn('customer_id', $customerIds)->where('read_by', '!=', $reader->id)->doesntExist(),
            'A demo meter reader was not taken from the authenticated reader.',
        );
        $this->assertDemo(
            CustomerServiceRequest::query()->whereIn('customer_id', $customerIds)->where('assigned_to', $technician->id)->count() === 3,
            'All demo service requests must be assigned to the technician.',
        );

        $charges = CustomerCharge::query()->whereIn('customer_id', $customerIds)->where('status', 'posted')->get();
        foreach ($charges as $charge) {
            $this->assertDemo((bool) $charge->invoice_id, "Posted charge {$charge->id} is missing its invoice.");
            $this->assertClose((float) $charge->amount, (float) $charge->paid_amount + (float) $charge->remaining_amount, "Charge {$charge->id} balance");
        }
        $this->assertDemo(
            DB::table('payment_allocations')
                ->join('payments', 'payments.id', '=', 'payment_allocations.payment_id')
                ->whereIn('payments.customer_id', $customerIds)
                ->whereNull('payment_allocations.invoice_id')
                ->doesntExist(),
            'Every demo payment allocation must point to an invoice.',
        );
        $this->assertDemo(
            Payment::query()->whereIn('customer_id', $customerIds)->where('status', 'cancelled')->count() === 1,
            'The payment cancellation scenario is missing.',
        );

        foreach (['test_cash_on_hand' => 11950, 'test_bank_account' => 27270] as $code => $expectedBalance) {
            $account = AccountingAccount::query()->where('code', $code)->firstOrFail();
            $transactions = AccountingTransaction::query()
                ->where('accounting_account_id', $account->id)
                ->whereNotNull('posted_at')
                ->whereNull('reversed_at')
                ->get();
            $movement = $transactions->sum(fn (AccountingTransaction $transaction) => $transaction->isAccountInflow()
                ? (float) $transaction->amount
                : -(float) $transaction->amount);
            $calculated = (float) $account->opening_balance + $movement;
            $this->assertClose($calculated, (float) $account->current_balance, "Account {$code} reconciliation");
            $this->assertClose($expectedBalance, (float) $account->current_balance, "Account {$code} expected demo balance");
        }

        return $customers->map(function (Customer $customer): array {
            $contract = $customer->contracts()->latest()->firstOrFail();

            return [
                $customer->name.' '.$customer->last_name,
                $contract->contract_number.' ('.$contract->status.')',
                $customer->invoices()->count(),
                $customer->payments()->count(),
                'AFN '.number_format((float) $customer->current_balance, 2),
            ];
        })->all();
    }

    private function assertClose(float $expected, float $actual, string $label): void
    {
        $this->assertDemo(abs($expected - $actual) < 0.01, "{$label}: expected {$expected}, got {$actual}.");
    }

    private function assertDemo(bool $condition, string $message): void
    {
        if (! $condition) {
            throw new RuntimeException("Demo reconciliation failed: {$message}");
        }
    }
}
