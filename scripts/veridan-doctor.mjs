#!/usr/bin/env node
import { runDoctor } from '../runtime/doctor.mjs';

const report = await runDoctor();

console.log('VERIDAN SYSTEM PREFLIGHT');
for (const check of report.checks) {
  console.log(`${check.status === 'PASS' ? '✓' : '✗'} ${check.id}: ${check.detail}`);
}
console.log(`\n${report.passed} PASS | ${report.failed} FAIL`);

if (!report.ok) process.exitCode = 1;
