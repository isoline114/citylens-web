import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
] as const;

type AxeViolation = Awaited<
  ReturnType<InstanceType<typeof AxeBuilder>['analyze']>
>['violations'][number];

function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map(
          (node) =>
            `  - ${node.target.join(' ')}\n    ${node.failureSummary ?? 'No failure summary'}`,
        )
        .join('\n');
      return `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n${nodes}`;
    })
    .join('\n\n');
}

/**
 * Automated accessibility is a release gate, not a completeness claim.
 *
 * Axe covers machine-detectable WCAG A/AA failures. Keyboard interaction,
 * map comprehension, screen-reader flow, and domain-language clarity still
 * require deliberate product tests and human review.
 */
export async function expectNoWcagViolations(
  page: Page,
  surface: string,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_TAGS])
    .analyze();

  expect(
    results.violations,
    `${surface} has machine-detectable WCAG A/AA violations:\n${formatViolations(
      results.violations,
    )}`,
  ).toEqual([]);
}

/**
 * WCAG 1.4.10's 400% desktop-zoom case is equivalent to a 320 CSS-pixel
 * viewport. Wide evidence tables may own a labelled local scroller, but the
 * document itself must not require two-dimensional scrolling.
 */
export async function expectNoDocumentHorizontalOverflow(
  page: Page,
  surface: string,
): Promise<void> {
  const receipt = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = root.clientWidth;
    const contentWidth = Math.max(root.scrollWidth, body.scrollWidth);
    return {
      viewportWidth,
      contentWidth,
      overflow: Math.max(0, contentWidth - viewportWidth),
    };
  });

  expect(
    receipt.overflow,
    `${surface} overflows the ${receipt.viewportWidth}px document viewport: ${receipt.contentWidth}px content width`,
  ).toBeLessThanOrEqual(1);
}

/**
 * Applies the four WCAG 1.4.12 text-spacing overrides without changing the
 * component source. The audit style is removable so one task journey can
 * check several rendered panels independently.
 */
export async function applyWcagTextSpacing(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('citylens-text-spacing-audit')?.remove();
    const style = document.createElement('style');
    style.id = 'citylens-text-spacing-audit';
    style.textContent = `
      * {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p {
        margin-bottom: 2em !important;
      }
    `;
    document.head.appendChild(style);
  });
}

export async function clearWcagTextSpacing(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('citylens-text-spacing-audit')?.remove();
  });
}

export async function expectNoClippedEssentialText(
  page: Page,
  rootSelector: string,
  surface: string,
): Promise<void> {
  const failures = await page.evaluate((selector) => {
    const root = document.querySelector<HTMLElement>(selector);
    if (!root) return [`Missing audit root: ${selector}`];
    return Array.from(
      root.querySelectorAll<HTMLElement>('button, a, h1, h2, h3, h4, p'),
    ).flatMap((element) => {
      if (!element.innerText.trim()) return [];
      const style = window.getComputedStyle(element);
      const visible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        element.getClientRects().length > 0;
      if (!visible) return [];
      const horizontalClip =
        element.scrollWidth > element.clientWidth + 1 &&
        (style.overflowX === 'hidden' || style.overflowX === 'clip');
      const verticalClip =
        element.scrollHeight > element.clientHeight + 1 &&
        (style.overflowY === 'hidden' || style.overflowY === 'clip');
      return horizontalClip || verticalClip
        ? [
            `${element.tagName.toLowerCase()} "${element.innerText
              .trim()
              .replaceAll(/\s+/g, ' ')
              .slice(0, 120)}" (${element.clientWidth}×${element.clientHeight} client, ${element.scrollWidth}×${element.scrollHeight} scroll)`,
          ]
        : [];
    });
  }, rootSelector);

  expect(
    failures,
    `${surface} clips essential text under WCAG 1.4.12 spacing:\n${failures.join(
      '\n',
    )}`,
  ).toEqual([]);
}
