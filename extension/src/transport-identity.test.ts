/// <reference types="@jlceda/pro-api-types" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { createWebSocketId, hostWindowState } from './transport-identity';

test('WebSocket ids are activation-scoped and keep the diagnostic prefix', () => {
	const ids = ['activation-a', 'activation-b'].map((id) => createWebSocketId(() => id));
	assert.deepEqual(ids, ['easyeda-agent-activation-a', 'easyeda-agent-activation-b']);
	assert.notEqual(ids[0], ids[1]);
});

// 端口选择与退避的测试搬去了 transport-ports.test.ts —— 原来的 scanOrder(整段
// 10 端口扫描 + lastGood 优先)已被「钉死 60832 + 指数退避」取代。

test('logical identity survives transport/activation churn but not another physical window', () => {
 const first={},second={};
 const original=hostWindowState(first,()=> 'physical-one');
 original.runtime={ pendingOperation:'must-not-be-replaced' };
 assert.equal(hostWindowState(first,()=> 'activation-two'),original);
 assert.equal(hostWindowState(first).runtime,original.runtime);
 assert.equal(hostWindowState(first).id,'host-physical-one');
 assert.notEqual(hostWindowState(second,()=> 'physical-two').id,original.id);
});
