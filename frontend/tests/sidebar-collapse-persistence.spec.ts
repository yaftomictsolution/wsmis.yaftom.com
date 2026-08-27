import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('desktop sidebar stays minimized until the user expands it', async ({ page, request }) => {
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

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/dashboard')

  const sidebar = page.locator('.app-sidebar')
  const sidebarWidth = () => sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))

  await expect.poll(sidebarWidth).toBe(280)
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect.poll(sidebarWidth).toBe(88)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('wsmis.sidebarCollapsed'))).toBe('true')

  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await page.setViewportSize({ width: 1360, height: 900 })
  await expect.poll(sidebarWidth).toBe(88)

  await page.goto('/dashboard/customers')
  await expect.poll(sidebarWidth).toBe(88)

  await page.reload()
  await expect.poll(sidebarWidth).toBe(88)

  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await expect.poll(sidebarWidth).toBe(280)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('wsmis.sidebarCollapsed'))).toBe('false')
})
