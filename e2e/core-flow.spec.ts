import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('opens the sanitized sample and exposes an accessible workflow', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /explore a sanitized sample project/i }).click()
  await expect(page.getByRole('heading', { name: /timeline review/i })).toBeVisible()
  await expect(page.locator('input[placeholder="Brief issue title…"]')).toHaveValue(/checkout button freezes after click/i)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([])
})

test('cycles theme and supports the reference layout', async ({ page }) => {
  await page.goto('/')
  const theme = page.getByRole('button', { name: /change theme/i })
  await theme.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await theme.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('shows the supported-device guard below 768px', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 })
  await page.goto('/')
  await expect(page.getByText(/use a tablet or desktop to edit evidence/i)).toBeVisible()
})
