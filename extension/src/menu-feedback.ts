import type { ConnectionStatus } from './transport';

// Presentation only: one user reconnect, observe its actual handshake; no retries here.
export async function showReconnectResult(
 start: () => void,
 read: () => ConnectionStatus,
 toast: (message: string) => void,
 current: () => boolean = () => true,
 wait: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 500)),
): Promise<void> {
 try {
  start();
  toast('正在重新连接…');
  for (let i = 0; i < 20; i++) {
   await wait();
   if (!current()) return;
   const status = read();
   if (status.connected && status.windowId) {
    toast('重新连接成功');
    return;
   }
  }
  if (current()) toast('重新连接未成功（等待超时），请检查 daemon 是否运行');
 } catch {
  if (current()) toast('重新连接失败，请检查 daemon 和外部交互权限');
 }
}
