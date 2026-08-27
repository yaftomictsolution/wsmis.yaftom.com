import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('warehouse detail workspace switches completely from English to Dari', async ({ page, request }) => {
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

  await page.goto('/dashboard/warehouses/1', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: 'Back to Warehouses', exact: true })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Language', exact: true }).click()
  await page.getByRole('button', { name: 'Dari', exact: true }).click()

  await expect(page.getByRole('link', { name: 'بازگشت به انبارها', exact: true })).toBeVisible()
  await expect(page.getByText(/تاریخچه موجودی و گردش کالا/)).toBeVisible()
  await expect(page.getByText('موجودی کم', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('سریال‌های میتر موجود', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'محصولات', exact: true }).click()
  await expect(page.getByPlaceholder('جستجوی محصولات...', { exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'همه کتگوری‌ها', exact: true })).toBeAttached()
  await expect(page.getByRole('option', { name: 'همه حالات موجودی', exact: true })).toBeAttached()

  await page.getByRole('button', { name: 'سریال‌های میتر', exact: true }).click()
  await expect(page.getByPlaceholder('جستجوی سریال میتر...', { exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'همه حالات میتر', exact: true })).toBeAttached()

  await page.getByRole('button', { name: 'گردش موجودی', exact: true }).click()
  await expect(page.getByRole('option', { name: 'همه انواع گردش', exact: true })).toBeAttached()
  await expect(page.getByLabel('گردش از تاریخ', { exact: true })).toBeVisible()
  await expect(page.getByLabel('گردش تا تاریخ', { exact: true })).toBeVisible()
})
