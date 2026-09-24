import { expect, test, type Locator, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/?fixture=performance&noDock');
  await expect(page.locator('textarea')).toHaveCount(2);
});

const fileTransfer = (page: Page, name: string, type = 'text/plain') =>
  page.evaluateHandle(([fileName, mime]) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['hello from a dropped file'], fileName, { type: mime }));
    return transfer;
  }, [name, type] as const);

const dropOn = async (page: Page, target: Locator, name: string) => {
  const dataTransfer = await fileTransfer(page, name);
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await expect(page.getByTestId('drop-overlay')).toBeVisible();
  await target.dispatchEvent('drop', { dataTransfer });
  await expect(page.getByTestId('drop-overlay')).toHaveCount(0);
};

test('dropping files anywhere on a column attaches them to that column', async ({ page }) => {
  const columns = page.locator('main[data-session-key]');
  await dropOn(page, columns.nth(0).getByRole('log', { name: 'Conversation' }), 'notes.txt');
  await expect(columns.nth(0).getByRole('button', { name: 'Remove notes.txt' })).toBeVisible();

  // The second column is inactive; a drop still lands there, not in the active one.
  await dropOn(page, columns.nth(1).locator('textarea'), 'second.md');
  await expect(columns.nth(1).getByRole('button', { name: 'Remove second.md' })).toBeVisible();
  await expect(columns.nth(0).getByRole('button', { name: 'Remove second.md' })).toHaveCount(0);
});

test('dragging text (not files) does not show the drop overlay', async ({ page }) => {
  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.setData('text/plain', 'just words');
    return transfer;
  });
  const composer = page.locator('textarea').first();
  await composer.dispatchEvent('dragenter', { dataTransfer });
  await expect(page.getByTestId('drop-overlay')).toHaveCount(0);
});

test('pasting a file into the composer attaches it', async ({ page }) => {
  const composer = page.locator('textarea').first();
  await composer.focus();
  await composer.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['png'], 'screenshot.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
  });
  await expect(page.getByRole('button', { name: 'Remove screenshot.png' }).first()).toBeVisible();
  await expect(composer).toHaveValue('');
});
