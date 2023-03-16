#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

import {
  CANARY_ARTIFACT_CONTRACT,
  canaryArtifactEntries,
  canaryPayloadIsValueMinimized,
  isTerminalCanaryRun,
  summarizeCanaryAccount,
  summarizeCanaryCreate,
  summarizeCanaryRun,
  summarizeCanaryRunList,
  summarizeCanarySummary,
} from './production-run-canary-support.mjs';
import { summarizeBrowserErrors } from './production-auth-smoke-support.mjs';

const CONFIRMATION = 'RUN_ONE_FIXED_REFERENCE_CASE';
const FIXED_CASE = Object.freeze({
  id: 'brooklyn-reference-v1',
  address: '100 E 21st St Brooklyn, NY 11226',
});
const webBase = (
  process.env.CITYLENS_WEB_BASE || 'https://www.citylens.dev'
).replace(/\/+$/, '');
const apiBase = (
  process.env.CITYLENS_API_BASE || 'https://api.citylens.dev'
).replace(/\/+$/, '');
const email = process.env.CITYLENS_WEB_SMOKE_EMAIL?.trim();
const password = process.env.CITYLENS_WEB_SMOKE_PASSWORD;
const action = String(
  process.env.CITYLENS_CANARY_ACTION || 'preflight',
).toLowerCase();
const confirmation = process.env.CITYLENS_CANARY_CONFIRM || '';
const timeoutSeconds = Number(
  process.env.CITYLENS_CANARY_TIMEOUT_SECONDS || 2_100,
);
const pollIntervalSeconds = Number(
  process.env.CITYLENS_CANARY_POLL_INTERVAL_SECONDS || 10,
);
const outputDir = path.resolve(
  process.env.CITYLENS_CANARY_OUTPUT_DIR ||
    'test-results/production-run-canary',
);

if (!email || !password) {
  console.error(
    'CITYLENS_WEB_SMOKE_EMAIL and CITYLENS_WEB_SMOKE_PASSWORD are required.',
  );
  process.exit(2);
}
if (!['preflight', 'submit'].includes(action)) {
  console.error('CITYLENS_CANARY_ACTION must be preflight or submit.');
  process.exit(2);
}
if (action === 'submit' && confirmation !== CONFIRMATION) {
  console.error(
    `Submission requires CITYLENS_CANARY_CONFIRM=${CONFIRMATION}.`,
  );
  process.exit(2);
}
if (
  !Number.isFinite(timeoutSeconds) ||
  timeoutSeconds < 60 ||
  timeoutSeconds > 2_400
) {
  console.error(
    'CITYLENS_CANARY_TIMEOUT_SECONDS must be between 60 and 2400.',
  );
  process.exit(2);
}
if (
  !Number.isFinite(pollIntervalSeconds) ||
  pollIntervalSeconds < 2 ||
  pollIntervalSeconds > 60
) {
  console.error(
    'CITYLENS_CANARY_POLL_INTERVAL_SECONDS must be between 2 and 60.',
  );
  process.exit(2);
}

await fs.mkdir(outputDir, { recursive: true });

const startedAt = Date.now();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
let accessToken = null;
let accountReceipt = null;
let historyReceipt = null;
let workspaceReceipt = null;
let createReceipt = null;
let terminalReceipt = null;
let uiTerminalReceipt = null;
let summaryReceipt = null;
let artifactDeliveryReceipts = [];
let statusTransitions = [];
let passed = false;
let failure = null;
let submissionAttempted = false;

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));

function stableFailure(code) {
  failure = code;
  throw new Error(code);
}

