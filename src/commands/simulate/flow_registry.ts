import { generateAlerts, generateEvents } from '../documents/documents.ts';
import {
  generateCloudSecurityPosture,
  installCspIntegration,
  resolveDataSources,
  ALL_DATA_SOURCES,
} from '../cloud_security_posture/index.ts';
import { ensureSpace } from '../../utils/ensure_space.ts';
import { runOrgData } from '../org_data/org_data.ts';
import { log } from '../../utils/logger.ts';
import { type OrganizationSize } from '../org_data/types.ts';

export interface FlowDefinition {
  name: string;
  /** Run once at startup before the loop begins. Idempotent — safe to re-run on pod restart. */
  setup?: (space: string) => Promise<void>;
  /** Called every intervalMs. Timestamps docs at "now". */
  emit: (args: Record<string, unknown>, space: string) => Promise<void>;
}

export const FLOW_REGISTRY: Record<string, FlowDefinition> = {
  alerts: {
    name: 'alerts',
    setup: async (space: string) => {
      await ensureSpace(space);
    },
    emit: async (args: Record<string, unknown>, space: string) => {
      const alertCount = typeof args.alertCount === 'number' ? args.alertCount : 50;
      let hostCount = typeof args.hostCount === 'number' ? args.hostCount : 10;
      let userCount = typeof args.userCount === 'number' ? args.userCount : 10;

      if (hostCount > alertCount) {
        log.warn(
          `hostCount (${hostCount}) > alertCount (${alertCount}); clamping to ${alertCount}`,
        );
        hostCount = alertCount;
      }
      if (userCount > alertCount) {
        log.warn(
          `userCount (${userCount}) > alertCount (${alertCount}); clamping to ${alertCount}`,
        );
        userCount = alertCount;
      }

      await generateAlerts(alertCount, hostCount, userCount, space);
    },
  },

  events: {
    name: 'events',
    emit: async (args: Record<string, unknown>, _space: string) => {
      const n = typeof args.n === 'number' ? args.n : 200;
      await generateEvents(n);
    },
  },

  csp: {
    name: 'csp',
    setup: async (_space: string) => {
      await installCspIntegration();
    },
    emit: async (args: Record<string, unknown>, _space: string) => {
      const dataSources = Array.isArray(args.dataSources)
        ? (args.dataSources as string[])
        : ['all'];
      const findingsCount = typeof args.findingsCount === 'number' ? args.findingsCount : 20;

      // Validate data sources before calling resolveDataSources, which calls
      // process.exit(1) on unrecognized inputs — that cannot be caught by the runner.
      const validCspInputs = new Set<string>([...ALL_DATA_SOURCES, 'all', 'elastic_all']);
      const invalidSources = dataSources.filter((s) => !validCspInputs.has(s));
      if (invalidSources.length > 0) {
        throw new Error(
          `Unknown data source(s): ${invalidSources.join(', ')}. Valid options: all, elastic_all, ${ALL_DATA_SOURCES.join(', ')}`,
        );
      }

      await generateCloudSecurityPosture({
        dataSources: resolveDataSources(dataSources),
        findingsCount,
        generateCspScores: false,
      });
    },
  },

  'org-data': {
    name: 'org-data',
    emit: async (args: Record<string, unknown>, space: string) => {
      const size = (typeof args.size === 'string' ? args.size : 'small') as OrganizationSize;
      const integrations =
        typeof args.integrations === 'string' ? args.integrations : 'okta,okta_system,aws';
      await runOrgData({
        size,
        space,
        name: 'Acme CRM',
        integrations,
        detectionRules: false,
        productivitySuite: 'microsoft',
      });
    },
  },

  'entity-store': {
    name: 'entity-store',
    emit: async (_args: Record<string, unknown>, _space: string) => {
      log.warn(
        'entity-store flow emits are not yet implemented; enable entity-store in org-data instead',
      );
    },
  },
};

export function getFlow(name: string): FlowDefinition {
  const flow = FLOW_REGISTRY[name];
  if (!flow) {
    throw new Error(`Unknown flow: ${name}. Available: ${Object.keys(FLOW_REGISTRY).join(', ')}`);
  }
  return flow;
}
