#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';
import { evaluateDependencyAudit } from './dependency-audit-policy.mjs';

// Audit every dependency, including dev tooling. Never use --omit=dev here.
const audit = spawnSync('npm', [
  'audit', '--json', '--audit-level=high',
  '--include=dev', '--include=optional', '--include=peer', '--include=prod',
], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
  timeout: 180_000,
});

try {
  if (audit.error || ![0, 1].includes(audit.status)) {
    throw new Error(`npm audit did not complete: ${audit.error?.message ?? audit.stderr}`);
  }
  const report = JSON.parse(audit.stdout);
  const lockfile = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const result = evaluateDependencyAudit(report, lockfile);
  console.log(JSON.stringify(result, null, 2));
  if (result.exception) {
    console.warn(
      `Temporary dev-only braces exception expires ${result.exception.expires}. See docs/dependency-audit.md.`,
    );
  }
  process.exitCode = result.passed ? 0 : 1;
} catch (error) {
  console.error(`Dependency audit failed closed: ${error.message}`);
  process.exitCode = 1;
}
