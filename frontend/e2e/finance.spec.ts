import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

async function navigate(page: Page, name: string) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation' })
  if (await toggle.isVisible()) await toggle.click()
  await page.getByRole('navigation').getByRole('link', { name, exact: true }).click()
}

test('complete finance workflow, persistence, charts and responsive layout', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const email = `browser-${randomUUID()}@example.com`
  await page.goto('/')
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('BrowserTestOnly!2026')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Financial overview' })).toBeVisible()
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  await page.getByLabel('Description', { exact: true }).fill('Browser coffee')
  await page.getByLabel('Amount (USD)', { exact: true }).fill('25.50')
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Food & drink' })
  await page.getByLabel('Date', { exact: true }).fill('2026-09-18')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('Reporting month').fill('2026-09')
  await expect(page.getByText('Browser coffee', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Financial overview' })).toBeVisible()
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 })

  await navigate(page, 'Budgets')
  await page.getByRole('button', { name: 'New budget' }).click()
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Food & drink' })
  await page.getByLabel('Month', { exact: true }).fill('2026-09')
  await page.getByLabel('Monthly limit (USD)').fill('200')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('$174.50 remaining')).toBeVisible()

  await navigate(page, 'Accounts')
  await page.getByRole('button', { name: 'New account', exact: true }).click()
  await page.getByLabel('Account name').fill('Savings reserve')
  await page.getByLabel('Account type').selectOption('Savings')
  await page.getByLabel('Opening balance (USD)').fill('500')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'Savings reserve' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit Savings reserve' }).click()
  await page.getByLabel('Opening balance (USD)').fill('600')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'New category' }).click()
  await page.getByLabel('Category name').fill('Learning')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Learning', { exact: true })).toBeVisible()

  await navigate(page, 'Recurring')
  await page.getByRole('button', { name: 'New recurring', exact: true }).click()
  await page.getByLabel('Description', { exact: true }).fill('Music subscription')
  await page.getByLabel('Amount (USD)').fill('9.99')
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Other' })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'Music subscription' })).toBeVisible()
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).not.toBeChecked()

  await navigate(page, 'Import CSV')
  await page.getByLabel('CSV file').setInputFiles(path.resolve('public/sample-transactions.csv'))
  await page.getByRole('button', { name: 'Preview import' }).click()
  await expect(page.getByText('3 valid', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Import 3 transactions' }).click()
  await expect(page.getByText('Import complete', { exact: true })).toBeVisible()
  await expect(page.getByText('3 imported, 1 duplicates skipped, 1 invalid rows skipped.')).toBeVisible()

  await navigate(page, 'Transactions')
  await page.getByLabel('Search transactions').fill('Browser coffee')
  await expect(page.getByRole('cell', { name: 'Browser coffee', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit Browser coffee' }).click()
  await page.getByLabel('Amount (USD)').fill('30')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('cell', { name: '-$30.00', exact: true })).toBeVisible()

  await navigate(page, 'Overview')
  await page.getByLabel('Reporting month').fill('2026-09')
  await expect(page.locator('canvas')).toHaveCount(2)
  await expect(page.getByText('$4,200.00', { exact: true }).first()).toBeVisible()
  const canvases = await page.locator('canvas').evaluateAll(elements => elements.map(element => {
    const canvas = element as HTMLCanvasElement
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    return { width: canvas.width, height: canvas.height, painted: pixels.some((value, index) => index % 4 === 3 && value > 0) }
  }))
  expect(canvases.every(canvas => canvas.width > 0 && canvas.height > 0 && canvas.painted)).toBe(true)
  await page.screenshot({ path: `../docs/screenshots/${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' })
  for (const route of ['Overview', 'Transactions', 'Accounts', 'Budgets', 'Recurring', 'Import CSV']) {
    await navigate(page, route)
    expect(await page.evaluate(() => document.documentElement.scrollWidth), route).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  }
  await navigate(page, 'Transactions')
  await page.getByRole('button', { name: 'Delete Browser coffee' }).click()
  const dialogBounds = await page.getByRole('dialog').boundingBox()
  expect(dialogBounds!.x).toBeGreaterThanOrEqual(0)
  expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Browser coffee', exact: true })).toHaveCount(0)
  if (await page.getByRole('button', { name: 'Toggle navigation' }).isVisible()) await page.getByRole('button', { name: 'Toggle navigation' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('BrowserTestOnly!2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})