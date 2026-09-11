import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectionStatusText, readAboutConnection } from './about-status';
const local = {connected:false,connecting:false,port:null,windowId:null};
const context = {projectUuid:'p',documentUuid:'d',tabId:'t'};
const now = Date.now();
const window = {windowId:'live',context,lastSeen:new Date(now).toISOString()};
const health = {service:'easyeda-agent',status:'ok',windows:[window]};
test('About resolves live daemon registration despite fresh disconnected menu module',()=>{
 assert.match(connectionStatusText(health,local,context,60832,now),/^已连接/);
 assert.match(connectionStatusText(health,local,context,60832,now),/live/);
});
test('About does not claim other tabs, stale heartbeats or absent registrations connected',()=>{
 assert.match(connectionStatusText(health,local,{...context,tabId:'other'},60832,now),/未确认/);
 assert.match(connectionStatusText(health,local,{},60832,now),/未确认/);
 assert.match(connectionStatusText(health,local,context,60832,now+16000),/过期/);
 assert.match(connectionStatusText({...health,windows:[]},{...local,connected:true},context,60832,now),/^未连接/);
 assert.match(connectionStatusText({...health,windows:[]},{...local,connecting:true},context,60832,now),/^正在连接/);
 assert.match(connectionStatusText({},local,context,60832,now),/不可用/);
});
test('About bounded query reports unavailable on rejection or hanging Host, without reconnect',async()=>{
 assert.match(await readAboutConnection(local,async()=>context,async()=>health,60832),/^已连接/);
 assert.match(await readAboutConnection(local,async()=>context,async()=>{throw Error('offline');},60832),/不可用/);
 assert.match(await readAboutConnection(local,()=>new Promise(()=>{}),async()=>health,60832,5),/超时/);
});

test('Home status recognizes only the exact Home tab without requiring a project', () => {
 const home = {documentType:'home',documentUuid:'tab_page1',tabId:'tab_page1'};
 const h = {...health,windows:[{...window,context:home}]};
 assert.match(connectionStatusText(h,local,home,60832,now),/^已连接/);
 assert.match(connectionStatusText(h,local,{...home,tabId:'other'},60832,now),/未确认/);
});
