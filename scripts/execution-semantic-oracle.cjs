// TEST ONLY. Frozen classifications do not import production facts or reducers.
const assert=require('node:assert/strict');
const classes=new Map();
const group=(category, keys)=>{for(const key of keys.split(' '))classes.set(key,category);};
group('risk','mutation_started:true write_attempted:true created_ids:nonempty deleted_ids:nonempty applied:nonempty item_results:applied partial:true notApplied:nonempty survived:nonempty survivedIds:nonempty survivedTotal:positive deleted:false disconnected:false visibilityApplied:false status:partial rollback_attempted:true rollbackAttempted:true rollback_complete:true rollbackComplete:true');
group('unsettled','native_settled:false duplicate:true status:uncertain');
group('unknown','verified:false unverified:nonempty status:stale status:failed status:unverified readback_verified:false');
group('settled','native_settled:true');
group('absence-candidate','write_attempted:false');
function category(adapter){const key=adapter.field+':'+adapter.test;assert.ok(classes.has(key),'unclassified production adapter: '+key);return classes.get(key);}
const risk=a=>['risk','unsettled'].includes(category(a));
const unsettled=a=>category(a)==='unsettled';
const absence=a=>category(a)==='absence-candidate';
module.exports={category,risk,unsettled,absence};
