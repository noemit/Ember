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
  // The blob's label chip in the rail follows the rename.
  await expect(page.locator('aside [data-session-key="local::perf-0"]')).toContainText('Renamed session');
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

test('every blob in a project card carries a two-line title chip', async ({ page }) => {
  const blob = page.locator('aside [data-session-key="local::perf-0"]');
  // The full title is present in a chip under the blob — clipped after two lines, never
  // shortened with an ellipsis or em-dash.
  await expect(blob).toContainText('Performance session 0');
  await expect(blob).not.toContainText('…');
  await expect(blob).not.toContainText('—');
  const label = blob.locator('[data-blob-label]');
  const box = await label.boundingBox();
  // Two 13px lines plus the chip's per-line padding — room for both lines, then it clips.
  expect(box?.height).toBeGreaterThan(15);
  expect(box?.height).toBeLessThanOrEqual(31);
});
