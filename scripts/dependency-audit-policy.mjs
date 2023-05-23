export const BRACES_EXCEPTION = Object.freeze({
  advisory: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
  package: 'braces',
  version: '3.0.3',
  expires: '2026-11-04T00:00:00.000Z',
});

const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Keep npm's full-tree high/critical gate, with one expiring dev-only exception. */
export function evaluateDependencyAudit(report, lockfile, now = new Date()) {
  if (
    report?.auditReportVersion !== 2 ||
    report.error ||
    !isRecord(report.vulnerabilities) ||
    !isRecord(report.metadata?.vulnerabilities) ||
    !isRecord(lockfile?.packages) ||
    !Number.isFinite(now.getTime())
  ) {
    throw new Error('Missing or invalid npm audit report, lockfile, or audit date.');
  }

  const vulnerabilities = report.vulnerabilities;
  const entries = Object.entries(vulnerabilities);
  for (const [name, item] of entries) {
    if (
      !isRecord(item) ||
      item.name !== name ||
      !name ||
      !severities.includes(item.severity) ||
      !Array.isArray(item.nodes) ||
      item.nodes.length === 0 ||
      !item.nodes.every((node) => typeof node === 'string' && isRecord(lockfile.packages[node])) ||
      !Array.isArray(item.via) ||
      item.via.length === 0 ||
      !item.via.every((cause) =>
        typeof cause === 'string'
          ? cause.length > 0
          : isRecord(cause) &&
            typeof cause.name === 'string' && cause.name.length > 0 &&
            typeof cause.dependency === 'string' && cause.dependency.length > 0 &&
            typeof cause.url === 'string' && cause.url.startsWith('https://') &&
            severities.includes(cause.severity),
      )
    ) {
      throw new Error(`Malformed npm audit vulnerability entry: ${name}.`);
    }
  }
  for (const severity of severities) {
    const actual = entries.filter(([, item]) => item.severity === severity).length;
    if (report.metadata.vulnerabilities[severity] !== actual) {
      throw new Error(`Incomplete npm audit report: ${severity} count does not match.`);
    }
  }
  if (report.metadata.vulnerabilities.total !== entries.length) {
    throw new Error('Incomplete npm audit report: total count does not match.');
  }

  const installedBraces = Object.entries(lockfile.packages).filter(([path]) =>
    /(?:^|\/)node_modules\/braces$/.test(path),
  );
  const exactDevOnlyBraces =
    installedBraces.length > 0 &&
    installedBraces.every(
      ([, pkg]) => pkg.version === BRACES_EXCEPTION.version && pkg.dev === true,
    );
  const exceptionCurrent = now.getTime() < Date.parse(BRACES_EXCEPTION.expires);

  function isExcepted(name, visited = new Set()) {
    const item = vulnerabilities[name];
    if (
      !exceptionCurrent ||
      !exactDevOnlyBraces ||
      visited.has(name) ||
      item?.name !== name ||
      item.severity !== 'high' ||
      !Array.isArray(item.nodes) ||
      item.nodes.length === 0 ||
      !item.nodes.every((node) => lockfile.packages[node]?.dev === true) ||
      !Array.isArray(item.via) ||
      item.via.length === 0
    ) {
      return false;
    }

    const nextVisited = new Set([...visited, name]);
    return item.via.every((cause) => {
      if (typeof cause === 'string') return isExcepted(cause, nextVisited);
      return (
        name === BRACES_EXCEPTION.package &&
        cause?.name === BRACES_EXCEPTION.package &&
        cause.dependency === BRACES_EXCEPTION.package &&
        cause.url === BRACES_EXCEPTION.advisory &&
        cause.severity === 'high' &&
        item.nodes.every(
          (node) =>
            /(?:^|\/)node_modules\/braces$/.test(node) &&
            lockfile.packages[node]?.version === BRACES_EXCEPTION.version,
        )
      );
    });
  }

  const failures = [];
  const excepted = [];
  for (const [name, item] of entries) {
    if (!['high', 'critical'].includes(item.severity)) continue;
    if (isExcepted(name)) excepted.push(name);
    else failures.push({ package: name, severity: item.severity, via: item.via });
  }
  return {
    passed: failures.length === 0,
    failures,
    excepted,
    exception: excepted.length > 0 ? BRACES_EXCEPTION : null,
    exception_expired: !exceptionCurrent,
    counts: report.metadata.vulnerabilities,
  };
}
