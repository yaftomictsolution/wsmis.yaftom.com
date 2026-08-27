import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

let customerId = 0
let apiHeaders: Record<string, string> = {}

test.beforeEach(async ({ page, request }) => {
  const login = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()
  const headers = { Authorization: `Bearer ${session.token}`, Accept: 'application/json' }
  apiHeaders = headers

  const areasResponse = await request.get('http://127.0.0.1:8000/api/service-areas', { headers })
  expect(areasResponse.ok()).toBeTruthy()
  const areas = (await areasResponse.json()).data
  expect(areas.length).toBeGreaterThan(0)

  const customerResponse = await request.post('http://127.0.0.1:8000/api/customers', {
    headers,
    data: {
      service_area_id: areas[0].id,
      name: `Contract UI ${Date.now()}`,
      father_name: 'Contract Test Father',
      phone: '0799000099',
      house_number: 'PW-TEST',
    },
  })
  expect(customerResponse.ok()).toBeTruthy()
  customerId = (await customerResponse.json()).data.id

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
  }, session)
})

test.afterEach(() => {
  if (!customerId) return

  const id = Number(customerId)
  const cleanup = `
    $customer = App\\Models\\Customer::query()->find(${id});
    if ($customer && str_starts_with($customer->name, 'Contract UI ') && $customer->phone === '+93799000099' && $customer->house_number === 'PW-TEST') {
      Illuminate\\Support\\Facades\\DB::transaction(function () use ($customer) {
        foreach ($customer->payments()->with('allocations')->get() as $payment) {
          $allocationIds = $payment->allocations->pluck('id');
          $transactions = App\\Models\\AccountingTransaction::query()
            ->whereIn('source_type', ['customer_payment_allocation', 'customer_contract_payment_allocation'])
            ->whereIn('source_id', $allocationIds)
            ->get();
          foreach ($transactions as $transaction) {
            if ($transaction->posted_at && !$transaction->reversed_at) $transaction->reverseFromAccount();
          }
          App\\Models\\AccountingTransaction::query()
            ->whereIn('source_type', ['customer_payment_allocation', 'customer_contract_payment_allocation'])
            ->whereIn('source_id', $allocationIds)
            ->delete();
          $payment->allocations()->delete();
          $payment->delete();
        }
        foreach ($customer->contracts()->with(['deposits.transaction', 'deposits.refundTransaction'])->get() as $contract) {
          foreach ($contract->deposits as $deposit) {
            $transactionIds = collect([$deposit->accounting_transaction_id, $deposit->refund_transaction_id])->filter()->values();
            foreach ([$deposit->refundTransaction, $deposit->transaction] as $transaction) {
              if ($transaction && $transaction->posted_at && !$transaction->reversed_at) $transaction->reverseFromAccount();
            }
            $deposit->allocations()->delete();
            $deposit->delete();
            if ($transactionIds->isNotEmpty()) App\\Models\\AccountingTransaction::query()->whereIn('id', $transactionIds)->delete();
          }
        }
        $customer->invoices()->delete();
        $customer->charges()->delete();
        $customer->contracts()->delete();
        $customer->delete();
      });
    }
  `

  const psyshHome = resolve(tmpdir(), 'wsmis-psysh')
  mkdirSync(psyshHome, { recursive: true })
  execFileSync('php', ['artisan', 'tinker', '--execute', cleanup], {
    cwd: resolve(process.cwd(), '..', 'backend'),
    env: {
      ...process.env,
      APPDATA: psyshHome,
      HOME: psyshHome,
      LOG_CHANNEL: 'stderr',
      XDG_CONFIG_HOME: psyshHome,
    },
    stdio: 'pipe',
  })
  customerId = 0
  apiHeaders = {}
})

