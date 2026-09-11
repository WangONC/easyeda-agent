import test from 'node:test';
import assert from 'node:assert/strict';
import * as config from '../extension.json';
import { about, toggleAutoConnect, stopConnection } from './index';

test('all supported editor environments retain a single static Chinese menu and exported callbacks', () => {
 for (const env of ['home','blank','sch','symbol','pcb','footprint']) {
  const menus = (config.headerMenus as Record<string, any[]>)[env];
  assert.equal(menus.length, 1);
  assert.equal(menus[0].title, 'EDA Agent');
  assert.deepEqual(menus[0].menuItems.map((x: any) => x.title), ['重新连接','停止连接','自动连接','关于']);
  assert.equal(new Set(menus[0].menuItems.map((x: any) => x.id)).size, 4);
 }
 assert.match(config.uuid, /^[0-9a-f]{32}$/);
 assert.notEqual(config.uuid, '4dae27407c1d43be98e8e210d45fe587');
 assert.equal(config.name, 'jlceda-agent');
});
test('user menu about and preference toggle have visible feedback even without a document', async () => {
 const messages: string[] = []; const toasts: string[] = []; let preference = true;
 (globalThis as any).eda = {
  sys_Message: { showToastMessage: (s: string) => toasts.push(s) },
  sys_Dialog: { showInformationMessage: (s: string) => messages.push(s) },
  sys_Storage: { getExtensionUserConfig: () => preference, setExtensionUserConfig: async (_k: string, v: boolean) => { preference = v; } },
  sys_ClientUrl: { request: async () => { throw Error('offline'); } },
 };
 await about();
 assert.match(messages[0], /2\.0\.0/);
 assert.equal(messages[0].split("\n").length, 3);
 assert.doesNotMatch(messages[0], /WangONC|https:|窗口 ID/);
 assert.match(messages[0], /连接状态不可用/);
 await toggleAutoConnect();
 assert.equal(preference, false);
 assert.equal(toasts[0], '已关闭自动连接');
 assert.equal(messages.length, 1);
 (globalThis as any).eda.sys_Storage.setExtensionUserConfig = async () => { throw Error('denied'); };
 await toggleAutoConnect();
 assert.match(toasts[1], /失败/);
 stopConnection();
 assert.equal(toasts[2], '已停止连接');
 assert.equal(messages.length, 1);
});
