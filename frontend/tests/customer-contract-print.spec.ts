import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const longOriginalResidence = 'Kabul Karte Chahar Khair Khana near Central Mosque and Community Market'

const customer = {
  id: 42,
  service_area_id: 3,
  service_area: {
    id: 3,
    name: 'Khair Khana',
    mosque_name: 'مسجد حضرت قبا',
    district: '17',
    street_block_village: 'سرک خدای داد',
    households_count: 60,
    rate_per_cubic_meter: 75,
    status: 'active',
  },
  subscription_code: 'CUS-000001',
  subscription_date: '2026-08-02',
  name: 'لطف الله',
  last_name: 'نوری',
  father_name: 'نور آقا',
  grandfather_name: 'عبدالقادر',
  phone: '0786630737',
  tazkira_number: '1398-0900-61416',
  house_number: '50',
  nearest_house_number: '38',
  street_number: '42',
  original_residence: longOriginalResidence,
  current_residence: 'کابل',
  meter_size: 'نیم انچ',
  connection_fee: 16000,
  meter_fee: 6000,
  agreement_discount_amount: 10000,
  agreement_paid_amount: 10000,
  agreement_remaining_amount: 2000,
  agreement_status: 'active',
  opening_balance: 0,
  current_balance: 2000,
  status: 'active',
  notes: 'مبلغ ده هزار افغانی تخفیف و مبلغ دو هزار افغانی باقی مانده است.',
  has_photo: true,
  latest_contract: {
    id: 17,
    customer_id: 42,
    contract_number: 'CTR-20260802-00017',
    subscription_date: '2026-08-02',
    meter_size: 'نیم انچ',
    connection_fee: 16000,
    meter_fee: 6000,
    discount_amount: 10000,
    net_amount: 12000,
    required_initial_payment: 0,
    deposited_amount: 0,
    applied_amount: 10000,
    remaining_amount: 2000,
    paid_amount: 10000,
    payment_status: 'partially_paid',
    discount_approved_by: 'حاجی عبدالله',
    status: 'active',
  },
}

const assignment = {
  id: 8,
  customer_id: 42,
  customer_contract_id: 17,
  meter_id: 2,
  installed_by: 1,
  initial_reading: 0,
  installation_date: '2026-08-03',
  seal_number: 'SEAL-0002',
  status: 'active',
  meter: { id: 2, meter_number: 'wm-1000', status: 'installed' },
  installer: { id: 1, name: 'WaterNet Admin' },
}

const settings = {
  data: {
    system: {
      system_profile: {
        company_name: 'Paktyamawj Water Supply & Construction Company',
        system_name: 'Water Supply Management System',
        currency: 'AFN',
        language: 'fa',
        phone: '0767300900',
      },
    },
    payment_methods: [],
    financial_categories: [],
    customer_charge_types: [],
  },
}

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
})

