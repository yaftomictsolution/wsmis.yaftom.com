import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('customer workspace tabs and sections switch from English to Dari', async ({ page, request }) => {
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

  await page.goto('/dashboard/customers/6', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Reading History', exact: true })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Language', exact: true }).click()
  await page.getByRole('button', { name: 'Dari', exact: true }).click()

  const translatedTabs = [
    'تاریخچه قرائت',
    'انوایس‌ها / بل‌ها',
    'دفتر حساب',
    'شکایات',
    'تاریخچه تعویض میتر',
    'قطع / وصل مجدد',
  ]

  for (const tab of translatedTabs) {
    await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible()
  }

  const sectionChecks = [
    ['تاریخچه قرائت', 'تاریخچه قرائت میتر'],
    ['انوایس‌ها / بل‌ها', 'انوایس‌ها / بل‌های مشتری'],
    ['دفتر حساب', 'دفتر حساب / صورت‌حساب مشتری'],
    ['شکایات', 'شکایات / درخواست‌های خدماتی'],
    ['تاریخچه تعویض میتر', 'تاریخچه تعویض میتر'],
    ['قطع / وصل مجدد', 'قطع / وصل مجدد'],
  ] as const

  for (const [tab, heading] of sectionChecks) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }

  await page.getByRole('button', { name: 'شکایات', exact: true }).click()
  await page.getByRole('button', { name: 'افزودن درخواست', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'افزودن درخواست خدماتی', exact: true })).toBeVisible()
  await expect(page.getByLabel(/^اولویت/)).toBeVisible()
  await page.getByRole('button', { name: 'لغو', exact: true }).click()

  await page.getByRole('button', { name: 'قطع / وصل مجدد', exact: true }).click()
  await page.getByRole('button', { name: 'افزودن رویداد', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'افزودن رویداد اتصال', exact: true })).toBeVisible()
  await expect(page.getByLabel(/^نوع رویداد/)).toBeVisible()
})
