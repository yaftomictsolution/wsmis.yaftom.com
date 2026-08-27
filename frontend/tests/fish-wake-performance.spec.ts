import { expect, test } from '@playwright/test'

const canvasSignature = async (page: import('@playwright/test').Page) =>
  page.locator('[data-water-fish-layer]').evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    const context = canvas.getContext('2d')
    if (!context) return { visibleSamples: 0, checksum: 0 }

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let visibleSamples = 0
    let checksum = 0
    for (let index = 0; index < pixels.length; index += 64) {
      if (pixels[index + 3] > 8) visibleSamples += 1
      checksum = (checksum + pixels[index] * 3 + pixels[index + 1] * 5 + pixels[index + 2] * 7 + pixels[index + 3]) % 1_000_003
    }

    return { visibleSamples, checksum }
  })

test('fish create animated natural wakes without slowing pointer interaction', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('language', 'en')
    localStorage.setItem('wsmis_dashboard_fish_visible', 'true')
  })

  await page.goto('/login')
  const password = page.getByPlaceholder('Enter your password')
  await page.waitForTimeout(1_000)
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('textbox', { name: 'Email' }).fill('admin@waternet.local')
  await password.fill('password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard')

  const water = page.locator('.water-ripple-surface')
  await expect(water).toBeVisible()
  const ambientStart = await water.evaluate((element) => {
    const style = getComputedStyle(element, '::after')
    return { animationName: style.animationName, transform: style.transform }
  })
  expect(ambientStart.animationName).toBe('gentle-water-surface')
  await page.waitForTimeout(450)
  const ambientTransform = await water.evaluate((element) => getComputedStyle(element, '::after').transform)
  expect(ambientTransform).not.toBe(ambientStart.transform)
  await expect(water).toHaveAttribute('data-water-ripples-motion', 'idle')

  const canvas = page.locator('[data-water-fish-layer]')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-fish-renderer', 'canvas')
  await expect(canvas).toHaveAttribute('data-fish-wakes', 'analytic')
  await expect.poll(async () => (await canvasSignature(page)).visibleSamples).toBeGreaterThan(150)

  const firstFrame = await canvasSignature(page)
  await page.waitForTimeout(550)
  const secondFrame = await canvasSignature(page)
  expect(secondFrame.checksum).not.toBe(firstFrame.checksum)

  await page.waitForTimeout(1_600)
  const idleMeasurement = await page.evaluate(() => new Promise<{ frames: number; duration: number }>((resolve) => {
    const startedAt = performance.now()
    let frames = 0
    const countFrame = (timestamp: number) => {
      frames += 1
      if (timestamp - startedAt >= 1_000) {
        resolve({ frames, duration: timestamp - startedAt })
        return
      }
      requestAnimationFrame(countFrame)
    }
    requestAnimationFrame(countFrame)
  }))
  const idleFramesPerSecond = idleMeasurement.frames / (idleMeasurement.duration / 1_000)
  expect(idleFramesPerSecond).toBeGreaterThan(20)

  const frameMeasurement = page.evaluate(() => new Promise<{ frames: number; duration: number }>((resolve) => {
    const startedAt = performance.now()
    let frames = 0
    const countFrame = (timestamp: number) => {
      frames += 1
      if (timestamp - startedAt >= 1_250) {
        resolve({ frames, duration: timestamp - startedAt })
        return
      }
      requestAnimationFrame(countFrame)
    }
    requestAnimationFrame(countFrame)
  }))

  for (let index = 0; index < 24; index += 1) {
    await page.mouse.move(140 + index * 35, 160 + (index % 6) * 70)
    await page.waitForTimeout(28)
  }

  const measured = await frameMeasurement
  const framesPerSecond = measured.frames / (measured.duration / 1_000)
  expect(framesPerSecond).toBeGreaterThan(20)

  await page.screenshot({
    path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-fish-wakes-desktop.png',
    fullPage: true,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(canvas).toBeVisible()
  await expect.poll(async () => (await canvasSignature(page)).visibleSamples).toBeGreaterThan(50)
  await page.screenshot({
    path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-fish-wakes-mobile.png',
    fullPage: true,
  })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(async () => water.evaluate((element) =>
    getComputedStyle(element, '::after').animationName,
  )).toBe('none')
})
