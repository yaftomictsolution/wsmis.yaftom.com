import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('settings page and forms switch completely from English to Dari', async ({ page, request }) => {
  const login = await request.post(`${apiUrl}/auth/login`, {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, session)

  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'System Profile' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Training Mode' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Leave Settings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Income Categories' })).toBeVisible()

  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('button', { name: 'Dari' }).click()

  await expect(page.getByRole('heading', { name: 'تنظیمات', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'حالت آموزشی', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ظاهر داشبورد', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'پروفایل سیستم', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'تنظیمات رخصتی', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'روش‌های پرداخت', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'کتگوری‌های عاید', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'انواع فیس مشتری', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'افزودن روش' }).click()
  await expect(page.getByRole('heading', { name: 'افزودن روش پرداخت', exact: true })).toBeVisible()
  const paymentMethodModal = page.locator('.elegant-panel').filter({
    has: page.getByRole('heading', { name: 'افزودن روش پرداخت', exact: true }),
  })
  await expect(paymentMethodModal.getByLabel(/^نام/)).toBeVisible()
  await expect(paymentMethodModal.getByLabel(/^کد/)).toBeVisible()
  await expect(paymentMethodModal.getByLabel('وضعیت', { exact: true })).toBeVisible()
  await expect(paymentMethodModal.getByRole('button', { name: 'ذخیره روش', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'لغو', exact: true }).click()

  await page.getByRole('button', { name: 'افزودن دسته' }).click()
  await expect(page.getByRole('heading', { name: 'افزودن کتگوری عاید', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ذخیره دسته', exact: true })).toBeVisible()
})
