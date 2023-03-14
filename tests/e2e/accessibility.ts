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
