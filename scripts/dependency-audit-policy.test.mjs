import { describe, expect, it } from 'vitest';
import { BRACES_EXCEPTION, evaluateDependencyAudit } from './dependency-audit-policy.mjs';

const reviewDate = new Date('2026-10-05T12:00:00Z');

function fixture() {
  return {
    report: {
      auditReportVersion: 2,
      vulnerabilities: {
        braces: {
          name: 'braces',
          severity: 'high',
          nodes: ['node_modules/braces'],
          via: [{
            name: 'braces',
            dependency: 'braces',
            url: BRACES_EXCEPTION.advisory,
            severity: 'high',
          }],
        },
        micromatch: {
          name: 'micromatch',
          severity: 'high',
          nodes: ['node_modules/micromatch'],
          via: ['braces'],
        },
      },
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 2 } },
    },
    lock: {
      packages: {
        'node_modules/braces': { version: '3.0.3', dev: true },
        'node_modules/micromatch': { version: '4.0.8', dev: true },
      },
    },
  };
}

describe('full dependency audit with the reviewed braces exception', () => {
  it('allows only the exact advisory and its dev-only dependent findings', () => {
    const { report, lock } = fixture();
    const result = evaluateDependencyAudit(report, lock, reviewDate);
    expect(result.passed).toBe(true);
    expect(result.excepted).toEqual(['braces', 'micromatch']);
    expect(result.exception.expires).toBe('2026-11-04T00:00:00.000Z');
  });

  it.each(['high', 'critical'])('fails a new %s advisory, including dev tooling', (severity) => {
    const { report, lock } = fixture();
    report.vulnerabilities.newPackage = {
      name: 'newPackage', severity, nodes: ['node_modules/newPackage'],
      via: [{ name: 'newPackage', dependency: 'newPackage', severity, url: 'https://github.com/advisories/GHSA-new' }],
    };
    lock.packages['node_modules/newPackage'] = { version: '1.0.0', dev: true };
    report.metadata.vulnerabilities[severity] += 1;
    report.metadata.vulnerabilities.total += 1;
    expect(evaluateDependencyAudit(report, lock, reviewDate).passed).toBe(false);
  });

  it('fails an additional advisory on the otherwise excepted package', () => {
    const { report, lock } = fixture();
    report.vulnerabilities.braces.via.push({
      name: 'braces', dependency: 'braces', severity: 'high',
      url: 'https://github.com/advisories/GHSA-another',
    });
    expect(evaluateDependencyAudit(report, lock, reviewDate).excepted).toEqual([]);
  });

  it.each(['braces', 'micromatch'])('rejects a runtime dependency path through %s', (name) => {
    const { report, lock } = fixture();
    delete lock.packages[`node_modules/${name}`].dev;
    expect(evaluateDependencyAudit(report, lock, reviewDate).passed).toBe(false);
  });

  it('rejects an additional production copy even if omitted from the audit nodes', () => {
    const { report, lock } = fixture();
    lock.packages['node_modules/runtime/node_modules/braces'] = { version: '3.0.3' };
    expect(evaluateDependencyAudit(report, lock, reviewDate).excepted).toEqual([]);
  });

  it('rejects different versions and mismatched advisory package names', () => {
    const { report, lock } = fixture();
    lock.packages['node_modules/braces'].version = '3.0.2';
    expect(evaluateDependencyAudit(report, lock, reviewDate).passed).toBe(false);
    lock.packages['node_modules/braces'].version = '3.0.3';
    report.vulnerabilities.braces.via[0].dependency = 'other';
    expect(evaluateDependencyAudit(report, lock, reviewDate).passed).toBe(false);
  });

  it('fails at the expiry instant and after expiry', () => {
    const { report, lock } = fixture();
    for (const date of ['2026-11-04T00:00:00Z', '2026-11-05T00:00:00Z']) {
      const result = evaluateDependencyAudit(report, lock, new Date(date));
      expect(result.passed).toBe(false);
      expect(result.exception_expired).toBe(true);
    }
  });

  it('fails unresolved causes and cyclic audit graphs', () => {
    for (const mutate of [
      (report) => { report.vulnerabilities.micromatch.via = ['missing']; },
      (report) => { report.vulnerabilities.braces.via = ['micromatch']; },
    ]) {
      const { report, lock } = fixture();
      mutate(report);
      expect(evaluateDependencyAudit(report, lock, reviewDate).passed).toBe(false);
    }
  });

  it('fails closed on incomplete or failed npm reports', () => {
    const { report, lock } = fixture();
    expect(() => evaluateDependencyAudit({ error: 'registry unavailable' }, lock)).toThrow();
    expect(() => evaluateDependencyAudit({ ...report, error: 'incomplete response' }, lock)).toThrow();
    expect(() => evaluateDependencyAudit({ ...report, vulnerabilities: [] }, lock)).toThrow();
    report.metadata.vulnerabilities.high = 3;
    expect(() => evaluateDependencyAudit(report, lock, reviewDate)).toThrow(/count/);
  });

  it.each([
    null,
    [],
    { name: 'braces' },
    { name: 'braces', severity: 'HIGH' },
    { name: 'other', severity: 'high' },
  ])('rejects malformed vulnerability entries: %j', (entry) => {
    const { report, lock } = fixture();
    report.vulnerabilities.braces = entry;
    expect(() => evaluateDependencyAudit(report, lock, reviewDate)).toThrow(/Malformed/);
  });

  it('rejects missing nodes, malformed causes, and inconsistent totals', () => {
    for (const mutate of [
      (report) => { report.vulnerabilities.braces.nodes = []; },
      (report) => { report.vulnerabilities.braces.nodes = ['node_modules/missing']; },
      (report) => { report.vulnerabilities.braces.via = [null]; },
      (report) => { report.vulnerabilities.braces.via[0].severity = 'HIGH'; },
      (report) => { report.metadata.vulnerabilities.total = 0; },
      (report) => { report.metadata.vulnerabilities.low = 1; },
    ]) {
      const { report, lock } = fixture();
      mutate(report);
      expect(() => evaluateDependencyAudit(report, lock, reviewDate)).toThrow();
    }
  });

  it('does not require an exception for a clean report after expiry', () => {
    const { report, lock } = fixture();
    report.vulnerabilities = {};
    report.metadata.vulnerabilities.high = 0;
    report.metadata.vulnerabilities.total = 0;
    const result = evaluateDependencyAudit(report, lock, new Date('2026-11-05'));
    expect(result.passed).toBe(true);
    expect(result.exception).toBeNull();
  });
});
