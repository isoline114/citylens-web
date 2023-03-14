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
