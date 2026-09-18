import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/?fixture=performance&noDock');
  await expect(page.locator('textarea')).toHaveCount(2);
});

test('independent drafts survive saves and reloads', async ({ page }) => {
  await page.locator('textarea').nth(0).fill('Draft A survives');
  await expect.poll(() => page.evaluate(async () => (await window.ember.getSettings()).composerDrafts['local::perf-0']?.text)).toBe('Draft A survives');
  await page.locator('textarea').nth(1).fill('Draft B survives');
  await expect.poll(() => page.evaluate(async () => Object.values((await window.ember.getSettings()).composerDrafts).map((draft) => draft.text).sort())).toEqual(['Draft A survives', 'Draft B survives']);
  await page.reload();
  await expect(page.locator('textarea').nth(0)).toHaveValue('Draft A survives');
  await expect(page.locator('textarea').nth(1)).toHaveValue('Draft B survives');
  await page.locator('textarea').nth(0).fill('');
  await expect.poll(() => page.evaluate(async () => (await window.ember.getSettings()).composerDrafts['local::perf-0']?.text ?? '')).toBe('');
  await expect(page.locator('textarea').nth(1)).toHaveValue('Draft B survives');
});

test('a failed draft save remains retryable after another column saves', async ({ page }) => {
  await page.evaluate(() => {
    const save = window.ember.setSettings;
    let failed = false;
    window.ember.setSettings = async (patch) => {
      if (!failed && patch.composerDraftChanges?.['local::perf-0']) {
        failed = true;
        throw new Error('Simulated draft save failure');
      }
      return save(patch);
    };
  });
  await page.locator('textarea').first().fill('Keep this failed draft');
  await expect(page.getByRole('button', { name: 'Retry failed action' })).toBeVisible();
  await page.locator('textarea').nth(1).fill('Other draft saved');
  await expect.poll(() => page.evaluate(async () => (await window.ember.getSettings()).composerDrafts['local::perf-1']?.text)).toBe('Other draft saved');
  await expect(page.locator('textarea').first()).toHaveValue('Keep this failed draft');
  await page.getByRole('button', { name: 'Retry failed action' }).click();
  await expect.poll(() => page.evaluate(async () => (await window.ember.getSettings()).composerDrafts['local::perf-0']?.text)).toBe('Keep this failed draft');
});

test('shortcut tooltip opens on pointer hover', async ({ page }) => {
  const save = page.getByRole('button', { name: 'Save as note', exact: true }).first();
  await save.hover();
  await expect(page.getByRole('tooltip', { name: /Save as note/ })).toBeVisible();
});

test('palette searches beyond its initial result limit', async ({ page }) => {
  await page.getByRole('button', { name: 'Open command palette' }).click();
  await page.getByRole('combobox', { name: 'Search commands' }).fill('Performance session 84');
  await expect(page.getByRole('option').filter({ hasText: 'Performance session 84' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Search commands' }).fill('new agent');
  await expect(page.getByRole('option').filter({ hasText: 'New agent on MacBook' })).toBeVisible();
});

test('long history mounts a bounded window and supports finding old messages', async ({ page }) => {
  const history = page.getByRole('log', { name: 'Conversation' }).first();
  await expect(history.getByText('Synthetic message 9999', { exact: true })).toBeVisible();
  expect(await history.locator('[data-index]').count()).toBeLessThan(100);
  await history.locator('..').click({ position: { x: 40, y: 40 } });
  await page.keyboard.press('ControlOrMeta+f');
  await page.getByRole('textbox', { name: 'Find in conversation' }).fill('Synthetic message 1234');
  await expect(history.getByText('Synthetic message 1234', { exact: true })).toBeVisible();
  await page.locator('textarea').first().fill('Typing without remounting history');
  await expect(history.getByText('Synthetic message 1234', { exact: true })).toBeVisible();
  await page.evaluate(() => window.emberFixture!.appendMessage('New streaming fixture response'));
  await expect(page.getByRole('button', { name: 'Jump to latest' }).first()).toBeVisible();
  await expect(history.getByText('Synthetic message 1234', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Jump to latest' }).first().click();
  await expect(history.getByText('New streaming fixture response', { exact: true })).toBeVisible();
});

test('project cleanup and shortcut hints are discoverable', async ({ page }) => {
  await page.getByRole('button', { name: 'Project actions for Habit' }).first().click();
  await expect(page.getByRole('menuitem', { name: /Archive .* inactive/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Project actions for Habit' }).first()).toBeFocused();
  await page.locator('textarea').first().fill('A note');
  await page.getByRole('button', { name: 'Save as note', exact: true }).first().focus();
  await expect(page.getByRole('tooltip', { name: /Save as note/ })).toBeVisible();
});

test('personal ratings persist and appear in the existing model picker', async ({ page }) => {
  const helpful = page.getByRole('log').nth(1).getByRole('button', { name: 'Mark response helpful', exact: true });
  await expect(helpful).toBeAttached();
  await helpful.focus();
  await helpful.click();
  await expect(helpful).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(async () => (await window.ember.getModelStats!()).filter((record) => record.rating === 'helpful').length)).toBe(1);
  await page.getByRole('button', { name: 'Choose model' }).last().click();
  await expect(page.getByRole('region', { name: 'Your model experience' }).first()).toContainText('1 / 1 rated');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('log').nth(1).getByRole('button', { name: 'Mark response helpful', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('healthy instances become usable while a slow instance is still checking', async ({ page }) => {
  await page.goto('/?fixture=performance&noDock&slowInstance');
  await expect(page.getByRole('log').first().getByText('Synthetic message 9999', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Instances', exact: true }).click();
  await expect(page.getByRole('menuitemcheckbox').filter({ hasText: 'Studio (ssh)' })).toContainText('checking connection');
  await page.evaluate(() => window.emberFixture!.releaseSlowInstance());
  await expect(page.getByRole('menuitemcheckbox').filter({ hasText: 'Studio (ssh)' })).not.toContainText('checking connection');
});

test('clients without dock capability never load dock rendering code', async ({ page }) => {
  const dockRequests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('dockIcon')) dockRequests.push(request.url()); });
  await page.reload();
  await expect(page.locator('textarea')).toHaveCount(2);
  await expect(page.getByRole('log').first().getByText('Synthetic message 9999', { exact: true })).toBeVisible();
  expect(dockRequests).toEqual([]);
});
