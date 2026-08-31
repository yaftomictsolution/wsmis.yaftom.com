import { expect, test } from '@playwright/test'

test('administrator can run and resume local-cloud synchronization from the header', async ({ page }) => {
  let advanceCount = 0
  let writerMode: 'cloud' | 'local' = 'cloud'
  let pendingChanges = 2
  let lastSyncAt: string | null = null
  const runUuid = '11111111-1111-4111-a111-111111111111'

  await page.addInitScript(() => {
    localStorage.setItem('waternet_token', 'sync-test-token')
    localStorage.setItem('waternet_user', JSON.stringify({
      id: 1,
      name: 'Sync Administrator',
      email: 'admin@example.test',
      status: 'active',
      roles: ['Admin'],
      permissions: [],
    }))
    localStorage.setItem('language', 'en')
  })

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })

    if (path.endsWith('/auth/me')) {
      await json({ user: {
        id: 1,
        name: 'Sync Administrator',
        email: 'admin@example.test',
        status: 'active',
        roles: ['Admin'],
        permissions: [],
      } })
      return
    }
    if (path.endsWith('/settings')) {
      await json({ data: { system: {}, payment_methods: [], financial_categories: [], customer_charge_types: [] } })
      return
    }
    if (path.endsWith('/training-mode')) {
      await json({ data: { environment: 'production', enabled: false, effective_date: '2026-08-29', real_date: '2026-08-29', can_manage: false, reset_confirmation: 'RESET' } })
      return
    }
    if (path.endsWith('/notifications')) {
      await json({ data: [], unread_count: 0 })
      return
    }
    if (path.endsWith('/dashboard/stats')) {
      await json({ data: {} })
      return
    }
    if (path.endsWith('/sync/status')) {
      await json({ data: {
        enabled: true,
        mode: 'local',
        configured: true,
        node_uuid: '22222222-2222-4222-a222-222222222222',
        installation_uuid: '33333333-3333-4333-a333-333333333333',
        pending_changes: pendingChanges,
        open_conflicts: 0,
        last_sync_at: lastSyncAt,
        last_verified_at: null,
        last_error: null,
        writer_mode: writerMode,
        lease_expires_at: null,
        latest_run: null,
      } })
      return
    }
    if (path.endsWith('/sync/conflicts')) {
      await json({ data: [] })
      return
    }
    if (path.endsWith('/sync/runs') && request.method() === 'POST') {
      await json({ data: {
        run_uuid: runUuid,
        status: 'running',
        stage: 'prepare',
        progress: 2,
        counts: {},
        warnings: [],
      } }, 201)
      return
    }
    if (path.endsWith(`/sync/runs/${runUuid}/advance`)) {
      advanceCount += 1
      const stages = [
        { stage: 'detect', progress: 15, status: 'running' },
        { stage: 'push', progress: 45, status: 'running' },
        { stage: 'pull', progress: 72, status: 'running' },
        { stage: 'verify', progress: 90, status: 'running' },
        { stage: 'complete', progress: 100, status: 'completed' },
      ] as const
      if (stages[Math.min(advanceCount - 1, stages.length - 1)].status === 'completed') {
        pendingChanges = 0
        lastSyncAt = '2026-08-29T12:00:00Z'
      }
      await json({ data: {
        run_uuid: runUuid,
        ...stages[Math.min(advanceCount - 1, stages.length - 1)],
        counts: { pushed: 2, pulled: 1, conflicts: 0 },
        warnings: [],
      } })
      return
    }
    if (path.endsWith('/sync/lease/acquire') && request.method() === 'POST') {
      writerMode = 'local'
      await json({ data: { writer_mode: 'local', lease_expires_at: '2026-08-30T12:00:00Z' } })
      return
    }
    if (path.endsWith('/sync/lease/release') && request.method() === 'POST') {
      writerMode = 'cloud'
      await json({ data: { writer_mode: 'cloud' } })
      return
    }

    await json({ data: [] })
  })

  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Data synchronization' }).click()
  await expect(page.getByRole('heading', { name: 'Synchronization Center' })).toBeVisible()
  await expect(page.getByText('2 pending changes')).toBeVisible()

  await page.getByRole('button', { name: 'Sync Now' }).click()
  await expect(page.getByText('Complete', { exact: true })).toBeVisible()
  await expect(page.getByText('100%')).toBeVisible()
  expect(advanceCount).toBe(5)

  await page.getByRole('button', { name: 'Start Offline Work' }).click()
  await expect(page.getByRole('heading', { name: 'Start Offline Work' })).toBeVisible()
  await page.getByRole('button', { name: 'Start Offline Work' }).last().click()
  await expect(page.getByText('Sync & Return Online')).toBeVisible()

  await page.getByRole('button', { name: 'Sync & Return Online' }).click()
  await page.getByRole('button', { name: 'Sync & Return Online' }).last().click()
  await expect(page.getByText('Start Offline Work')).toBeVisible()
})
