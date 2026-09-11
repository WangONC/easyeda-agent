import type { ConnectionStatus } from './transport';
import type { ResponseContext } from './protocol';

interface HealthWindow { windowId?: string; context?: ResponseContext; lastSeen?: string }
interface Health { service?: string; status?: string; windows?: HealthWindow[] }

// Local menu activations need not own the background transport module instance.
// Never use another document's registration as proof of this document's connection.
export function connectionStatusText(raw: unknown, local: ConnectionStatus, context: ResponseContext, port: number, now = Date.now()): string {
 const health = raw as Health | null;
 if (health?.service !== 'easyeda-agent' || health.status !== 'ok' || !Array.isArray(health.windows)) return '连接状态不可用（daemon 响应无效）';
 const matches = health.windows.filter(w => (local.windowId && w.windowId === local.windowId) ||
  (context.projectUuid && context.documentUuid && w.context?.projectUuid === context.projectUuid && w.context.documentUuid === context.documentUuid &&
   (!context.tabId || w.context.tabId === context.tabId)) ||
  (!context.projectUuid && context.documentType === 'home' && context.tabId && !w.context?.projectUuid && w.context?.documentType === 'home' && w.context?.tabId === context.tabId));
 const live = matches.find(w => { const seen = Date.parse(w.lastSeen ?? ''); return Number.isFinite(seen) && now - seen >= 0 && now - seen <= 15000; });
 if (live) return `已连接（端口 ${port}）\n窗口 ID：${live.windowId}\n已通过 daemon 心跳核实`;
 if (matches.length) return '连接状态未确认（daemon 心跳已过期）';
 if (local.connecting) return '正在连接（尚未向 daemon 注册）';
 if (!health.windows.length) return '未连接（daemon 已运行，但没有 Connector 注册）';
 return '当前文档连接未确认（daemon 中有其它注册）';
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
   new Promise<string>(resolve => { timer = setTimeout(() => resolve('连接状态不可用（检查超时）'), timeoutMs); }),
  ]);
 } catch { return '连接状态不可用（无法访问 daemon，请检查服务及外部交互权限）'; }
 finally { if (timer) clearTimeout(timer); }
}
