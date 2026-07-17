import { readFileSync } from 'node:fs';
import { log } from '../../utils/logger.ts';

export interface FlowConfig {
  flow: string;
  enabled?: boolean;
  intervalMs: number;
  args?: Record<string, unknown>;
}

export interface Scenario {
  space?: string;
  flows: FlowConfig[];
}

export const DEFAULT_SCENARIO: Scenario = {
  flows: [
    { flow: 'alerts', enabled: true, intervalMs: 60_000, args: { alertCount: 50, hostCount: 10, userCount: 10 } },
    { flow: 'events', enabled: true, intervalMs: 30_000, args: { n: 200 } },
    { flow: 'csp', enabled: true, intervalMs: 300_000, args: { dataSources: ['all'], findingsCount: 20 } },
    { flow: 'org-data', enabled: false, intervalMs: 3_600_000, args: { size: 'small' } },
    { flow: 'entity-store', enabled: false, intervalMs: 3_600_000, args: {} },
  ],
};

function validateScenario(scenario: unknown, sourcePath: string): Scenario {
  if (typeof scenario !== 'object' || scenario === null) {
    throw new Error(`Invalid scenario from "${sourcePath}": root value must be an object`);
  }

  const raw = scenario as Record<string, unknown>;

  if (!Array.isArray(raw.flows)) {
    throw new Error(`Invalid scenario from "${sourcePath}": "flows" must be an array`);
  }

  const invalid: string[] = [];
  for (let i = 0; i < raw.flows.length; i++) {
    const entry = raw.flows[i] as Record<string, unknown>;
    const problems: string[] = [];

    if (typeof entry?.flow !== 'string' || entry.flow.trim() === '') {
      problems.push('missing or non-string "flow"');
    }
    if (typeof entry?.intervalMs !== 'number' || entry.intervalMs <= 0) {
      problems.push('missing or non-positive "intervalMs"');
    }

    if (problems.length > 0) {
      invalid.push(`  [${i}] ${problems.join(', ')}`);
    }
  }

  if (invalid.length > 0) {
    throw new Error(
      `Invalid scenario from "${sourcePath}": the following flow entries are invalid:\n${invalid.join('\n')}`,
    );
  }

  return raw as unknown as Scenario;
}

function loadFromPath(filePath: string): Scenario {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(
      `Scenario file not found or unreadable: "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Scenario file contains invalid JSON: "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  log.debug(`Loaded scenario from "${filePath}"`);
  return validateScenario(parsed, filePath);
}

export function loadScenario(path?: string): Scenario {
  if (path) {
    return loadFromPath(path);
  }

  const envPath = process.env.SCENARIO_FILE;
  if (envPath) {
    return loadFromPath(envPath);
  }

  return DEFAULT_SCENARIO;
}
