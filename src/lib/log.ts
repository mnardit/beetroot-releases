type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (import.meta.env.VITE_LOG_LEVEL as LogLevel) || (import.meta.env.DEV ? "debug" : "warn");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, module: string, message: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level.toUpperCase()}] [${module}] ${message}`;
}

export type Logger = ReturnType<typeof createLogger>;

/** Create a namespaced logger. Level controlled by VITE_LOG_LEVEL (default: debug in dev, warn in prod). */
export function createLogger(module: string) {
  return {
    debug(message: string, ...args: unknown[]) {
      if (shouldLog("debug")) console.debug(formatMessage("debug", module, message), ...args); // eslint-disable-line no-console
    },
    info(message: string, ...args: unknown[]) {
      if (shouldLog("info")) console.info(formatMessage("info", module, message), ...args); // eslint-disable-line no-console
    },
    warn(message: string, ...args: unknown[]) {
      if (shouldLog("warn")) console.warn(formatMessage("warn", module, message), ...args);
    },
    error(message: string, ...args: unknown[]) {
      if (shouldLog("error")) console.error(formatMessage("error", module, message), ...args);
    },
  };
}

/** Run an async operation and warn if it exceeds the threshold. */
export async function timed<T>(
  logger: Logger,
  label: string,
  fn: () => Promise<T>,
  thresholdMs: number,
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const elapsed = performance.now() - start;
  if (elapsed > thresholdMs) {
    logger.warn(`Slow: ${label} took ${elapsed.toFixed(0)}ms (threshold ${thresholdMs}ms)`);
  }
  return result;
}
