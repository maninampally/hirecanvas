import { test, expect, type Page } from '@playwright/test'

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD

async function login(page: Page) {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run auth flows')

  await page.goto('/login')
  await page.getByPlaceholder('you@example.com').fill(E2E_USER_EMAIL || '')
  await page.getByPlaceholder('••••••••').first().fill(E2E_USER_PASSWORD || '')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

function uniqueJobSeed() {
  const seed = Date.now().toString().slice(-6)
  return {
    company: `E2E Company ${seed}`,
    role: `E2E Role ${seed}`,
  }
}

test('landing page renders', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/HireCanvas/i)
})

test('auth pages render', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText(/welcome back/i)).toBeVisible()

  await page.goto('/register')
  await expect(page.getByText(/create your account/i)).toBeVisible()
})

test('forgot/reset pages render', async ({ page }) => {
  await page.goto('/forgot-password')
  await expect(page.getByText(/reset your password/i)).toBeVisible()

  await page.goto('/reset-password')
  await expect(page.getByText(/set a new password/i)).toBeVisible()
})

test('manual job appears immediately without refresh', async ({ page }) => {
  await login(page)

  const job = uniqueJobSeed()
  await page.goto('/jobs')
  await page.getByRole('button', { name: /add job/i }).click()

  await page.getByPlaceholder('e.g., Senior Frontend Engineer').fill(job.role)
  await page.getByPlaceholder('e.g., Google, Stripe').fill(job.company)
  await page.getByRole('button', { name: /^save job$/i }).click()

  const row = page.locator('tr', { hasText: job.company })
  await expect(row).toBeVisible({ timeout: 15000 })
  await expect(row.getByText(job.role)).toBeVisible()
})

test('uploaded resume shows view and download actions in jobs row', async ({ page }) => {
  await login(page)

  const job = uniqueJobSeed()
  await page.goto('/jobs')
  await page.getByRole('button', { name: /add job/i }).click()

  await page.getByPlaceholder('e.g., Senior Frontend Engineer').fill(job.role)
  await page.getByPlaceholder('e.g., Google, Stripe').fill(job.company)
  await page.getByRole('button', { name: /^save job$/i }).click()

  const row = page.locator('tr', { hasText: job.company })
  await expect(row).toBeVisible({ timeout: 15000 })

  await row.locator('input[type="file"]').setInputFiles({
    name: 'resume.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('E2E resume content for actions validation.'),
  })

  await expect(row.getByRole('button', { name: /view/i })).toBeVisible({ timeout: 15000 })
  await expect(row.getByRole('button', { name: /download/i })).toBeVisible({ timeout: 15000 })
})

test('dashboard activity chart renders live activity module with filter windows', async ({ page }) => {
  await login(page)

  await page.goto('/dashboard')
  const chartCard = page.locator('div,section,article').filter({ has: page.getByRole('heading', { name: 'Application Activity' }) }).first()
  await expect(chartCard.getByRole('heading', { name: 'Application Activity' })).toBeVisible()
  await expect(chartCard.getByText('Real applications over selected window.')).toBeVisible()

  const windowSelect = chartCard.locator('select').first()
  await expect(windowSelect).toBeVisible()
  await windowSelect.selectOption('14')
  await expect(windowSelect).toHaveValue('14')
  await windowSelect.selectOption('30')
  await expect(windowSelect).toHaveValue('30')
})

