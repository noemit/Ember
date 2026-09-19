import { expect, test, type Page } from '@playwright/test';

const chooseModel = async (page: Page, composerKey = 'local::perf-0') => {
  await page.getByRole('button', { name: 'Choose model' }).first().click();
  const picker = page.getByRole('dialog', { name: 'Choose a model' });
  await picker.getByRole('searchbox', { name: 'Search models' }).fill('GPT-5');
  await picker.getByRole('button', { name: 'GPT-5', exact: true }).click();
  await picker.getByRole('combobox', { name: 'Reasoning level' }).click();
  await page.getByRole('option', { name: 'high', exact: true }).click();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await expect.poll(() => page.evaluate(async (key) => (await window.ember.getSettings()).composerDrafts[key]?.modelId, composerKey)).toBe('openai/gpt-5');
};

const captureSends = async (page: Page) => page.evaluate(() => {
  const original = window.ember.request;
  window.ember.request = async (instanceId, method, path, body) => {
    if (method === 'POST' && (path.includes('/prompt_async') || /\/message-queue\/sessions\/[^/]+\/items/.test(path))) {
      const captured = JSON.parse(sessionStorage.getItem('model-test-requests') ?? '[]');
      sessionStorage.setItem('model-test-requests', JSON.stringify([...captured, { path, body }]));
      if (path.includes('/prompt_async')) return { ok: true, status: 200, data: {} };
    }
    return original(instanceId, method, path, body);
  };
});

const capturedSends = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('model-test-requests') ?? '[]'));

test.beforeEach(async ({ page }) => {
  await page.goto('/?fixture=performance&noDock');
  await expect(page.locator('textarea')).toHaveCount(2);
  await chooseModel(page);
});

