const SOCKET_ID_PREFIX = 'easyeda-agent-';

function randomActivationToken(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	if (typeof globalThis.crypto?.getRandomValues === 'function') {
		const values = new Uint32Array(4);
		globalThis.crypto.getRandomValues(values);
		return Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('');
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Create an activation-scoped id for EasyEDA's host-managed WebSocket table. */
export function createWebSocketId(randomToken = randomActivationToken): string {
	return `${SOCKET_ID_PREFIX}${randomToken()}`;
}

/** One in-memory identity per top-level Host window, never per document/socket.
 * No extension user-config/localStorage: those are shared by different windows.
 * The property survives repeated bundle activation in this renderer, not app exit.
 */
export function hostWindowState(root: object, randomToken = randomActivationToken): { id: string; runtime?: unknown } {
 const key = Symbol.for('jlceda-agent.host-window.v2');
 const shared = root as Record<symbol, { id: string; runtime?: unknown }>;
 if (!shared[key]) Object.defineProperty(shared, key, { value: { id: `host-${randomToken()}` } });
 return shared[key];
}
export function currentHostWindow(): { id: string; runtime?: unknown } {
 // A restricted/cross-origin top window must fail visibly, never mint a fake
 // physical identity from a document name or a per-activation random fallback.
 const root = typeof window === 'undefined' ? globalThis : window.top;
 if (!root) throw Error('HOST_WINDOW_IDENTITY_UNAVAILABLE');
 return hostWindowState(root);
}
