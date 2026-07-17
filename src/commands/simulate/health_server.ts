import { createServer } from 'node:http';
import { log } from '../../utils/logger.ts';

/**
 * Start the health/readiness HTTP server.
 * @param port  Port to listen on (default 8080; override via PORT env var)
 * @returns An object with methods to update probe state and stop the server
 */
export function startHealthServer(port?: number): {
  /** Call once setup is complete — /readyz starts returning 200 */
  markReady(): void;
  /** Call when the runner is shutting down — both probes return 503 */
  markUnhealthy(): void;
  /** Shut down the HTTP server */
  stop(): Promise<void>;
} {
  const listenPort = port ?? parseInt(process.env.PORT ?? '8080', 10);
  let ready = false;
  let healthy = true;

  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/plain');

    if (req.url === '/healthz') {
      if (healthy) {
        res.writeHead(200);
        res.end('ok\n');
      } else {
        res.writeHead(503);
        res.end('shutting down\n');
      }
    } else if (req.url === '/readyz') {
      if (!healthy) {
        res.writeHead(503);
        res.end('shutting down\n');
      } else if (!ready) {
        res.writeHead(503);
        res.end('not ready\n');
      } else {
        res.writeHead(200);
        res.end('ok\n');
      }
    } else {
      res.writeHead(404);
      res.end('not found\n');
    }
  });

  server.on('error', (err) => {
    log.warn('Health server error:', err);
  });

  server.listen(listenPort, () => {
    log.info(`Health server listening on :${listenPort}`);
  });

  return {
    markReady() {
      ready = true;
    },
    markUnhealthy() {
      healthy = false;
    },
    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