test('explicit model and effort survive sending, clearing, and a reload with stale session metadata', async ({ page }) => {
  await captureSends(page);
  await page.locator('textarea').first().fill('Send with my chosen model');
  await page.locator('textarea').first().press('Enter');
  await expect.poll(() => capturedSends(page)).toMatchObject([{ body: { model: { providerID: 'openai', modelID: 'gpt-5' }, variant: 'high' } }]);
  await page.waitForTimeout(1000);
  await expect.poll(() => page.evaluate(async () => (await window.ember.getSettings()).composerDrafts['local::perf-0'])).toMatchObject({ text: '', modelId: 'openai/gpt-5', variant: 'high' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Choose model' }).first()).toContainText('GPT-5');
  await captureSends(page);
  await page.locator('textarea').first().fill('Another message');
  await page.locator('textarea').first().fill('');
  await page.locator('textarea').first().fill('Still the chosen model');
  await page.locator('textarea').first().press('Enter');
  await expect.poll(() => capturedSends(page)).toMatchObject([
    { body: { model: { providerID: 'openai', modelID: 'gpt-5' }, variant: 'high' } },
    { body: { model: { providerID: 'openai', modelID: 'gpt-5' }, variant: 'high' } },
  ]);
});

for (const busy of [false, true]) {
  test(`unavailable explicit models never ${busy ? 'queue' : 'send'} using a fallback`, async ({ page }) => {
    await page.goto(`/?fixture=performance&noDock&missingModel=openai/gpt-5${busy ? '&busy' : ''}`);
    await expect(page.locator('textarea')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Choose model' }).first()).not.toContainText('Server default');
    await captureSends(page);
    await page.locator('textarea').first().fill('Keep this draft until I choose a model');
    await page.locator('textarea').first().press('Enter');
    await page.waitForTimeout(800);
    expect(await capturedSends(page)).toEqual([]);
    await expect(page.locator('textarea').first()).toHaveValue('Keep this draft until I choose a model');
    await expect(page.getByRole('alert').filter({ hasText: 'openai/gpt-5' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose model' }).first()).toContainText('openai/gpt-5');
    await page.locator('textarea').first().press('Alt+Enter');
    await page.locator('textarea').first().press('ControlOrMeta+Enter');
    await page.locator('main').first().getByRole('button', { name: /Send note: Keep this draft/ }).click();
    await page.waitForTimeout(300);
    expect(await capturedSends(page)).toEqual([]);
    await expect(page.locator('main').first().getByRole('button', { name: /Send note: Keep this draft/ })).toBeVisible();
    await page.getByRole('button', { name: 'Choose model' }).first().click();
    const picker = page.getByRole('dialog', { name: 'Choose a model' });
    await expect(picker.getByRole('button', { name: 'Done', exact: true })).toBeDisabled();
    await expect(picker.getByRole('status')).toContainText('openai/gpt-5');
  });
}

test('catalogue refresh cannot replace a missing choice and restores it when available again', async ({ page }) => {
  await page.evaluate(() => {
    const original = window.ember.request;
    sessionStorage.setItem('model-test-hide', 'yes');
    window.ember.request = async (instance, method, path, body) => {
      const response = await original(instance, method, path, body);
      if (path === '/api/provider' && sessionStorage.getItem('model-test-hide') === 'yes') {
        const data = response.data as { all: Array<{ id: string }> };
        return { ...response, data: { ...data, all: data.all.filter((provider) => provider.id !== 'openai') } };
      }
      return response;
    };
  });
  await page.getByRole('button', { name: 'Choose model' }).first().click();
  const picker = page.getByRole('dialog', { name: 'Choose a model' });
  await expect(picker.getByRole('status')).toContainText('openai/gpt-5');
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'openai/gpt-5' })).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('model-test-hide', 'no'));
  await page.getByRole('button', { name: 'Refresh models', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Choose model' }).first()).toContainText('GPT-5');
  await expect(page.getByRole('alert').filter({ hasText: 'openai/gpt-5' })).toHaveCount(0);
  await captureSends(page);
  await page.locator('textarea').first().fill('The same choice returned');
  await page.locator('textarea').first().press('Enter');
  await expect.poll(() => capturedSends(page)).toMatchObject([{ body: { model: { providerID: 'openai', modelID: 'gpt-5' }, variant: 'high' } }]);
});

test('an unavailable reasoning level requires an explicit replacement', async ({ page }) => {
  await page.evaluate(() => {
    const original = window.ember.request;
    window.ember.request = async (instance, method, path, body) => {
      const response = await original(instance, method, path, body);
      if (path === '/api/provider') {
        const data = response.data as { all: Array<{ id: string; models: Record<string, { variants: Record<string, unknown> }> }> };
        const provider = data.all.find((entry) => entry.id === 'openai');
        if (provider) provider.models['gpt-5'].variants = { low: {} };
      }
      return response;
    };
  });
  await page.getByRole('button', { name: 'Choose model' }).first().click();
  const picker = page.getByRole('dialog', { name: 'Choose a model' });
  await expect(picker.getByRole('status')).toContainText('reasoning level high');
  await expect(picker.getByRole('button', { name: 'Done', exact: true })).toBeDisabled();
  await picker.getByRole('combobox', { name: 'Reasoning level' }).click();
  await page.getByRole('option', { name: 'low', exact: true }).click();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await captureSends(page);
  await page.locator('textarea').first().fill('Use the effort I explicitly selected');
  await page.locator('textarea').first().press('Enter');
  await expect.poll(() => capturedSends(page)).toMatchObject([{ body: { model: { providerID: 'openai', modelID: 'gpt-5' }, variant: 'low' } }]);
});

test('minimizing and restoring a column preserves its model choice', async ({ page }) => {
  await page.getByRole('button', { name: 'Minimize session', exact: true }).first().click();
  await page.keyboard.press('ControlOrMeta+1');
  await expect(page.getByRole('button', { name: 'Choose model' }).first()).toContainText('GPT-5');
  await captureSends(page);
  await page.locator('textarea').first().fill('Still my model after restoring');
  await page.locator('textarea').first().press('Enter');
  await expect.poll(() => capturedSends(page)).toMatchObject([{ body: { model: { providerID: 'openai', modelID: 'gpt-5' }, variant: 'high' } }]);
});

test('queueing preserves the selected model and reasoning in sendConfig', async ({ page }) => {
  await page.goto('/?fixture=performance&noDock&busy');
  await expect(page.getByRole('textbox', { name: 'Queue a follow-up message' }).first()).toBeVisible();
  await captureSends(page);
  await page.locator('textarea').first().fill('Queue this with GPT-5');
  await page.locator('textarea').first().press('Enter');
  await expect.poll(() => capturedSends(page)).toMatchObject([{ body: { item: { sendConfig: { providerID: 'openai', modelID: 'gpt-5', variant: 'high' } } } }]);
  await page.waitForTimeout(1000);
  await expect.poll(() => page.evaluate(async () => (await window.ember.getSettings()).composerDrafts['local::perf-0']?.modelId)).toBe('openai/gpt-5');
  await page.getByRole('button', { name: 'Change model for queued message: Queue this with GPT-5' }).click();
  const picker = page.getByRole('dialog', { name: 'Choose a model' });
  await picker.getByRole('searchbox', { name: 'Search models' }).fill('Claude Opus');
  await picker.getByRole('button', { name: 'Claude Opus', exact: true }).click();
  await picker.getByRole('combobox', { name: 'Reasoning level' }).click();
  await page.getByRole('option', { name: 'low', exact: true }).click();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await expect.poll(async () => (await capturedSends(page)).filter((entry: { body?: { item?: unknown } }) => entry.body?.item)).toMatchObject([
    { body: { item: { sendConfig: { providerID: 'openai', modelID: 'gpt-5', variant: 'high' } } } },
    { body: { item: { sendConfig: { providerID: 'anthropic', modelID: 'claude-opus', variant: 'low' } } } },
  ]);
  await page.getByRole('button', { name: 'Change model for queued message: Queue this with GPT-5' }).click();
  await picker.getByRole('combobox', { name: 'Reasoning level' }).click();
  await page.getByRole('option', { name: 'Default', exact: true }).click();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  const enqueues = async () => (await capturedSends(page)).filter((entry: { body?: { item?: unknown } }) => entry.body?.item);
  await expect.poll(async () => (await enqueues()).length).toBe(3);
  expect((await enqueues())[2].body.item.sendConfig).toEqual({ providerID: 'anthropic', modelID: 'claude-opus' });
  await page.getByRole('button', { name: 'Change model for queued message: Queue this with GPT-5' }).click();
  await picker.getByRole('button', { name: 'Anthropic / Claude Sonnet (Default)', exact: true }).click();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await expect.poll(async () => (await enqueues()).length).toBe(4);
  expect((await enqueues())[3].body.item.sendConfig).toEqual({ providerID: 'anthropic', modelID: 'claude-sonnet' });
});

test('server default is used only after explicitly choosing it', async ({ page }) => {
  await page.getByRole('button', { name: 'Choose model' }).first().click();
  const picker = page.getByRole('dialog', { name: 'Choose a model' });
  await picker.getByRole('button', { name: 'Anthropic / Claude Sonnet (Default)', exact: true }).click();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await captureSends(page);
  await page.locator('textarea').first().fill('Use the server default intentionally');
  await page.locator('textarea').first().press('Enter');
  await expect.poll(async () => (await capturedSends(page)).length).toBe(1);
  expect((await capturedSends(page))[0].body).not.toHaveProperty('model');
  await page.waitForTimeout(1000);
  await expect.poll(() => page.evaluate(async () => (await window.ember.getSettings()).composerDrafts['local::perf-0']?.modelId)).toBe('default');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Choose model' }).first()).toContainText('Server default');
});

test('failed sends restore text without losing the retained model choice', async ({ page }) => {
  await page.evaluate(() => {
    const original = window.ember.request;
    window.ember.request = async (instance, method, path, body) => path.includes('/prompt_async')
      ? { ok: false, status: 503, data: { error: 'Synthetic provider failure' } }
      : original(instance, method, path, body);
  });
  await page.locator('textarea').first().fill('Keep this failed message');
  await page.locator('textarea').first().press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Synthetic provider failure' })).toBeVisible();
  await expect(page.locator('textarea').first()).toHaveValue('Keep this failed message');
  await expect(page.getByRole('button', { name: 'Choose model' }).first()).toContainText('GPT-5');
});

test('new-agent creation transfers the chosen model to the created session', async ({ page }) => {
  await page.getByRole('button', { name: 'New session in Habit', exact: true }).first().click();
  await expect(page.locator('textarea')).toHaveCount(1);
  await chooseModel(page, 'new::local');
  await captureSends(page);
  await page.locator('textarea').fill('Create using this model');
  await page.locator('textarea').press('Enter');
  await expect.poll(() => capturedSends(page)).toMatchObject([{ body: { model: { providerID: 'openai', modelID: 'gpt-5' }, variant: 'high' } }]);
  const id = decodeURIComponent((await capturedSends(page))[0].path.split('/')[3]);
  await expect.poll(() => page.evaluate(async (id) => (await window.ember.getSettings()).composerDrafts[`local::${id}`], id)).toMatchObject({ modelId: 'openai/gpt-5', variant: 'high' });
});

test('saving a note does not discard the explicit model selection', async ({ page }) => {
  await page.locator('textarea').first().fill('Save this for later');
  await page.locator('textarea').first().press('ControlOrMeta+Enter');
  await page.waitForTimeout(1000);
  await expect.poll(() => page.evaluate(async () => (await window.ember.getSettings()).composerDrafts['local::perf-0'])).toMatchObject({ text: '', modelId: 'openai/gpt-5', variant: 'high' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Choose model' }).first()).toContainText('GPT-5');
});
