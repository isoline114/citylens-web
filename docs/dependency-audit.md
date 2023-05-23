# Dependency audit policy

`npm run audit` audits the complete npm dependency tree, including development
tools, and fails on high or critical findings. Registry errors, incomplete
reports and unknown dependency paths also fail. The policy and its regression
tests live in `scripts/dependency-audit-policy.mjs` and the adjacent test file.

## Temporary braces exception

Reviewed October 5, 2026; expires **November 4, 2026 at 00:00 UTC**. This is a
30-day exception for exactly:

- Package/version: `braces@3.0.3`.
- Advisory: [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- Exposure: development tools only. Every installed copy must have `dev: true`
  in `package-lock.json`; every dependent npm finding suppressed by this
  exception must also consist entirely of development nodes and lead only to
  this advisory. Any additional advisory, changed version, runtime dependency
  path, or expiry fails the gate.

The upstream advisory reports no patched release, and the
[maintainer issue](https://github.com/micromatch/braces/issues/70) remains open.
The vulnerable behavior requires an attacker-supplied, deeply nested brace
pattern. In this application the remaining paths are Tailwind 3's build-time
file scanning/watch tooling and Next.js ESLint's file scanning. Tailwind's
`content` patterns are fixed repository paths in `tailwind.config.js`; lint
scans the checked-out source. The app does not accept user-defined glob
patterns or import these packages in its runtime. Production deploys build
reviewed source; no production request supplies patterns to these tools.
The Next.js production file traces were checked for `node_modules/braces`
after the dependency update and contained no matching files.

The exception does **not** cover runtime libraries or other development
advisories. Next.js, sharp, PostCSS, brace-expansion, js-yaml, nanoid, undici and
Vitest were updated to patched releases independently. It does not suppress
raw `npm audit` findings: those remain visible for inspection.

Remove the exception as soon as upstream tooling resolves a patched braces
release or a reviewed replacement. Before the expiry, reassess the upstream
fix and dependency paths; do not extend the date without another explicit
review. Moving Tailwind to version 4 alone is insufficient because the Next.js
ESLint plugin also depends on fast-glob → micromatch → braces.