async function apiJson(pathname, init = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function appendTransition(payload) {
  const receipt = summarizeCanaryRun(200, payload);
  const next = {
    run_status: receipt.run_status,
    stage: receipt.stage,
    progress: receipt.progress,
  };
  const previous = statusTransitions.at(-1);
  if (
    !previous ||
    previous.run_status !== next.run_status ||
    previous.stage !== next.stage ||
    previous.progress !== next.progress
  ) {
    statusTransitions.push(next);
  }
}

async function fetchArtifact(entry) {
  const contract = CANARY_ARTIFACT_CONTRACT[entry.name];
  if (!entry.url || !contract) stableFailure(`artifact-url-${entry.name}`);
  const fullBody =
    entry.name === 'change.geojson' ||
    entry.name === 'run_summary.json';
  const response = await fetch(entry.url, {
    headers: fullBody ? {} : { Range: 'bytes=0-4095' },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) stableFailure(`artifact-delivery-${entry.name}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = String(
    response.headers.get('content-type') || '',
  )
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  let signatureValid = false;
  let structuralValid = true;
  let parsed = null;

  if (entry.name === 'preview.png') {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    signatureValid = signature.every(
      (value, index) => bytes[index] === value,
    );
  } else if (entry.name === 'mesh.ply') {
    signatureValid =
      new TextDecoder().decode(bytes.slice(0, 3)).toLowerCase() === 'ply';
  } else {
    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes));
      signatureValid =
        parsed !== null &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed);
    } catch {
      signatureValid = false;
    }
  }

  if (entry.name === 'change.geojson') {
    structuralValid =
      parsed?.type === 'FeatureCollection' &&
      Array.isArray(parsed?.features) &&
      parsed.features.length > 0;
  }
  if (entry.name === 'run_summary.json') {
    summaryReceipt = summarizeCanarySummary(parsed);
    structuralValid = summaryReceipt.valid;
  }

  const receipt = {
    name: entry.name,
    status: response.status,
    content_type: contentType,
    bytes_received: bytes.byteLength,
    signature_valid: signatureValid,
    structural_valid: structuralValid,
    passed:
      (response.status === 200 || response.status === 206) &&
      contentType === contract.contentType &&
      bytes.byteLength > 0 &&
      signatureValid &&
      structuralValid,
  };
  if (!receipt.passed) {
    stableFailure(`artifact-contract-${entry.name}`);
  }
  return receipt;
}

try {
  const tokenResponsePromise = page.waitForResponse(
    (response) => {
      try {
        return (
          new URL(response.url()).pathname === '/api/auth/token' &&
          response.request().method() === 'GET'
        );
      } catch {
        return false;
      }
    },
    { timeout: 30_000 },
  );
  await page.goto(
    `${webBase}/sign-in?next=${encodeURIComponent('/runs/new')}`,
    { waitUntil: 'networkidle' },
  );
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/runs/new', { timeout: 20_000 });
  const tokenResponse = await tokenResponsePromise;
  const tokenPayload = await tokenResponse.json().catch(() => null);
  accessToken =
    tokenPayload &&
    typeof tokenPayload === 'object' &&
    typeof tokenPayload.token === 'string'
      ? tokenPayload.token
      : null;
  if (
    tokenResponse.status() !== 200 ||
    !accessToken ||
    accessToken.split('.').length !== 3
  ) {
    stableFailure('authentication');
  }

  const form = page.getByTestId('run-form');
  await form.waitFor({ timeout: 20_000 });
  workspaceReceipt = {
    route_visible: true,
    form_visible: await form.isVisible(),
    account_gate_absent:
      (await page.getByTestId('new-run-access-gate').count()) === 0,
    demo_selector_absent:
      (await page.getByLabel('Select a featured demo run').count()) === 0,
    output_choice_count: await form.locator('input[type="checkbox"]').count(),
    submit_control_visible: await page
      .getByRole('button', { name: 'Start processing' })
      .isVisible(),
  };
  if (
    !workspaceReceipt.form_visible ||
    !workspaceReceipt.account_gate_absent ||
    !workspaceReceipt.demo_selector_absent ||
    workspaceReceipt.output_choice_count !== 3 ||
    !workspaceReceipt.submit_control_visible
  ) {
    stableFailure('run-workspace');
  }

  const meResult = await apiJson('/v1/me');
  accountReceipt = summarizeCanaryAccount(
    meResult.response.status,
    meResult.payload,
  );
  if (!accountReceipt.eligible) stableFailure('quota-preflight');

  const historyResult = await apiJson('/v1/runs?limit=100');
  historyReceipt = summarizeCanaryRunList(
    historyResult.response.status,
    historyResult.payload,
  );
  if (!historyReceipt.shape_valid) stableFailure('history-preflight');
  if (historyReceipt.active_count !== 0) {
    stableFailure('active-run-preflight');
  }

  if (action === 'preflight') {
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      stableFailure('browser-errors');
    }
    passed = true;
  } else {
    submissionAttempted = true;
    const createResponsePromise = page.waitForResponse(
      (response) => {
        try {
          return (
            new URL(response.url()).pathname === '/v1/runs' &&
            response.request().method() === 'POST'
          );
        } catch {
          return false;
        }
      },
      { timeout: 30_000 },
    );
    await page.getByLabel('Address').fill(FIXED_CASE.address);
    await page
      .getByRole('button', { name: 'Start processing' })
      .click();
    const createResponse = await createResponsePromise;
    const createPayload = await createResponse.json().catch(() => null);
    createReceipt = summarizeCanaryCreate(
      createResponse.status(),
      createPayload,
    );
    const runId =
      createPayload &&
      typeof createPayload === 'object' &&
      typeof createPayload.run_id === 'string'
        ? createPayload.run_id
        : null;
    if (!createReceipt.accepted || !runId) {
      stableFailure('run-create');
    }
    await page.waitForURL('**/runs/*', { timeout: 20_000 });

    const deadline = Date.now() + timeoutSeconds * 1_000;
    let terminalPayload = null;
    while (Date.now() < deadline) {
      const runResult = await apiJson(
        `/v1/runs/${encodeURIComponent(runId)}`,
      );
      if (runResult.response.status !== 200) {
        stableFailure('run-poll');
      }
      appendTransition(runResult.payload);
      if (isTerminalCanaryRun(runResult.payload)) {
        terminalPayload = runResult.payload;
        terminalReceipt = summarizeCanaryRun(
          runResult.response.status,
          terminalPayload,
        );
        break;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, pollIntervalSeconds * 1_000),
      );
    }
    if (!terminalReceipt) stableFailure('run-timeout');
    if (
      terminalReceipt.run_status !== 'succeeded' ||
      !terminalReceipt.artifact_metadata_valid ||
      !terminalPayload
    ) {
      stableFailure('run-terminal');
    }

    for (const entry of canaryArtifactEntries(terminalPayload)) {
      artifactDeliveryReceipts.push(await fetchArtifact(entry));
    }
    if (
      artifactDeliveryReceipts.length !== 4 ||
      artifactDeliveryReceipts.some((receipt) => !receipt.passed) ||
      !summaryReceipt?.valid
    ) {
      stableFailure('artifact-verification');
    }

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('run-detail-shell').waitFor({
      timeout: 30_000,
    });
    await page.getByTestId('artifacts-panel').waitFor({
      timeout: 30_000,
    });
    uiTerminalReceipt = {
      detail_shell_visible: await page
        .getByTestId('run-detail-shell')
        .isVisible(),
      status_card_visible: await page
        .getByTestId('run-status-card')
        .isVisible(),
      artifacts_panel_visible: await page
        .getByTestId('artifacts-panel')
        .isVisible(),
      availability_receipt:
        (
          await page
            .getByTestId('artifact-availability-receipt')
            .textContent()
        )
          ?.replace(/\s+/g, ' ')
          .trim() ?? null,
    };
    if (
      !uiTerminalReceipt.detail_shell_visible ||
      !uiTerminalReceipt.status_card_visible ||
      !uiTerminalReceipt.artifacts_panel_visible ||
      uiTerminalReceipt.availability_receipt !== '4 of 4 available'
    ) {
      stableFailure('terminal-workspace');
    }
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      stableFailure('browser-errors');
    }
    passed = true;
  }
} catch (error) {
  if (!failure) {
    failure =
      error instanceof Error && /^[a-z0-9-]+$/.test(error.message)
        ? error.message
        : 'unclassified';
  }
} finally {
  await page
    .getByRole('button', { name: 'Sign out' })
    .click({ timeout: 5_000 })
    .catch(() => undefined);
  await browser.close();
}

const report = {
  schema_version: 'citylens/production-run-canary@v1',
  case_id: FIXED_CASE.id,
  action,
  passed,
  failure,
  submission_attempted: submissionAttempted,
  duration_seconds: Number(
    ((Date.now() - startedAt) / 1_000).toFixed(1),
  ),
  account_receipt: accountReceipt,
  history_receipt: historyReceipt,
  workspace_receipt: workspaceReceipt,
  create_receipt: createReceipt,
  status_transitions: statusTransitions,
  terminal_receipt: terminalReceipt,
  artifact_delivery_receipts: artifactDeliveryReceipts,
  summary_receipt: summaryReceipt,
  ui_terminal_receipt: uiTerminalReceipt,
  console_error_count: consoleErrors.length,
  console_error_receipts: summarizeBrowserErrors(consoleErrors),
  page_error_count: pageErrors.length,
  page_error_receipts: summarizeBrowserErrors(pageErrors),
};

if (!canaryPayloadIsValueMinimized(report)) {
  report.passed = false;
  report.failure = 'receipt-privacy';
}

await fs.writeFile(
  path.join(outputDir, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
