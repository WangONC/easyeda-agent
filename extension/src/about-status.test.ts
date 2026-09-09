import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectionStatusText, readAboutConnection } from './about-status';
const local = {connected:false,connecting:false,port:null,windowId:null};
const context = {projectUuid:'p',documentUuid:'d',tabId:'t'};
const now = Date.now();
const window = {windowId:'live',context,lastSeen:new Date(now).toISOString()};
const health = {service:'easyeda-agent',status:'ok',windows:[window]};
test('About resolves live daemon registration despite fresh disconnected menu module',()=>{
 assert.match(connectionStatusText(health,local,context,60832,now),/^Connected/);
 assert.match(connectionStatusText(health,local,context,60832,now),/live/);
});
test('About does not claim other tabs, stale heartbeats or absent registrations connected',()=>{
 assert.match(connectionStatusText(health,local,{...context,tabId:'other'},60832,now),/unconfirmed/);
 assert.match(connectionStatusText(health,local,{},60832,now),/unconfirmed/);
 assert.match(connectionStatusText(health,local,context,60832,now+16000),/stale/);
 assert.match(connectionStatusText({...health,windows:[]},{...local,connected:true},context,60832,now),/^Disconnected/);
 assert.match(connectionStatusText({...health,windows:[]},{...local,connecting:true},context,60832,now),/^Connecting/);
 assert.match(connectionStatusText({},local,context,60832,now),/unavailable/);
});
test('About bounded query reports unavailable on rejection or hanging Host, without reconnect',async()=>{
 assert.match(await readAboutConnection(local,async()=>context,async()=>health,60832),/^Connected/);
 assert.match(await readAboutConnection(local,async()=>context,async()=>{throw Error('offline');},60832),/unavailable/);
 assert.match(await readAboutConnection(local,()=>new Promise(()=>{}),async()=>health,60832,5),/timed out/);
});
