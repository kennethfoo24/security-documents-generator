import { type Command } from 'commander';
import { type CommandModule } from '../types.ts';
import { parseIntBase10 } from '../utils/cli_utils.ts';
import { runSimulator } from './runner.ts';

export const simulateCommands: CommandModule = {
  register(program: Command) {
    program
      .command('simulate')
      .alias('run')
      .description(
        'Continuously emit synthetic security data into Elastic (all enabled flows loop until stopped)',
      )
      .option(
        '--scenario <path>',
        'Path to scenario JSON file (default: built-in; override with SCENARIO_FILE env var)',
      )
      .option(
        '--space <space>',
        'Kibana space to use (overrides scenario.space; default: "default")',
      )
      .option(
        '--health-port <port>',
        'Port for liveness/readiness HTTP probes (default: 8080; override with PORT env var)',
        parseIntBase10,
      )
      .option('--once', 'Run one emit cycle per flow then exit (useful for testing)')
      .action(async (opts) => {
        await runSimulator({
          scenarioPath: opts.scenario,
          space: opts.space,
          healthPort: opts.healthPort,
          once: opts.once,
        });
      });
  },
};
