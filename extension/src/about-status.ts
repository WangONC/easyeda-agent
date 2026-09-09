import type { ConnectionStatus } from './transport';
import type { ResponseContext } from './protocol';

interface HealthWindow { windowId?: string; context?: ResponseContext; lastSeen?: string }
interface Health { service?: string; status?: string; windows?: HealthWindow[] }

// Local menu activations need not own the background transport module instance.
// Never use another document's registration as proof of this document's connection.
export function connectionStatusText(raw: unknown, local: ConnectionStatus, context: ResponseContext, port: number, now = Date.now()): string {
 const health = raw as Health | null;
 if (health?.service !== 'easyeda-agent' || health.status !== 'ok' || !Array.isArray(health.windows)) return 'Connection status unavailable (invalid daemon response)';
 const matches = health.windows.filter(w => (local.windowId && w.windowId === local.windowId) ||
  (context.projectUuid && context.documentUuid && w.context?.projectUuid === context.projectUuid && w.context.documentUuid === context.documentUuid &&
   (!context.tabId || w.context.tabId === context.tabId)));
 const live = matches.find(w => { const seen = Date.parse(w.lastSeen ?? ''); return Number.isFinite(seen) && now - seen >= 0 && now - seen <= 15000; });
 if (live) return `Connected (port ${port})\nWindow ID: ${live.windowId}\nVerified by daemon heartbeat`;
 if (matches.length) return 'Connection status unconfirmed (daemon heartbeat is stale)';
 if (local.connecting) return 'Connecting... (not yet registered with daemon)';
 if (!health.windows.length) return 'Disconnected (daemon is running; no Connector registered)';
 return 'Current document connection unconfirmed (daemon has other registrations)';
}

export async function readAboutConnection(
 local: ConnectionStatus,
 readContext: () => Promise<ResponseContext>,
 readHealth: () => Promise<unknown>,
 port: number,
 timeoutMs = 2500,
): Promise<string> {
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  return await Promise.race([
   Promise.all([readContext(), readHealth()]).then(([context, health]) => connectionStatusText(health, local, context, port)),
   new Promise<string>(resolve => { timer = setTimeout(() => resolve('Connection status unavailable (check timed out)'), timeoutMs); }),
  ]);
 } catch { return 'Connection status unavailable (cannot query daemon; check service / external interaction permission)'; }
 finally { if (timer) clearTimeout(timer); }
}
