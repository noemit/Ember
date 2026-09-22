import { expect, test, type Page } from '@playwright/test';

const captureMutations = (page: Page) => page.evaluate(() => {
  const original = window.ember.request;
  window.ember.request = async (instance, method, path, body) => {
    if (method !== 'GET') {
      const entries = JSON.parse(sessionStorage.getItem('archive-test-requests') ?? '[]');
      sessionStorage.setItem('archive-test-requests', JSON.stringify([...entries, { instance, method, path, body }]));
    }
    return original(instance, method, path, body);
  };
});
const mutations = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('archive-test-requests') ?? '[]'));
const visibleMarkers = (page: Page) => page.locator('aside [data-visible-column="true"]');

test.beforeEach(async ({ page }) => {
  await page.goto('/?fixture=performance&noDock');
  await expect(page.locator('textarea')).toHaveCount(2);
});

test('column X archives once and Undo restores the session and its draft', async ({ page }) => {
  await captureMutations(page);
  const column = page.locator('main').first();
  await column.locator('textarea').fill('Keep this draft through archiving');
  const archive = column.locator('header button').filter({ has: page.locator('svg.lucide-x') });
  await expect(archive).toHaveAttribute('aria-label', 'Archive session');
  await expect(column.locator('header svg.lucide-archive')).toHaveCount(0);
  await expect(column.getByRole('button', { name: 'Close session', exact: true })).toHaveCount(0);
  await archive.click();
  await expect(page.locator('textarea')).toHaveCount(1);
  await expect.poll(async () => (await mutations(page)).filter((entry: { method: string }) => entry.method === 'PATCH').length).toBe(1);
  expect((await mutations(page))[0].path).toContain('/api/session/perf-0');
  expect((await mutations(page))[0].body.time.archived).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('textarea')).toHaveCount(2);
  await expect(page.locator('main[data-session-key="local::perf-0"] textarea')).toHaveValue('Keep this draft through archiving');
  await expect.poll(async () => (await mutations(page)).filter((entry: { method: string }) => entry.method === 'PATCH').length).toBe(2);
  expect((await mutations(page))[1].body.time.archived).toBe(0);
});

test('all visible columns have underlines regardless of focus; minimized tabs do not', async ({ page }) => {
  await expect(visibleMarkers(page)).toHaveCount(2);
  await expect(page.locator('main').first().locator('header')).toHaveAttribute('data-active', 'true');
  await page.locator('main').nth(1).locator('textarea').click();
  await expect(page.locator('main').nth(1).locator('header')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('main header[data-active="true"]')).toHaveCount(1);
  await expect(visibleMarkers(page)).toHaveCount(2);
  for (const marker of await visibleMarkers(page).all()) {
    expect((await marker.getAttribute('class'))?.split(/\s+/)).not.toContain('ring-2');
    await expect(marker.locator('[data-column-underline]')).toBeVisible();
  }
  await page.locator('main').first().getByRole('button', { name: 'Minimize session', exact: true }).click();
  await expect(visibleMarkers(page)).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+1');
  await expect(visibleMarkers(page)).toHaveCount(2);
});

test('X on an inactive column archives on the first click, not just activate', async ({ page }) => {
  await captureMutations(page);
  const inactive = page.locator('main').nth(1);
  await expect(inactive.locator('header')).toHaveAttribute('data-active', 'false');
  await inactive.getByRole('button', { name: 'Archive session', exact: true }).click();
  await expect(page.locator('textarea')).toHaveCount(1);
  await expect.poll(async () => (await mutations(page)).filter((entry: { method: string }) => entry.method === 'PATCH').length).toBe(1);
  expect((await mutations(page))[0].path).toContain('/api/session/perf-1');
});

test('tab X archives rather than just removing the workspace entry', async ({ page }) => {
  await page.locator('main').first().getByRole('button', { name: 'Minimize session', exact: true }).click();
  await captureMutations(page);
  const tabs = page.getByLabel('Open sessions', { exact: true });
  await expect(tabs.locator('svg.lucide-archive')).toHaveCount(0);
  await tabs.getByRole('button', { name: 'Archive Performance session 0', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await expect.poll(async () => (await mutations(page)).filter((entry: { method: string }) => entry.method === 'PATCH').length).toBe(1);
  await expect(tabs).toHaveCount(0);
});

for (const status of ['busy', 'waiting']) {
  test(`${status} sessions require confirmation and archive never sends abort`, async ({ page }) => {
    await page.goto(`/?fixture=performance&noDock&${status}`);
    await expect(page.locator('textarea')).toHaveCount(2);
    if (status === 'busy') await expect(page.getByRole('textbox', { name: 'Queue a follow-up message' }).first()).toBeVisible();
    else await expect(page.locator('main').first().getByText('Approval needed', { exact: true }).first()).toBeVisible();
    await captureMutations(page);
    await page.locator('main').first().getByRole('button', { name: 'Archive session', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Archive active session?' });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Keep session', exact: true })).toBeFocused();
    expect(await mutations(page)).toEqual([]);
    await confirmation.getByRole('button', { name: 'Keep session', exact: true }).click();
    await expect(page.locator('textarea')).toHaveCount(2);
    await page.locator('main').first().getByRole('button', { name: 'Archive session', exact: true }).click();
    await confirmation.getByRole('button', { name: 'Archive anyway', exact: true }).click();
    await expect(page.locator('textarea')).toHaveCount(1);
    const sent = await mutations(page);
    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe('PATCH');
    expect(sent[0].path).not.toContain('/abort');
  });
}

test('a failed archive keeps the column and offers a retry', async ({ page }) => {
  await page.evaluate(() => {
    const original = window.ember.request;
    let failed = false;
    window.ember.request = async (instance, method, path, body) => {
      if (!failed && method === 'PATCH' && path.includes('/api/session/perf-0')) {
        failed = true;
        return { ok: false, status: 503, data: null };
      }
      return original(instance, method, path, body);
    };
  });
  await page.locator('main').first().getByRole('button', { name: 'Archive session', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not archive');
  await expect(page.locator('textarea')).toHaveCount(2);
  await page.getByRole('button', { name: 'Retry failed action' }).click();
  await expect(page.locator('textarea')).toHaveCount(1);
});

test('the underline follows whichever blob is a column', async ({ page }) => {
  await page.getByRole('button', { name: 'Open command palette' }).click();
  await page.getByRole('combobox', { name: 'Search commands' }).fill('Performance session 2');
  await page.getByRole('option').filter({ hasText: 'Performance session 2' }).first().click();
  const swapped = page.locator('aside [data-session-key="local::perf-2"]');
  await expect(swapped).toHaveAttribute('data-visible-column', 'true');
  await expect(visibleMarkers(page)).toHaveCount(await page.locator('main[data-session-key]').count());
});

test('a day-old finished scheduled run archives itself', async ({ page }) => {
  await page.goto('/?noDock');
  // ses_a7 ("Daily channel brief · yesterday") is bound to a task and idle for a day.
  await expect(page.getByText(/Auto-archived \d+ finished scheduled run/)).toBeVisible();
  await expect(page.locator('aside')).not.toContainText('Daily channel brief · yesterday');
});

test('one-session project rows use the same visible-column indicator', async ({ page }) => {
  await page.goto('/?noDock');
  await page.getByRole('button', { name: /Agent Platform/ }).first().click();
  const row = page.locator('aside [data-session-key="studio::ses_b2"]');
  await expect(row).toHaveAttribute('data-visible-column', 'true');
  await expect(row.locator('[data-column-underline]')).toBeVisible();
});
