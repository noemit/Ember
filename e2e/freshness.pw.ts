import { expect, test, type Page } from '@playwright/test';

// Both run well inside the old 20s "recently read" window and under the 20s live column poll, so
// only a switch-time or background refresh can make them pass.
test.beforeEach(async ({ page }) => {
  await page.goto('/?fixture=performance&noDock');
  await expect(page.locator('main[data-session-key]')).toHaveCount(2);
  await expect(page.locator('main[data-session-key]').nth(1).getByText('Synthetic message 1', { exact: true })).toBeVisible();
});

const hideSecondColumn = async (page: Page) => {
  await page.locator('main[data-session-key]').nth(1).getByRole('button', { name: 'Minimize session', exact: true }).click();
  await expect(page.locator('main[data-session-key]')).toHaveCount(1);
};

const restoreSecondColumn = (page: Page) =>
  page.getByRole('button', { name: 'Restore Performance session 1' }).click();

test('switching back to a session that changed while hidden shows the new reply', async ({ page }) => {
  await hideSecondColumn(page);
  // No stream hint: as if the event was lost. Only the session's `updated` moved.
  await page.evaluate(() => window.emberFixture!.appendMessage('Reply while hidden', 'perf-1', true));
  await restoreSecondColumn(page);
  await expect(page.getByText('Reply while hidden', { exact: true })).toBeVisible({ timeout: 5000 });
});

test('a background update keeps the cached transcript current without a fetch on switch', async ({ page }) => {
  await hideSecondColumn(page);
  await page.evaluate(() => {
    const original = window.ember.request;
    const state = { backgroundReads: 0, hang: false };
    (window as unknown as { freshness: typeof state }).freshness = state;
    window.ember.request = async (instance, method, path, body) => {
      if (!path.startsWith('/api/session/perf-1/message')) return original(instance, method, path, body);
      if (state.hang) return new Promise(() => {});
      const response = await original(instance, method, path, body);
      state.backgroundReads += 1;
      return response;
    };
  });
  await page.evaluate(() => window.emberFixture!.appendMessage('Background reply', 'perf-1'));
  // The hidden session's summary refresh is the only reader of its messages right now.
  await expect.poll(() => page.evaluate(() => (window as unknown as { freshness: { backgroundReads: number } }).freshness.backgroundReads)).toBeGreaterThan(0);
  // From here on, perf-1 transcript reads hang: the reply can only come from the merged cache.
  await page.evaluate(() => { (window as unknown as { freshness: { hang: boolean } }).freshness.hang = true; });
  await restoreSecondColumn(page);
  await expect(page.getByRole('log', { name: 'Conversation' }).nth(1).getByText('Background reply', { exact: true })).toBeVisible();
});
