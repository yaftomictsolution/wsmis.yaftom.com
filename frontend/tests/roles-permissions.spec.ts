import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('role form shows and filters the complete permission catalog', async ({ page, request }) => {
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

  await page.goto('/dashboard/roles', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Add Role' }).click()

  await expect(page.getByText('0 of 168 selected')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search permissions' }).fill('authorities')
  const authorityGroup = page.getByRole('heading', { name: 'Discount Authorities', exact: true }).locator('..')
  await expect(authorityGroup).toBeVisible()
  await expect(authorityGroup.getByLabel('View', { exact: true })).toBeVisible()
  await expect(authorityGroup.getByLabel('Create', { exact: true })).toBeVisible()
  await expect(authorityGroup.getByLabel('Update', { exact: true })).toBeVisible()
  await expect(authorityGroup.getByLabel('Delete', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Select Shown' }).click()
  await expect(page.getByText('4 of 168 selected')).toBeVisible()

  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('button', { name: 'Dari' }).click()
  const dariAuthorityGroup = page.getByRole('heading', { name: 'صلاحیت‌دهندگان تخفیف', exact: true }).locator('..')
  await expect(dariAuthorityGroup).toBeVisible()
  await expect(dariAuthorityGroup.getByLabel('مشاهده', { exact: true })).toBeVisible()
  await expect(dariAuthorityGroup.getByLabel('ایجاد', { exact: true })).toBeVisible()
  await expect(dariAuthorityGroup.getByLabel('ویرایش', { exact: true })).toBeVisible()
  await expect(dariAuthorityGroup.getByLabel('حذف', { exact: true })).toBeVisible()
  await expect(page.getByText('4 از 168 انتخاب شده')).toBeVisible()
})
