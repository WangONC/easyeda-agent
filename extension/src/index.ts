/**
 * EDA Agent — extension entry point.
 *
 * Bridges the easyeda-agent Go daemon to the official `eda.*` API over a local
 * WebSocket. On startup it scans ports 60832-60841 (0xEDA0-0xEDA9), validates the daemon
 * handshake (service "easyeda-agent"), registers a windowId, sends context, and
 * keeps a heartbeat. Incoming `request` frames are dispatched to typed actions
 * (see ./actions) and answered with `response` frames.
 *
 * Exported functions are wired to menu items in `extension.json`.
 */

import * as extensionConfig from '../extension.json';
import {
	getConnectionStatus,
resolvePorts,
	reconnect as transportReconnect,
	start as transportStart,
	stop as transportStop,
} from './transport';

import { currentHostWindow } from './transport-identity';

// Repeated bundle activation shares the existing executor and its pending ownership.
const hostWindow = currentHostWindow();
const runtime = (hostWindow.runtime ??= { start: transportStart, stop: transportStop, reconnect: transportReconnect, status: getConnectionStatus }) as { start: typeof transportStart; stop: typeof transportStop; reconnect: typeof transportReconnect; status: typeof getConnectionStatus };

import { showReconnectResult } from './menu-feedback';
let feedbackGeneration = 0;
import { readAboutConnection } from './about-status';
import { readResponseContext } from './eda-context';

const STORAGE_KEY_AUTO_CONNECT = 'autoConnectEnabled';

// ─── Lifecycle ────────────────────────────────────────────────────────

/**
 * Extension activation entry (supports onStartupFinished auto-start).
 *
 * @param status - activation reason (e.g. 'onStartupFinished')
 * @param arg - optional activation argument
 */
// eslint-disable-next-line unused-imports/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string): void {
	runtime.start();
}

/**
 * Extension deactivation: tear down the connection without showing a toast.
 */
export function deactivate(): void {
	runtime.stop(false);
}

// ─── Menu actions ─────────────────────────────────────────────────────

/**
 * Manually reconnect (menu item).
 */
export async function reconnect(): Promise<void> {
 const generation = ++feedbackGeneration;
 await showReconnectResult(runtime.reconnect, runtime.status, message => eda.sys_Message.showToastMessage(message), () => generation === feedbackGeneration);
}

/**
 * Stop the connection and cancel retries (menu item).
 */
export function stopConnection(): void {
 ++feedbackGeneration;
	runtime.stop();
	eda.sys_Message.showToastMessage('已停止连接');
}

/**
 * Toggle the auto-connect-on-startup preference (menu item).
 */
export async function toggleAutoConnect(): Promise<void> {
 try {
  const currentlyEnabled = eda.sys_Storage.getExtensionUserConfig(STORAGE_KEY_AUTO_CONNECT) !== false;
  await eda.sys_Storage.setExtensionUserConfig(STORAGE_KEY_AUTO_CONNECT, !currentlyEnabled);
  eda.sys_Message.showToastMessage(currentlyEnabled ? '已关闭自动连接' : '已开启自动连接');
 } catch {
  eda.sys_Message.showToastMessage('自动连接设置失败，请稍后重试');
 }
}

/**
 * User-invoked local menu feedback only; never a typed action or design effect.
 */
export async function about(): Promise<void> {
 const status = { ...runtime.status(), windowId: hostWindow.id };
 let configured: unknown;
 try { configured = eda.sys_Storage.getExtensionUserConfig('daemonPorts'); } catch { /* default port */ }
 const port = status.port ?? resolvePorts(configured, null)[0];
 const statusLine = await readAboutConnection(status, readResponseContext, async () => {
  const response = await eda.sys_ClientUrl.request(`http://127.0.0.1:${port}/health`, 'GET');
  if (!response.ok) throw new Error(`health HTTP ${response.status}`);
  return response.json();
 }, port);
 eda.sys_Dialog.showInformationMessage(`EDA Agent\n版本：${extensionConfig.version}\n连接状态：${statusLine.split('\n')[0]}`, '关于', '确定');
}