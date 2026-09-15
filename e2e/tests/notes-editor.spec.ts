import { test, expect } from '@playwright/test';
import { login } from '../helpers/testHelpers';

test('new note placeholder sits on the same line as the caret', async ({
    page,
}) => {
    await login(page, 'http://127.0.0.1:4180');

    // Trigger the new-note flow via the sidebar "+" (hidden until hover).
    const notesHeader = page
        .locator('span', { hasText: /^Notes$/ })
        .first();
    await notesHeader.hover();
    const addButton = page.getByRole('button', { name: /add note/i });
    await addButton.click();

    // Inline editor should open with a title input and CodeMirror content.
    const titleInput = page.getByPlaceholder(/title/i).first();
    await expect(titleInput).toBeVisible({ timeout: 10000 });

    const content = page.locator('.cm-content');
    await expect(content).toBeVisible();

    // Focus the editor so the native caret is visible.
    await content.click();

    const placeholderEl = page.locator('.cm-placeholder');
    await expect(placeholderEl).toBeVisible();

    // Geometry: native caret rect (Selection API) vs placeholder rect
    const phBox = await placeholderEl.boundingBox();
    const measure = await page.evaluate(() => {
        const content = document.querySelector('.cm-content') as HTMLElement;
        const ph = document.querySelector('.cm-placeholder') as HTMLElement;
        const line = document.querySelector('.cm-line') as HTMLElement;
        const titleInput = document.querySelector(
            'input[type="text"]'
        ) as HTMLInputElement | null;
        const cs = (el: Element) => window.getComputedStyle(el);

        const sel = window.getSelection();
        let caretRect: any = null;
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0).cloneRange();
            const rect =
                range.getClientRects().length > 0
                    ? range.getClientRects()[0]
                    : range.startContainer.parentElement?.getBoundingClientRect();
            caretRect = rect
                ? {
                      top: rect.top,
                      left: rect.left,
                      bottom: rect.bottom,
                      height: rect.height,
                  }
                : null;
        }

        return {
            activeElement: document.activeElement?.className || 'none',
            isContentFocused:
                document.activeElement === content ||
                content.contains(document.activeElement),
            caretRect,
            drawnCursor: (() => {
                const cur = document.querySelector(
                    '.cm-cursor'
                ) as HTMLElement | null;
                if (!cur) return null;
                const r = cur.getBoundingClientRect();
                return {
                    top: r.top,
                    height: r.height,
                    visibility: cs(cur).visibility,
                };
            })(),
            phRect: ph
                ? {
                      top: ph.getBoundingClientRect().top,
                      left: ph.getBoundingClientRect().left,
                      bottom: ph.getBoundingClientRect().bottom,
                  }
                : null,
            phStyle: ph
                ? {
                      display: cs(ph).display,
                      verticalAlign: cs(ph).verticalAlign,
                  }
                : null,
            lineRect: line
                ? {
                      top: line.getBoundingClientRect().top,
                      left: line.getBoundingClientRect().left,
                  }
                : null,
            titleRect: titleInput
                ? {
                      top: titleInput.getBoundingClientRect().top,
                      bottom: titleInput.getBoundingClientRect().bottom,
                  }
                : null,
            isTitleFocused: document.activeElement === titleInput,
        };
    });

    console.log('PROBE:', JSON.stringify(measure, null, 2));
    console.log('PH_BOX:', JSON.stringify(phBox));

    // The caret and the placeholder must share the first line: caret top
    // within one line-height of placeholder top.
    expect(measure.isContentFocused).toBe(true);
    expect(measure.phRect).toBeTruthy();
    expect(measure.caretRect).toBeTruthy();
    expect(
        Math.abs(measure.caretRect!.top - measure.phRect!.top)
    ).toBeLessThan(30);
    // With drawSelection(), the drawn caret must match the line box height
    // (~24px) rather than the font box (~32px), so it aligns with the
    // placeholder text instead of hanging below it.
    expect(measure.drawnCursor).toBeTruthy();
    expect(measure.drawnCursor!.visibility).toBe('visible');
    expect(measure.drawnCursor!.height).toBeLessThan(28);
    expect(
        Math.abs(measure.drawnCursor!.top - measure.phRect!.top)
    ).toBeLessThan(6);
});

test('new note flow saves a typed note via save button', async ({ page }) => {
    await login(page, 'http://127.0.0.1:4180');
    const notesHeader = page
        .locator('span', { hasText: /^Notes$/ })
        .first();
    await notesHeader.hover();
    await page.getByRole('button', { name: /add note/i }).click();

    const titleInput = page.getByPlaceholder(/title/i).first();
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await titleInput.fill('E2E probe note');

    const content = page.locator('.cm-content');
    await content.click();
    await page.keyboard.type('hello from e2e');

    // Save via the options dropdown (aria-label noteOptions, then Save).
    await page
        .getByLabel(/note options/i)
        .first()
        .click();
    await page.getByRole('button', { name: /^Save$/ }).click();

    // Preview shows the title text after save.
    await expect(page.getByText('E2E probe note')).toBeVisible({
        timeout: 10000,
    });
});
