const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL: Level = (process.env.LOG_LEVEL as Level) ?? "info";

function shouldLog(level: Level): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL];
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

export function debug(msg: string, ...args: unknown[]) {
  if (!shouldLog("debug")) return;
  console.log(`${COLORS.dim}${timestamp()} DBG${COLORS.reset} ${msg}`, ...args);
}

export function info(msg: string, ...args: unknown[]) {
  if (!shouldLog("info")) return;
  console.log(`${COLORS.cyan}${timestamp()} INF${COLORS.reset} ${msg}`, ...args);
}

export function warn(msg: string, ...args: unknown[]) {
  if (!shouldLog("warn")) return;
  console.warn(`${COLORS.yellow}${timestamp()} WRN${COLORS.reset} ${msg}`, ...args);
}

export function error(msg: string, ...args: unknown[]) {
  if (!shouldLog("error")) return;
  console.error(`${COLORS.red}${timestamp()} ERR${COLORS.reset} ${msg}`, ...args);
}

export function request(method: string, path: string, status: number, ms: number) {
  const color = status >= 500 ? COLORS.red : status >= 400 ? COLORS.yellow : COLORS.green;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "debug";
  if (!shouldLog(level)) return;
  console.log(
    `${COLORS.dim}${timestamp()}${COLORS.reset} ${COLORS.magenta}${method.padEnd(7)}${COLORS.reset} ${path} ${color}${status}${COLORS.reset} ${COLORS.dim}${ms}ms${COLORS.reset}`
  );
}
