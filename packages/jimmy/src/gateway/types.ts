import type { SessionManager } from "../sessions/manager.js";
import type { Connector, GatewayConfig } from "../shared/types.js";

export interface ApiContext {
  config: GatewayConfig;
  sessionManager: SessionManager;
  startTime: number;
  getConfig: () => GatewayConfig;
  emit: (event: string, payload: unknown) => void;
  connectors: Map<string, Connector>;
  reloadConnectorInstances?: () => Promise<{ started: string[]; stopped: string[]; errors: string[] }>;
}