test.describe('customer photo and reference contract printing', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('waternet_token', 'visual-test-token')
      localStorage.setItem('waternet_user', JSON.stringify({ id: 1, name: 'WaterNet Admin' }))
    })
  })

  test('renders three Letter pages without content overflow', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/customers/42/detail')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              customer: { ...customer, meter_assignments: [assignment], contracts: [customer.latest_contract] },
              current_meter_assignment: assignment,
              meter_replacement_history: [],
              ledger: [],
              totals: { charges: 0, invoiced: 12000, paid: 10000, balance: 2000, deposits_held: 0 },
            },
          }),
        })
        return
      }
      if (path.endsWith('/settings')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(settings) })
        return
      }
      if (path.endsWith('/customers/42/photo')) {
        await route.fulfill({
          contentType: 'image/jpeg',
          body: readFileSync('public/images/contracts/paktyamawj-logo.jpg'),
        })
        return
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) })
    })

    await page.setViewportSize({ width: 1280, height: 1400 })
    await page.goto('/print/customer-contract/42?autoprint=0')
    const sheets = page.locator('.contract-sheet')
    await expect(sheets).toHaveCount(3)
    await expect(page.getByText('جواز اشتراک در شبکه آبرسانی')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Customer' })).toBeVisible()
    await expect(page.locator('.terms-signature')).toHaveCSS('text-align', 'right')

    const wrappedResidenceValues = page.locator('.contract-meta span', { hasText: longOriginalResidence })
    await expect(wrappedResidenceValues).toHaveCount(2)
    const wrapping = await wrappedResidenceValues.evaluateAll((nodes) => nodes.map((node) => {
      const element = node as HTMLElement
      const style = window.getComputedStyle(element)
      return {
        text: element.textContent,
        whiteSpace: style.whiteSpace,
        textOverflow: style.textOverflow,
        fitsWidth: element.scrollWidth <= element.clientWidth + 1,
      }
    }))
    for (const value of wrapping) {
      expect(value.text).toBe(longOriginalResidence)
      expect(value.whiteSpace).toBe('normal')
      expect(value.textOverflow).toBe('clip')
      expect(value.fitsWidth).toBe(true)
    }

    const subscriptionCodes = page.locator('.contract-meta .meta-identifier span', { hasText: 'CUS-000001' })
    await expect(subscriptionCodes).toHaveCount(2)
    const identifierLayout = await subscriptionCodes.evaluateAll((nodes) => nodes.map((node) => {
      const element = node as HTMLElement
      return {
        text: element.textContent,
        whiteSpace: window.getComputedStyle(element).whiteSpace,
        fitsWidth: element.scrollWidth <= element.clientWidth + 1,
      }
    }))
    for (const value of identifierLayout) {
      expect(value.text).toBe('CUS-000001')
      expect(value.whiteSpace).toBe('nowrap')
      expect(value.fitsWidth).toBe(true)
    }

    const dimensions = await sheets.evaluateAll((nodes) => nodes.map((node) => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    })))

    await sheets.nth(0).screenshot({ path: '../test-results/customer-contract-page-1.png' })
    await sheets.nth(1).screenshot({ path: '../test-results/customer-contract-page-2.png' })
    await sheets.nth(2).screenshot({ path: '../test-results/customer-contract-page-3.png' })
    await page.pdf({ path: '../test-results/customer-contract-print.pdf', preferCSSPageSize: true, printBackground: true })

    for (const [index, dimension] of dimensions.entries()) {
      expect(dimension.scrollHeight, `contract page ${index + 1} height`).toBeLessThanOrEqual(dimension.clientHeight + 1)
      expect(dimension.scrollWidth, `contract page ${index + 1} width`).toBeLessThanOrEqual(dimension.clientWidth + 1)
    }
  })

  test('captures a customer portrait from the desktop camera control', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname

      if (path.endsWith('/auth/me')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ user: { id: 1, name: 'WaterNet Admin', email: 'admin@waternet.local', status: 'active', roles: ['Admin'], permissions: [] } }) })
        return
      }
      if (path.endsWith('/service-areas')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [customer.service_area] }) })
        return
      }
      if (path.endsWith('/customers')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [] }) })
        return
      }
      if (path.endsWith('/settings')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(settings) })
        return
      }
      if (path.endsWith('/notifications')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], unread_count: 0 }) })
        return
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) })
    })

    await page.goto('/dashboard/customers')
    await page.getByRole('button', { name: 'Add Customer' }).click()
    await page.getByLabel('First Name').fill('Camera Test')
    await page.getByLabel('Father Name').fill('Camera Father')
    await page.getByLabel('Phone').fill('0790001234')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel('House Number').fill('CAM-1')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Open Camera' }).click()
    const video = page.locator('video')
    await expect(video).toBeVisible()
    await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2)
    await page.getByRole('button', { name: 'Take Photo' }).click()
    await expect(page.getByRole('img', { name: 'Customer contract portrait' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retake Photo' })).toBeVisible()
  })
})