test('cancelled contracts remain visible after a replacement contract is created', async ({ page, request }) => {
  const firstResponse = await request.post(`http://127.0.0.1:8000/api/customers/${customerId}/contracts`, {
    headers: apiHeaders,
    data: {
      subscription_date: '2026-07-10',
      meter_size: 'Half inch',
      connection_fee: 1000,
      meter_fee: 500,
      required_initial_payment: 0,
    },
  })
  expect(firstResponse.ok()).toBeTruthy()
  const firstContract = (await firstResponse.json()).data

  const cancellationReason = 'Customer requested corrected connection terms.'
  const cancelResponse = await request.post(`http://127.0.0.1:8000/api/customer-contracts/${firstContract.id}/cancel`, {
    headers: apiHeaders,
    data: { reason: cancellationReason },
  })
  expect(cancelResponse.ok()).toBeTruthy()

  const secondResponse = await request.post(`http://127.0.0.1:8000/api/customers/${customerId}/contracts`, {
    headers: apiHeaders,
    data: {
      subscription_date: '2026-07-18',
      meter_size: 'Half inch',
      connection_fee: 1200,
      meter_fee: 600,
      required_initial_payment: 0,
    },
  })
  expect(secondResponse.ok()).toBeTruthy()
  const secondContract = (await secondResponse.json()).data

  const detailLoaded = page.waitForResponse((response) =>
    response.url().includes(`/api/customers/${customerId}/detail`) && response.request().method() === 'GET',
  )
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto(`/dashboard/customers/${customerId}?tab=contract`)
  expect((await detailLoaded).ok()).toBeTruthy()

  await expect(page.getByRole('heading', { name: 'Contract History' })).toBeVisible()
  const historyTable = page.getByRole('table')
  await expect(historyTable.getByText(firstContract.contract_number, { exact: true })).toBeVisible()
  await expect(historyTable.getByText(secondContract.contract_number, { exact: true })).toBeVisible()

  const oldContractRow = historyTable.locator('tr').filter({ hasText: firstContract.contract_number })
  await expect(oldContractRow.getByText('cancelled', { exact: true })).toBeVisible()
  await oldContractRow.getByRole('button', { name: 'View' }).click()

  const contractRecordModal = page.locator('.elegant-panel').filter({ has: page.getByRole('heading', { name: 'Contract Record' }) })
  await expect(contractRecordModal).toBeVisible()
  await expect(contractRecordModal.getByText(cancellationReason, { exact: true })).toBeVisible()
  await expect(contractRecordModal.getByText(firstContract.contract_number, { exact: true })).toBeVisible()

  await contractRecordModal.getByRole('button', { name: 'Close', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(350)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
})

test('confirmed contracts create an invoice and collect from the customer page', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 960 })
  const detailLoaded = page.waitForResponse((response) =>
    response.url().includes(`/api/customers/${customerId}/detail`) && response.request().method() === 'GET',
  )
  await page.goto(`/dashboard/customers/${customerId}?tab=contract`)
  expect((await detailLoaded).ok()).toBeTruthy()

  await expect(page.getByText('This customer is registered, but no connection contract has been created yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Create Contract' }).click()

  const contractModal = page.locator('.elegant-panel').filter({ has: page.getByRole('heading', { name: 'Create Customer Contract' }) })
  const inputFor = (modal: ReturnType<typeof page.locator>, label: string) =>
    modal.locator('label').filter({ hasText: new RegExp(`^${label}\\s*\\*?$`) }).locator('..').locator('input')

  await inputFor(contractModal, 'Connection Fee').fill('16000')
  await inputFor(contractModal, 'Meter Fee').fill('6000')
  await inputFor(contractModal, 'Discount').fill('0')
  const contractSaved = page.waitForResponse((response) =>
    response.url().includes(`/api/customers/${customerId}/contracts`) && response.request().method() === 'POST',
  )
  await contractModal.getByRole('button', { name: 'Save Contract' }).click()
  expect((await contractSaved).ok()).toBeTruthy()

  await expect(page.getByText('draft', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('AFN 22,000').first()).toBeVisible()
  await page.getByRole('button', { name: 'Confirm Contract' }).click()
  await expect(page.getByText('Awaiting Installation', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/The contract is confirmed and its invoice is ready/)).toBeVisible()
  const paymentButton = page.getByRole('button', { name: 'Record Payment' }).first()
  await expect(paymentButton).toBeVisible()

  expect(pageErrors).toEqual([])
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-contract-invoice-workflow.png', fullPage: true })

  await paymentButton.click()
  await expect(page).toHaveURL(new RegExp(`/dashboard/customers/${customerId}`))
  await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(450)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  const mobileSidebar = await page.locator('.app-sidebar').boundingBox()
  expect(mobileSidebar).not.toBeNull()
  expect((mobileSidebar?.x ?? 0) + (mobileSidebar?.width ?? 0)).toBeLessThanOrEqual(1)
  await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-contract-invoice-workflow-mobile.png', fullPage: true })
})
