import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('financial reports and all report tabs switch from English to Dari', async ({ page, request }) => {
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

  await page.goto('/dashboard/financial-reports', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Financial Reports', exact: true })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Language', exact: true }).click()
  await page.getByRole('button', { name: 'Dari', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'گزارش‌های مالی', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'صدور CSV', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'چاپ گزارش', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'همه حساب‌ها', exact: true })).toBeAttached()
  await expect(page.getByText('سپرده‌های نیازمند بازپرداخت', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'نمای کلی', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'جریان نقدی روزانه', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'بیلانس حساب‌ها', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'سود و زیان', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'عواید بر اساس کتگوری', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'مصارف بر اساس کتگوری', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'دفتر کل', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'دفتر کل', exact: true })).toBeVisible()
  await expect(page.getByText(/ورودی تأییدشده/)).toBeVisible()

  await page.getByRole('button', { name: 'مطالبات', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'مطالبات مشتریان', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'کنترول‌های مالی', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'فعالیت معاشات', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'توزیع سود سهم‌داران', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'تطبیق حسابات', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'بستن‌های ماهانه', exact: true })).toBeVisible()
})
