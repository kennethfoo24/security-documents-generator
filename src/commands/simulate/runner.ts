import { loadScenario } from './scenario.ts';
import type { FlowConfig } from './scenario.ts';
import { getFlow } from './flow_registry.ts';
import { startHealthServer } from './health_server.ts';
import { sleep } from '../../utils/sleep.ts';
import { log } from '../../utils/logger.ts';

export interface RunnerOptions {
  scenarioPath?: string; // path to scenario JSON file, or undefined to use default/env
  space?: string; // Kibana space override (overrides scenario.space; defaults to "default")
  healthPort?: number; // port for the health server
  once?: boolean; // if true, run one emit cycle per flow then exit (for testing)
}

export async function runSimulator(opts: RunnerOptions): Promise<void> {
  let stop = false;
  let signalCount = 0;
  const onSignal = (sig: string) => {
    signalCount++;
    if (signalCount === 1) {
      log.info(`Caught ${sig}, shutting down gracefully... (send again to force quit)`);
      stop = true;
    } else {
      log.info('Force quitting...');
      process.exit(130);
    }
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  const health = startHealthServer(opts.healthPort);
  try {
    const scenario = loadScenario(opts.scenarioPath);
    const space = opts.space ?? scenario.space ?? 'default';
    const enabledFlows = scenario.flows.filter((f) => f.enabled !== false);

    log.info(`Starting simulate runner: ${enabledFlows.length} flows enabled, space="${space}"`);
    for (const f of enabledFlows) {
      log.info(`  [${f.flow}] every ${f.intervalMs}ms`);
    }

    // One-time setup for all enabled flows
    for (const flowConfig of enabledFlows) {
      const flow = getFlow(flowConfig.flow);
      if (flow.setup) {
        log.info(`[${flowConfig.flow}] running setup...`);
        try {
          await flow.setup(space);
          log.info(`[${flowConfig.flow}] setup complete`);
        } catch (err) {
          log.error(`[${flowConfig.flow}] setup failed (will continue):`, err);
        }
      }
    }

    health.markReady();

    // Emit loop — one independent scheduler per enabled flow
    async function scheduleFlow(flowConfig: FlowConfig): Promise<void> {
      const flow = getFlow(flowConfig.flow);
      while (!stop) {
        log.info(`[${flowConfig.flow}] emitting...`);
        try {
          await flow.emit(flowConfig.args ?? {}, space);
          log.info(`[${flowConfig.flow}] emit complete`);
        } catch (err) {
          log.error(`[${flowConfig.flow}] emit error (will retry next interval):`, err);
        }
        if (opts.once || stop) break;
        // Sleep in 1-second increments, checking stop each second
        const intervalS = Math.ceil(flowConfig.intervalMs / 1000);
        for (let i = 0; i < intervalS; i++) {
          if (stop) break;
          await sleep(1000);
        }
      }
    }

    await Promise.all(enabledFlows.map(scheduleFlow));
  } finally {
    // Ensure health server always shuts down, even if setup throws
    log.info('All flows stopped. Shutting down health server...');
    health.markUnhealthy();
    await health.stop();
    log.info('Runner stopped.');
  }
}
