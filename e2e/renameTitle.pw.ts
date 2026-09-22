import { expect, test, type Page } from '@playwright/test';

const captureMutations = (page: Page) => page.evaluate(() => {
  const original = window.ember.request;
  window.ember.request = async (instance, method, path, body) => {
    if (method !== 'GET') {
      const entries = JSON.parse(sessionStorage.getItem('rename-test-requests') ?? '[]');
      sessionStorage.setItem('rename-test-requests', JSON.stringify([...entries, { instance, method, path, body }]));
    }
    return original(instance, method, path, body);
  };
});
const mutations = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('rename-test-requests') ?? '[]'));

test.beforeEach(async ({ page }) => {
  await page.goto('/?fixture=performance&noDock');
  await expect(page.locator('textarea')).toHaveCount(2);
});

test('double-clicking the header title renames the session on the instance', async ({ page }) => {
  await captureMutations(page);
  const column = page.locator('main[data-session-key="local::perf-0"]');
  await column.locator('header').getByText('Performance session 0').dblclick();
  const input = column.getByRole('textbox', { name: 'Rename session' });
  await expect(input).toBeVisible();
  await input.fill('Renamed session');
  await input.press('Enter');
  await expect(column.locator('header')).toContainText('Renamed session');
  await expect.poll(async () => (await mutations(page)).filter((entry: { method: string }) => entry.method === 'PATCH').length).toBe(1);
  const [patch] = await mutations(page);
  expect(patch.path).toContain('/api/session/perf-0');
  expect(patch.body.title).toBe('Renamed session');
  // The blob's label in the rail follows the rename (truncated at 10 chars + em-dash).
  await expect(page.locator('aside [data-session-key="local::perf-0"]')).toContainText('Renamed se—');
});

test('Escape cancels the rename without touching the instance', async ({ page }) => {
  await captureMutations(page);
  const column = page.locator('main[data-session-key="local::perf-0"]');
  await column.locator('header').getByText('Performance session 0').dblclick();
  const input = column.getByRole('textbox', { name: 'Rename session' });
  await input.fill('Discard me');
  await input.press('Escape');
  await expect(input).toHaveCount(0);
  await expect(column.locator('header')).toContainText('Performance session 0');
  await page.waitForTimeout(300);
  expect(await mutations(page)).toHaveLength(0);
});

test('every blob in a project card carries a truncated title label', async ({ page }) => {
  const blob = page.locator('aside [data-session-key="local::perf-0"]');
  // "Performance session 0" → first 10 chars + an em-dash, not an ellipsis.
  await expect(blob).toContainText('Performanc—');
  await expect(blob).not.toContainText('…');
});
