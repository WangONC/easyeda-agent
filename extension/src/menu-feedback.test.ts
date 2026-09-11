import test from 'node:test';
import assert from 'node:assert/strict';
import { showReconnectResult } from './menu-feedback';
for (const mode of ['success','timeout','throw','cancel'] as const) test('reconnect feedback '+mode, async () => {
 let starts=0, reads=0; const messages:string[]=[];
 await showReconnectResult(() => { starts++; if(mode==='throw') throw Error('native'); },
  () => { reads++; return {connected:mode==='success'&&reads===2,connecting:true,windowId:reads===2?'w':null,port:60832}; },
  m=>messages.push(m),()=>mode!=='cancel',async()=>{});
 assert.equal(starts,1);
 if(mode==='success') assert.equal(messages.at(-1),'重新连接成功');
 if(mode==='timeout') { assert.equal(reads,20);assert.match(messages.at(-1)!,/超时/); }
 if(mode==='throw') assert.match(messages.at(-1)!,/失败/);
 if(mode==='cancel') assert.deepEqual(messages,['正在重新连接…']);
});
