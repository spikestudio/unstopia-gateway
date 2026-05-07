import fs from "node:fs";
import { startDaemon, startForeground } from "../gateway/lifecycle.js";
import { loadConfig } from "../shared/config.js";
import { GATEWAY_HOME } from "../shared/paths.js";
import { compareSemver, getInstanceVersion, getPackageVersion } from "../shared/version.js";

const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export async function runStart(opts: { daemon?: boolean; port?: number }): Promise<void> {
  if (!fs.existsSync(GATEWAY_HOME)) {
    console.error(`Error: ${GATEWAY_HOME} does not exist. Run "gateway setup" first.`);
    process.exit(1);
  }

  const config = loadConfig();

  // Check for pending migrations
  const instanceVersion = getInstanceVersion();
  const pkgVersion = getPackageVersion();
  if (compareSemver(instanceVersion, pkgVersion) < 0) {
    console.log(
      `${YELLOW}[migrate]${RESET} Instance is at v${instanceVersion}, CLI is v${pkgVersion}. Run ${DIM}gateway migrate${RESET} to update.`,
    );
  }

  // Allow CLI --port to override config
  if (opts.port) {
    config.gateway.port = opts.port;
  }

  if (opts.daemon) {
    startDaemon(config);
    console.log("Gateway started in background.");
  } else {
    console.log(`Starting gateway on ${config.gateway.host}:${config.gateway.port}...`);
    await startForeground(config);
  }
}
