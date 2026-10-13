'use strict';
// Exercise the actual extension worker through the production desktop adapter.
// Native Codex and the renderer protocol are fixtures; no account is accessed.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{randomUUID,pbkdf2Sync}=require('node:crypto');
const {createRuntime,ORIGIN}=require('../desktop/worker-runtime.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label,timeout=7000){const start=Date.now();while(!predicate()){if(Date.now()-start>timeout)throw Error('Timed out: '+label);await pause(20);}}
async function fixture(initial){
  const folder=fs.mkdtempSync(path.join(__dirname,'worker-note-edit-'));
  const dataFile=path.join(folder,'notes.json');if(initial)fs.writeFileSync(dataFile,JSON.stringify(initial));
  const tab={id:1,windowId:1,url:ORIGIN+'/editor.html',active:true,mutedInfo:{muted:false},autoDiscardable:false};
  const calls=[],messages=[],latest=new Map(),seen=new Map(),nativeDelays=new Map();let clock=0,visible=false,doc,latch=null,proposalMode='accept',delayUntil=0,delivery=Promise.resolve(),restoreToken=null,nativeFile=null;
  const windows={async get(id){return id===1?tab:null;},async list(){return [tab];},async create(){return tab;},async update(id,changes){Object.assign(tab,changes);return tab;},async remove(){},async openSettings(){},async save(){return 1;}};
  const native=async(action,data)=>{
    calls.push({action,data});
    if(nativeDelays.has(action))await pause(nativeDelays.get(action));
    if(action==='catalog')return {ok:true,defaultProject:folder,models:[{model:'fixture',isDefault:true,defaultReasoningEffort:'low',supportedReasoningEfforts:[{reasoningEffort:'low'}]}]};
    if(action==='send')return {ok:true,threadId:'fixture-thread',turnId:'fixture-turn'};
    if(action==='notePrepare'&&nativeFile){if(data.bindingId!==nativeFile.bindingId||data.expectedHash!==nativeFile.hash)throw Error('Fixture file changed before submission.');return {ok:true,file:{...nativeFile}};}
    if(action==='noteVerify'&&nativeFile){if(data.bindingId!==nativeFile.bindingId||data.expectedHash!==nativeFile.hash)throw Error('Fixture file changed on disk.');return {ok:true,file:{...nativeFile}};}
    if(action==='updates'){const updates=data.ids.map(id=>latest.get(id)).filter(Boolean);for(const update of updates)seen.set(update.requestId,update.at);return {ok:true,updates,missing:[]};}
    return {ok:true};
  };
  const runtime=createRuntime({uiRoot:path.join(__dirname,'..','extension'),dataFile,native,windows});
  function receive(message){
    messages.push(message);let result={ok:true};
    if(message.type==='AI_MODE')visible=true;
    if(['COVER','CANCEL_RESTORE'].includes(message.type))visible=false;
    if(message.type==='NOTE_AI_PROPOSE'){
      if(!visible)result={ok:false,accepted:false,reason:'hidden'};
      else if(proposalMode==='formatting')result={ok:false,accepted:false,reason:'formatting_conflict'};
      else if(doc.revision!==message.expectedRevision||doc.text!==message.expectedText||doc.html!==message.expectedHtml)result={ok:false,accepted:false,reason:'local_changes'};
      else{doc.text=message.text;doc.html='<div>'+message.text+'</div>';latch=message.editRequestId;result={ok:true,accepted:true,note:{id:doc.id,text:doc.text,html:proposalMode==='invalid'?12:doc.html}};}
    }
    if(['NOTE_AI_COMMITTED','NOTE_AI_FAILED'].includes(message.type)&&latch===message.editRequestId){if(Number.isSafeInteger(message.revision))doc.revision=message.revision;latch=null;}
    void runtime.receive(1,{replyTo:message.requestId,result});
  }
  await runtime.connect(1,message=>{delivery=delivery.then(async()=>{if(delayUntil>Date.now())await pause(delayUntil-Date.now());receive(message);});});
  const ready=await runtime.request('EDITOR_READY',{}, {id:1,url:tab.url});assert.equal(ready.ok,true);doc={...ready.note};let assistantId=ready.assistant.id;
  const request=async(type,data={})=>runtime.request(type,{assistantId,...data},{id:1,url:tab.url});
  const assistant=()=>runtime.snapshot()['assistant:'+assistantId];
  const note=()=>runtime.snapshot()['note:'+doc.id];
  const publish=async(id,edit,status='working',extra={})=>{const at=++clock;latest.set(id,{requestId:id,at,status,text:'Fixture answer',noteEdit:edit,...extra});await until(()=>seen.get(id)===at,'native update polled');await pause(10);await request('AI_READY');};
  const send=async(data={})=>{const id=randomUUID(),response=await request('AI_SEND',{id,text:'Revise this note.',...data});assert.equal(response.ok,true,response.error);await until(()=>calls.some(x=>x.action==='send'&&x.data.requestId===id),'native send');return id;};
  return {runtime,calls,messages,request,assistant,note,publish,send,folder,get doc(){return doc;},get assistantId(){return assistantId;},get visible(){return visible;},get token(){return restoreToken;},get latch(){return latch;},setFile(file={}){nativeFile={noteId:doc.id,bindingId:randomUUID(),hash:'a'.repeat(64),...nativeFile,...file};return {...nativeFile};},async reveal(mode='panel'){restoreToken=randomUUID();const r=await request('RESUME',{token:restoreToken,mode});assert.equal(r.ok,true,r.error);return r;},async hide(){const r=await request('HIDE');assert.equal(r.ok,true,r.error);},async manual(text){doc.text=text;doc.html='<p>'+text+'</p>';const r=await request('SAVE_NOTE',{note:doc});assert.equal(r.ok,true,r.error);doc={...r.note};},async newNote(text=''){const r=await request('NEW_NOTE',{text});assert.equal(r.ok,true,r.error);doc={...r.note};assistantId=r.assistant.id;return r;},setProposalMode(value){proposalMode=value;},delayNative(action,ms){nativeDelays.set(action,ms);},delayRenderer(ms){delayUntil=Date.now()+ms;},async close(){await delivery;await runtime.close();const target=path.resolve(folder),root=path.resolve(__dirname);assert(target.startsWith(root+path.sep));fs.rmSync(target,{recursive:true,force:true});}};
}
test('note editing stages preserve privacy, conflicts and note/chat bindings',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();
  await t.test('ordinary AI submission does not receive the notepad text',async()=>{assert.equal(f.assistant().editNote,false);await f.manual('Original note');const id=await f.send();assert(!Object.hasOwn(f.calls.find(x=>x.action==='send'&&x.data.requestId===id).data,'noteEdit'));await f.publish(id,null,'completed');});
  let id,base;
  await t.test('explicit permission supplies the exact saved baseline',async()=>{assert.equal((await f.request('AI_NOTE_EDIT_SET',{enabled:true})).ok,true);base={...f.doc};id=await f.send();assert.deepEqual(f.calls.find(x=>x.action==='send'&&x.data.requestId===id).data.noteEdit,{noteId:base.id,text:base.text,revision:base.revision});});
  await t.test('hidden writes stage without changing the ordinary note or renderer',async()=>{await f.hide();await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:1,text:'Hidden revision'});assert.equal(f.note().text,base.text);assert.equal(f.doc.text,base.text);assert.equal(f.assistant().noteEditStage.text,'Hidden revision');assert(!f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'));});
  await t.test('reveal catches up once and separates run IDs from transport counters',async()=>{await f.reveal();const r=await f.request('AI_NOTE_SYNC');assert.equal(r.applied,true);assert.equal(f.note().text,'Hidden revision');assert.equal(f.note().revision,base.revision+1);assert.equal(f.doc.revision,f.note().revision);assert.equal(f.latch,null);const proposal=f.messages.find(m=>m.type==='NOTE_AI_PROPOSE');assert.equal(proposal.editRequestId,id);assert.equal(typeof proposal.requestId,'number');assert(f.messages.some(m=>m.type==='NOTE_AI_COMMITTED'&&m.editRequestId===id));});
  await t.test('automatic proposals never carry explicit replacement consent',()=>{assert.equal(f.messages.find(m=>m.type==='NOTE_AI_PROPOSE').confirmed,false);});
  await t.test('duplicate, stale-baseline and wrong-note snapshots cannot replace the accepted revision',async()=>{for(const edit of [{noteId:base.id,baseRevision:base.revision,sequence:1,text:'Duplicate'},{noteId:randomUUID(),baseRevision:base.revision,sequence:2,text:'Wrong note'},{noteId:base.id,baseRevision:base.revision+1,sequence:2,text:'Wrong base'}])await f.publish(id,edit);assert.equal(f.note().text,'Hidden revision');assert.equal(f.assistant().noteEditStage.sequence,1);});
  await t.test('manual edits win until the user explicitly applies the staged revision',async()=>{await f.manual('My manual change');await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:2,text:'New AI revision'});assert.equal(f.note().text,'My manual change');assert.equal(f.doc.text,'My manual change');assert.equal(f.assistant().noteEditStage.conflict,true);assert.equal(f.assistant().noteEditStage.conflictReason,'local_changes');const r=await f.request('AI_NOTE_APPLY',{force:true});assert.equal(r.applied,true);assert.equal(f.doc.text,'New AI revision');assert.equal(f.assistant().noteEditStage.conflictReason,undefined);});
  await t.test('discard rejects the same snapshot but allows a genuinely later revision',async()=>{await f.hide();await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:3,text:'Discard me'});await f.reveal();await f.request('AI_NOTE_DISCARD');assert.equal(f.assistant().noteEditStage,null);await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:3,text:'Discard me again'});assert.equal(f.assistant().noteEditStage,null);await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:4,text:'Later revision'});assert.equal(f.assistant().noteEditStage.text,'Later revision');assert.equal(f.assistant().noteEditStage.conflict,false);assert.equal(f.doc.text,'Later revision');});
  await t.test('disabling permission permanently revokes this accepted run',async()=>{await f.request('AI_NOTE_EDIT_SET',{enabled:false});await f.request('AI_NOTE_EDIT_SET',{enabled:true});await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:5,text:'Revoked revision'},'completed');assert.equal(f.note().text,'Later revision');assert.equal(f.assistant().pending,null);});
  await t.test('a new note has an independent chat and both editing controls start disabled',async()=>{const previous=f.assistantId,r=await f.newNote('Second note');assert.notEqual(r.assistant.id,previous);assert.equal(r.assistant.noteId,r.note.id);assert.equal(r.assistant.editNote,false);assert.equal(r.assistant.quietEditNote,false);assert.equal(f.doc.text,'Second note');});
});
test('malformed accepted renderer edits release the commit latch without overwriting canonical content',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();await f.manual('Canonical note');await f.request('AI_NOTE_EDIT_SET',{enabled:true});const base={...f.doc},id=await f.send();f.setProposalMode('invalid');await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:1,text:'Uncommitted AI text'},'completed');assert.equal(f.note().text,'Canonical note');assert.equal(f.note().revision,base.revision);assert.equal(f.latch,null);assert.equal(f.assistant().noteEditStage.conflict,true);assert.equal(f.assistant().noteEditStage.conflictReason,'save_failed');const failed=f.messages.find(m=>m.type==='NOTE_AI_FAILED');assert.equal(failed.editRequestId,id);assert.equal(failed.revision,base.revision);
});
test('a delayed renderer receives failure after a timed-out proposal and can release its late latch',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();await f.manual('Durable note');await f.request('AI_NOTE_EDIT_SET',{enabled:true});const base={...f.doc},id=await f.send();f.delayRenderer(4500);await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:1,text:'Late visible proposal'},'completed');assert.equal(f.note().text,'Durable note');assert.equal(f.latch,null);assert.equal(f.assistant().noteEditStage.conflict,true);assert.equal(f.assistant().noteEditStage.conflictReason,'unavailable');assert(f.messages.some(m=>m.type==='NOTE_AI_FAILED'&&m.editRequestId===id));
});
test('an imported pending note preview needs permission and explicit Apply',async t=>{
  const noteId=randomUUID(),assistantId=randomUUID(),requestId=randomUUID();
  const initial={['note:'+noteId]:{id:noteId,text:'Original',html:'',revision:0},['assistant:'+assistantId]:{id:assistantId,agentVersion:4,noteId,messages:[],editNote:false,pending:null,noteEditStage:{requestId,text:'Imported revision',sequence:1,baseRevision:0,baseText:'Original',baseHtml:'',conflict:true,requiresApply:true}},['noteAssistant:'+noteId]:assistantId,lastNoteId:noteId};
  const f=await fixture(initial);t.after(()=>f.close());await f.reveal();assert.equal((await f.request('AI_NOTE_SYNC')).reason,'disabled');await f.request('AI_NOTE_EDIT_SET',{enabled:true});assert.equal((await f.request('AI_NOTE_SYNC')).reason,'explicit_apply');assert.equal(f.note().text,'Original');assert.equal((await f.request('AI_NOTE_APPLY',{force:true})).applied,true);assert.equal(f.note().text,'Imported revision');assert(!Object.hasOwn(f.assistant().noteEditStage,'requiresApply'));
});
function preview(text='Pending revision'){
  const noteId=randomUUID(),assistantId=randomUUID(),requestId=randomUUID();
  return {['note:'+noteId]:{id:noteId,text:'Original note',html:'<b>Original note</b>',revision:2},['assistant:'+assistantId]:{id:assistantId,agentVersion:4,noteId,messages:[],editNote:false,pending:null,noteEditStage:{requestId,text,sequence:1,baseRevision:2,baseText:'Original note',baseHtml:'<b>Original note</b>',conflict:true,requiresApply:true}},['noteAssistant:'+noteId]:assistantId,lastNoteId:noteId};
}
test('confirmed Apply is one-time consent while automatic note editing remains off',async t=>{
  const f=await fixture(preview());t.after(()=>f.close());await f.reveal();
  assert.equal((await f.request('AI_NOTE_SYNC')).reason,'disabled');
  assert.equal((await f.request('AI_NOTE_SYNC',{force:true})).reason,'disabled');
  assert.equal((await f.request('AI_NOTE_APPLY',{force:'true'})).reason,'disabled');
  assert.equal(f.messages.filter(m=>m.type==='NOTE_AI_PROPOSE').length,0);
  const result=await f.request('AI_NOTE_APPLY',{force:true});assert.equal(result.applied,true);assert.equal(f.note().text,'Pending revision');assert.equal(f.doc.text,'Pending revision');assert.equal(result.assistant.editNote,false);assert.equal(f.assistant().editNote,false);assert.equal(f.messages.find(m=>m.type==='NOTE_AI_PROPOSE').confirmed,true);
  assert.equal((await f.request('AI_NOTE_SYNC')).reason,'disabled');const id=await f.send();assert(!Object.hasOwn(f.calls.find(x=>x.action==='send'&&x.data.requestId===id).data,'noteEdit'));await f.publish(id,{noteId:f.doc.id,baseRevision:f.doc.revision,sequence:2,text:'Unpermitted later revision'},'completed');assert.equal(f.note().text,'Pending revision');assert.equal(f.assistant().editNote,false);
});
test('pending Windows newline revisions normalize before proposing and saving',async t=>{
  const f=await fixture(preview('First\r\nSecond\rThird\nFourth'));t.after(()=>f.close());await f.reveal();const result=await f.request('AI_NOTE_APPLY',{force:true});assert.equal(result.applied,true);assert.equal(f.doc.text,'First\nSecond\nThird\nFourth');assert.equal(f.note().text,f.doc.text);assert.equal(result.assistant.noteEditStage.text,f.doc.text);assert.equal(f.messages.find(m=>m.type==='NOTE_AI_PROPOSE').text,f.doc.text);
});
test('confirmed Apply is blocked while hidden and cannot target a different assistant',async t=>{
  const f=await fixture(preview());t.after(()=>f.close());const hidden=await f.request('AI_NOTE_APPLY',{force:true});assert.equal(hidden.ok,false);assert.match(hidden.error,/panel is disabled/i);assert.equal(f.note().text,'Original note');assert.equal(f.doc.text,'Original note');assert.equal(f.messages.filter(m=>m.type==='NOTE_AI_PROPOSE').length,0);
  await f.reveal();const wrong=await f.request('AI_NOTE_APPLY',{force:true,assistantId:randomUUID()});assert.equal(wrong.ok,false);assert.match(wrong.error,/selected note changed/i);assert.equal(f.note().text,'Original note');assert.equal(f.messages.filter(m=>m.type==='NOTE_AI_PROPOSE').length,0);
});

function outcome(id,base,status='unchanged',changed=false,sequence=0){return {requestId:id,noteId:base.id,baseRevision:base.revision,status,changed,sequence};}
test('unchanged completion is explicit and the original model and effort remain visible while pending',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();await f.manual('Leave this text');await f.request('AI_NOTE_EDIT_SET',{enabled:true});const base={...f.doc},id=await f.send(),submitted=f.calls.find(x=>x.action==='send'&&x.data.requestId===id).data;
  assert.equal(f.assistant().pending.model,submitted.model);assert.equal(f.assistant().pending.effort,submitted.effort);assert.equal(submitted.model,'fixture');assert.equal(submitted.effort,'low');
  await f.publish(id,null,'completed',{noteEditOutcome:outcome(id,base)});assert.equal(f.assistant().pending,null);assert.deepEqual(f.assistant().noteEditOutcome,outcome(id,base));assert.equal(f.assistant().noteEditStage,null);assert.equal(f.note().text,'Leave this text');
  await f.request('AI_NOTE_EDIT_SET',{enabled:false});const ordinary=await f.send();assert.equal(f.assistant().noteEditOutcome,null);await f.publish(ordinary,null,'completed');assert.equal(f.assistant().noteEditOutcome,null);
});
test('hidden completed edits retain their outcome without touching the displayed or saved ordinary note',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();await f.manual('Visible original');await f.request('AI_NOTE_EDIT_SET',{enabled:true});const base={...f.doc},id=await f.send();await f.hide();
  await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:1,text:'Background change'},'completed',{noteEditOutcome:outcome(id,base,'changed',true,1)});
  assert.equal(f.assistant().pending,null);assert.equal(f.assistant().noteEditOutcome.status,'changed');assert.equal(f.note().text,'Visible original');assert.equal(f.doc.text,'Visible original');assert.equal(f.assistant().noteEditStage.text,'Background change');assert.equal(f.messages.filter(m=>m.type==='NOTE_AI_PROPOSE').length,0);
});
test('revoking visible note updates preserves the outcome of accepted work without applying it',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();await f.manual('Keep my view');await f.request('AI_NOTE_EDIT_SET',{enabled:true});const base={...f.doc},id=await f.send();await f.request('AI_NOTE_EDIT_SET',{enabled:false});assert.equal(f.assistant().pending.noteEditBase,undefined);
  await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:1,text:'Accepted disk change'},'completed',{noteEditOutcome:outcome(id,base,'changed',true,1)});
  assert.equal(f.assistant().editNote,false);assert.equal(f.assistant().noteEditOutcome.status,'changed');assert.equal(f.assistant().noteEditStage,null);assert.equal(f.note().text,'Keep my view');assert.equal(f.doc.text,'Keep my view');
});
test('an early native failure produces an explicit note outcome and retries preserve the same pending request',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();await f.manual('Keep this note');await f.request('AI_NOTE_EDIT_SET',{enabled:true});const base={...f.doc},id=await f.send();
  await f.publish(id,null,'working',{phase:'Retrying · Temporary outage'});assert.equal(f.assistant().pending.id,id);assert.equal(f.assistant().pending.phase,'Retrying · Temporary outage');assert.equal(f.assistant().noteEditOutcome,null);assert.equal(f.calls.filter(x=>x.action==='send').length,1);
  await f.publish(id,null,'failed',{error:'The turn was not accepted.'});assert.equal(f.assistant().pending,null);assert.deepEqual(f.assistant().noteEditOutcome,{...outcome(id,base,'error'),error:'The turn was not accepted.'});assert.equal(f.assistant().error,'The turn was not accepted.');assert.equal(f.note().text,'Keep this note');
});
test('terminal outcomes cannot be attached to a different note, baseline or submitted request',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();await f.request('AI_NOTE_EDIT_SET',{enabled:true});
  for(const bad of [{noteId:randomUUID()},{baseRevision:99},{requestId:randomUUID()},{sequence:-1},{status:'unknown'},{changed:'true'}]){
    const base={...f.doc},id=await f.send();await f.publish(id,null,'completed',{noteEditOutcome:{...outcome(id,base),...bad}});assert.equal(f.assistant().noteEditOutcome,null);
  }
});
test('renderer conflict reasons survive completion and are cleared only after a successful Apply',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();await f.manual('Original formatting');await f.request('AI_NOTE_EDIT_SET',{enabled:true});const base={...f.doc},id=await f.send(),edit={noteId:base.id,baseRevision:base.revision,sequence:1,text:'AI revision'};f.setProposalMode('formatting');
  await f.publish(id,edit);assert.equal(f.assistant().noteEditStage.conflictReason,'formatting_conflict');assert.equal(f.note().text,'Original formatting');
  await f.publish(id,edit,'completed',{noteEditOutcome:outcome(id,base,'changed',true,1)});assert.equal(f.assistant().noteEditStage.conflictReason,'formatting_conflict');assert.equal(f.assistant().noteEditOutcome.status,'changed');assert.equal(f.note().text,'Original formatting');
  f.setProposalMode('accept');const applied=await f.request('AI_NOTE_APPLY',{force:true});assert.equal(applied.applied,true);assert.equal(f.note().text,'AI revision');assert.equal(f.assistant().noteEditStage.conflictReason,undefined);
});

test('quiet submission inherits the same editing consent enabled in Reference',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();await f.manual('Ordinary private note');await f.request('AI_NOTE_EDIT_SET',{enabled:true});await f.reveal('quiet');
  assert.equal(f.messages.filter(m=>m.type==='AI_MODE').at(-1).mode,'quiet');const file=f.setFile(),base={...f.doc},id=await f.send({noteBindingId:file.bindingId,noteFileHash:file.hash}),pending=f.assistant().pending,submitted=f.calls.find(x=>x.action==='send'&&x.data.requestId===id).data;
  assert.equal(f.assistant().editNote,true);assert.equal(f.assistant().quietEditNote,true);assert.equal(pending.mode,'quiet');assert.equal(pending.noteEditBase.text,base.text);
  assert.deepEqual(submitted.noteEdit,{noteId:base.id,text:base.text,revision:base.revision,bindingId:file.bindingId,fileHash:file.hash});assert.equal(f.calls.filter(x=>x.action==='notePrepare').length,1);
  await f.publish(id,null,'completed');assert.deepEqual(f.assistant().lastTurn,{requestId:id,mode:'quiet',status:'completed',noteEdit:true,noteEditTarget:{noteId:base.id,baseRevision:base.revision,bindingId:file.bindingId,fileHash:file.hash}});assert.equal(f.assistant().messages.at(-1).requestId,id);assert.equal(f.assistant().messages.at(-1).mode,'quiet');assert.equal(f.note().text,'Ordinary private note');assert.equal(f.doc.text,'Ordinary private note');assert.equal(f.messages.filter(m=>m.type==='NOTE_AI_PROPOSE').length,0);
});
test('switching to quiet freezes an accepted panel revision until Reference is explicitly reopened',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();await f.manual('Frozen note');await f.request('AI_NOTE_EDIT_SET',{enabled:true});const base={...f.doc},id=await f.send();await f.reveal('quiet');
  await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:1,text:'Panel task background revision'});assert.equal(f.doc.text,'Frozen note');assert.equal(f.note().text,'Frozen note');assert.equal((await f.request('AI_NOTE_SYNC')).reason,'quiet');assert.equal((await f.request('AI_NOTE_APPLY',{force:true})).reason,'quiet');assert.equal(f.messages.filter(m=>m.type==='NOTE_AI_PROPOSE').length,0);
  await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:1,text:'Panel task background revision'},'completed',{noteEditOutcome:outcome(id,base,'changed',true,1)});assert.deepEqual(f.assistant().lastTurn,{requestId:id,mode:'panel',status:'completed'});assert.equal(f.doc.text,'Frozen note');
  await f.reveal('panel');assert.equal((await f.request('AI_NOTE_SYNC')).applied,true);assert.equal(f.note().text,'Panel task background revision');assert.equal(f.doc.text,'Panel task background revision');
});
test('quiet tasks cannot be steered through their small question mode and failures remain distinct from ready',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal('quiet');const id=await f.send();const steering=await f.request('AI_STEER',{id:randomUUID(),text:'Append more'});assert.equal(steering.ok,false);assert.match(steering.error,/Open Reference/);assert.equal(f.calls.filter(x=>x.action==='steer').length,0);
  await f.publish(id,null,'failed',{error:'Fixture outage'});assert.deepEqual(f.assistant().lastTurn,{requestId:id,mode:'quiet',status:'failed'});assert.equal(f.assistant().error,'Fixture outage');const failedMessage=f.assistant().messages.at(-1);assert.equal(failedMessage.requestId,id);assert.equal(failedMessage.mode,'quiet');
});
test('quiet replies and terminal request IDs remain bound to their owning note after a tab switch',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal('quiet');await f.manual('First note');const original=f.assistantId,firstNote=f.doc.id,id=await f.send();await f.newNote('Second note');await f.publish(id,null,'completed');
  const owner=f.runtime.snapshot()['assistant:'+original];assert.deepEqual(owner.lastTurn,{requestId:id,mode:'quiet',status:'completed'});assert.equal(owner.noteId,firstNote);assert.equal(f.assistant().lastTurn,undefined);assert.equal(f.note().text,'Second note');assert.equal(f.doc.text,'Second note');
});
function passwordFixture(password){const salt=Buffer.from('quiet-test-salt-32bytes-for-tests');return {accessLock:{salt:salt.toString('base64'),hash:pbkdf2Sync(password,salt,310000,32,'sha256').toString('base64')}};}
test('passphrase unlock retains quiet mode and hidden state cannot bypass its lock',async t=>{
  const f=await fixture(passwordFixture('quiet-passphrase'));t.after(()=>f.close());assert.equal((await f.reveal('quiet')).locked,true);assert.equal(f.runtime.enabled(1),false);assert.equal(f.visible,false);assert.equal((await f.request('AI_SEND',{id:randomUUID(),text:'Locked question'})).ok,false);
  assert.equal((await f.request('UNLOCK',{token:f.token,password:'wrong'})).ok,false);assert.equal(f.runtime.enabled(1),false);assert.equal(f.messages.some(m=>m.type==='AI_MODE'),false);
  assert.equal((await f.request('UNLOCK',{token:f.token,password:'quiet-passphrase'})).ok,true);assert.equal(f.runtime.enabled(1),true);assert.equal(f.messages.filter(m=>m.type==='AI_MODE').at(-1).mode,'quiet');const id=await f.send();assert.equal(f.assistant().pending.mode,'quiet');await f.publish(id,null,'completed');
});
test('panic cancels a quiet restore queued behind another request and an in-flight unlock',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal();f.delayNative('catalog',120);const blocked=f.request('AI_CONTROLS',{operation:'choose',model:'fixture',effort:'low'});await until(()=>f.calls.some(x=>x.action==='catalog'),'catalog blocking the worker');const quiet=f.request('RESUME',{token:randomUUID(),mode:'quiet'});await f.hide();await blocked;assert.equal((await quiet).ok,false);assert.equal(f.runtime.enabled(1),false);assert.equal(f.messages.filter(m=>m.type==='AI_MODE'&&m.mode==='quiet').length,0);
  const locked=await fixture(passwordFixture('quiet-passphrase'));t.after(()=>locked.close());await locked.reveal('quiet');const unlocking=locked.request('UNLOCK',{token:locked.token,password:'quiet-passphrase'});await pause(1);await locked.hide();assert.equal((await unlocking).ok,false);assert.equal(locked.runtime.enabled(1),false);assert.equal(locked.messages.some(m=>m.type==='AI_MODE'),false);
});

async function quietEditable(f,text='Private ordinary baseline',{automatic=false}={}){
  await f.reveal('quiet');await f.manual(text);
  const selected=await f.request('AI_QUIET_NOTE_EDIT_SET',{enabled:true});assert.equal(selected.ok,true,selected.error);
  if(automatic)assert.equal((await f.request('AI_QUIET_NOTE_AUTO_SET',{enabled:true})).ok,true);
  const base={...f.doc},file=f.setFile(),id=await f.send({noteBindingId:file.bindingId,noteFileHash:file.hash});
  return {base,file,id};
}
async function finishQuietEdit(f,job,text='Changed quietly',extra={}){
  const file=f.setFile({hash:'b'.repeat(64)});
  await f.publish(job.id,{noteId:job.base.id,baseRevision:job.base.revision,sequence:1,text,file},'completed',{noteEditOutcome:outcome(job.id,job.base,'changed',true,1),...extra});
  return file;
}
function quietApply(f,job,extra={}){return f.request('AI_QUIET_NOTE_APPLY',{requestId:job.id,bindingId:job.file.bindingId,expectedHash:job.file.hash,...extra});}
test('quiet editing control shares consent, defaults off and cannot be toggled hidden, in panel mode or during a turn',async t=>{
  const f=await fixture();t.after(()=>f.close());assert.equal(f.assistant().quietEditNote,false);
  assert.equal((await f.request('AI_QUIET_NOTE_EDIT_SET',{enabled:true})).ok,false);
  await f.reveal();assert.equal((await f.request('AI_QUIET_NOTE_EDIT_SET',{enabled:true})).ok,false);
  await f.reveal('quiet');assert.equal((await f.request('AI_QUIET_NOTE_EDIT_SET',{enabled:'true'})).ok,false);
  const job=await quietEditable(f);assert.equal(f.assistant().editNote,true);assert.equal(f.assistant().quietEditNote,true);
  const pending=await f.request('AI_QUIET_NOTE_EDIT_SET',{enabled:false});assert.equal(pending.ok,false);assert.match(pending.error,/active turn/);assert.equal(f.assistant().quietEditNote,true);
  await finishQuietEdit(f,job);await f.newNote('Different note');assert.equal(f.assistant().quietEditNote,false);assert.equal(f.assistant().editNote,false);
});
test('quiet opt-in supplies only the current authoritative file and captures its original guarded grant',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f,'Authoritative quiet note');
  const sent=f.calls.find(x=>x.action==='send'&&x.data.requestId===job.id).data;
  assert.deepEqual(sent.noteEdit,{noteId:job.base.id,text:job.base.text,revision:job.base.revision,bindingId:job.file.bindingId,fileHash:job.file.hash});
  assert.deepEqual(f.assistant().pending.noteEditTarget,{noteId:job.base.id,baseRevision:job.base.revision,bindingId:job.file.bindingId,fileHash:job.file.hash});
  assert.equal(f.calls.filter(x=>x.action==='notePrepare').length,1);
  await finishQuietEdit(f,job);
});
test('quiet permission cannot submit an unavailable note file or stale baseline hash',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal('quiet');await f.request('AI_QUIET_NOTE_EDIT_SET',{enabled:true});
  let response=await f.request('AI_SEND',{id:randomUUID(),text:'Edit this note'});assert.equal(response.ok,false);assert.match(response.error,/file is unavailable/);
  const file=f.setFile();response=await f.request('AI_SEND',{id:randomUUID(),text:'Edit this note',noteBindingId:file.bindingId,noteFileHash:'c'.repeat(64)});assert.equal(response.ok,false);assert.match(response.error,/changed before submission/);
  assert.equal(f.assistant().pending,null);assert.equal(f.calls.some(x=>x.action==='send'),false);
});
test('quiet authorized working and hidden completion stage real file changes without modifying canonical or displayed notes',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f),file=f.setFile({hash:'b'.repeat(64)});
  await f.publish(job.id,{noteId:job.base.id,baseRevision:job.base.revision,sequence:1,text:'First quiet disk revision',file});
  assert.equal(f.assistant().noteEditStage.quiet,true);assert.deepEqual(f.assistant().noteEditStage.quietGrant,f.assistant().pending.noteEditTarget);
  assert.equal(f.note().text,job.base.text);assert.equal(f.doc.text,job.base.text);assert.equal((await quietApply(f,job)).ok,false);
  await f.hide();const completedFile=f.setFile({hash:'c'.repeat(64)});await f.publish(job.id,{noteId:job.base.id,baseRevision:job.base.revision,sequence:2,text:'Completed quiet disk revision',file:completedFile},'completed',{noteEditOutcome:outcome(job.id,job.base,'changed',true,2)});
  assert.equal(f.assistant().lastTurn.noteEdit,true);assert.equal(f.assistant().lastTurn.mode,'quiet');assert.equal(f.assistant().noteEditStage.text,'Completed quiet disk revision');assert.equal(f.note().text,job.base.text);assert.equal(f.doc.text,job.base.text);assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);assert.equal((await quietApply(f,job)).ok,false);
});
test('only explicit quiet Apply projects the completed captured revision once, with no replacement consent',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f);await finishQuietEdit(f,job);
  assert.equal((await f.request('AI_NOTE_SYNC')).applied,false);assert.equal((await f.request('AI_NOTE_APPLY',{force:true})).reason,'quiet');assert.equal(f.note().text,job.base.text);
  const applied=await quietApply(f,job,{force:true});assert.equal(applied.ok,true,applied.error);assert.equal(applied.applied,true);assert.equal(f.note().text,'Changed quietly');assert.equal(f.doc.text,'Changed quietly');assert.equal(f.assistant().editNote,true);assert.equal(f.assistant().quietEditNote,true);
  const proposal=f.messages.find(m=>m.type==='NOTE_AI_PROPOSE');assert.equal(proposal.explicitQuiet,true);assert.equal(proposal.confirmed,false);assert.equal(proposal.editRequestId,job.id);
  assert.equal(f.messages.find(m=>m.type==='NOTE_AI_COMMITTED').explicitQuiet,true);
  assert.equal((await quietApply(f,job)).reason,'already_applied');assert.equal(f.messages.filter(m=>m.type==='NOTE_AI_PROPOSE').length,1);
});
test('opening Reference and turning shared editing off preserves the captured quiet revision without automatically applying it',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f);await f.reveal('panel');await f.request('AI_NOTE_EDIT_SET',{enabled:true});await f.request('AI_NOTE_EDIT_SET',{enabled:false});
  assert(f.assistant().pending.noteEditBase);assert.equal(f.assistant().editNote,false);assert.equal(f.assistant().quietEditNote,false);await finishQuietEdit(f,job);assert.equal(f.note().text,job.base.text);assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);
  await f.request('AI_NOTE_EDIT_SET',{enabled:true});assert.equal((await f.request('AI_NOTE_SYNC')).reason,'quiet');assert.equal((await quietApply(f,job)).ok,false);await f.reveal('quiet');assert.equal((await quietApply(f,job)).applied,true);
});
test('manual edits and formatting changes cannot be overridden by quiet Apply even with force:true',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f);await finishQuietEdit(f,job);await f.manual('My newer local edit');
  const applied=await quietApply(f,job,{force:true});assert.equal(applied.applied,false);assert.equal(applied.reason,'local_changes');assert.equal(f.note().text,'My newer local edit');assert.equal(f.doc.text,'My newer local edit');assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);
});
test('quiet Apply rejects different requests, assistants, file bindings, hashes and newer disk changes',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f);await finishQuietEdit(f,job);
  assert.equal((await quietApply(f,job,{requestId:randomUUID()})).ok,false);assert.equal((await quietApply(f,job,{assistantId:randomUUID()})).ok,false);
  for(const extra of [{bindingId:randomUUID()},{expectedHash:'d'.repeat(64)}]){const rejected=await quietApply(f,job,extra);assert.equal(rejected.applied,false);assert.equal(rejected.reason,'disk_changed');}
  f.setFile({hash:'e'.repeat(64)});const rejected=await quietApply(f,job);assert.equal(rejected.applied,false);assert.equal(rejected.reason,'disk_changed');assert.equal(f.note().text,job.base.text);assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);
});
test('a quiet grant cannot adopt a snapshot from another binding or an ordinary panel turn',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f),file=f.setFile({hash:'b'.repeat(64)});
  await f.publish(job.id,{noteId:job.base.id,baseRevision:job.base.revision,sequence:1,text:'Foreign binding revision',file:{...file,bindingId:randomUUID()}},'completed');
  assert.equal(f.assistant().noteEditStage, null);assert.equal((await quietApply(f,job)).ok,false);assert.equal(f.note().text,job.base.text);
  await f.reveal('panel');await f.request('AI_NOTE_EDIT_SET',{enabled:true});const panelId=await f.send({noteBindingId:file.bindingId,noteFileHash:file.hash});await f.hide();await f.publish(panelId,{noteId:job.base.id,baseRevision:job.base.revision,sequence:1,text:'Panel revision',file},'completed');await f.reveal('quiet');assert.equal((await quietApply(f,{...job,id:panelId})).ok,false);
});
test('relinking a file converts its quiet pending stage into explicit review and removes future permission',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f);await finishQuietEdit(f,job);
  await f.request('NAME_NOTE_FILE',{noteId:job.base.id,name:'Different document',bindingId:randomUUID()});
  const rejected=await quietApply(f,job);assert.equal(rejected.applied,false);assert.equal(rejected.reason,'explicit_apply');assert.equal(f.note().text,job.base.text);assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);
  await f.request('RELOAD_NOTE_FILE',{noteId:job.base.id,name:'Different document',text:'Reloaded file',relinked:true});assert.equal(f.assistant().quietEditNote,false);assert.equal(f.assistant().editNote,false);
});
test('a different selected note never receives a completed quiet note revision',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f),assistantId=f.assistantId;await finishQuietEdit(f,job);await f.newNote('Other note');await f.reveal('quiet');
  assert.equal((await quietApply(f,job,{assistantId})).ok,false);assert.equal(f.note().text,'Other note');assert.equal(f.doc.text,'Other note');assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);
});
test('quiet automatic insertion defaults off and settings cannot change hidden, in panel mode or during work',async t=>{
  const f=await fixture();t.after(()=>f.close());assert.equal(f.assistant().quietAutoApply,false);
  assert.equal((await f.request('AI_QUIET_NOTE_AUTO_SET',{enabled:true})).ok,false);
  await f.reveal('panel');assert.equal((await f.request('AI_QUIET_NOTE_AUTO_SET',{enabled:true})).ok,false);
  await f.reveal('quiet');assert.equal((await f.request('AI_QUIET_NOTE_AUTO_SET',{enabled:'true'})).ok,false);
  const job=await quietEditable(f,'Automatic baseline',{automatic:true});assert.equal(f.assistant().quietAutoApply,true);assert.equal(f.assistant().pending.quietAutoApply,true);
  const changed=await f.request('AI_QUIET_NOTE_AUTO_SET',{enabled:false});assert.equal(changed.ok,false);assert.match(changed.error,/active turn/);
  await finishQuietEdit(f,job);assert.equal(f.assistant().lastTurn.quietAutoApply,true);
  await f.request('AI_QUIET_NOTE_EDIT_SET',{enabled:false});assert.equal(f.assistant().quietAutoApply,true);assert.equal(f.assistant().quietEditNote,false);
  await f.newNote();assert.equal(f.assistant().quietAutoApply,false);
});
test('automatic insertion preference never grants an ordinary quiet request note access',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal('quiet');await f.request('AI_QUIET_NOTE_AUTO_SET',{enabled:true});
  const id=await f.send();assert.equal(f.assistant().quietEditNote,false);assert.equal(f.assistant().pending.quietAutoApply,undefined);assert.equal(f.assistant().pending.noteEditTarget,undefined);
  await f.publish(id,null,'completed');assert.equal(f.assistant().lastTurn.quietAutoApply,undefined);assert.equal(f.assistant().lastTurn.noteEdit,undefined);assert.equal((await f.request('AI_QUIET_NOTE_APPLY',{automatic:true,requestId:id})).ok,false);assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);
});
test('automatic completion still waits for a guarded UI application and applies one completed note revision once',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f,'Automatic baseline',{automatic:true});
  await finishQuietEdit(f,job,'Automatic completed revision');assert.equal(f.doc.text,job.base.text);assert.equal(f.note().text,job.base.text);assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);
  const applied=await quietApply(f,job,{automatic:true});assert.equal(applied.applied,true);assert.equal(f.doc.text,'Automatic completed revision');assert.equal(f.note().text,'Automatic completed revision');
  const proposal=f.messages.find(m=>m.type==='NOTE_AI_PROPOSE');assert.equal(proposal.explicitQuiet,true);assert.equal(proposal.confirmed,false);
  assert.equal((await quietApply(f,job,{automatic:true})).reason,'already_applied');assert.equal(f.messages.filter(m=>m.type==='NOTE_AI_PROPOSE').length,1);
});
test('hidden automatic completion stays staged and only resumes its guarded application after quiet restore',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f,'Hidden automatic baseline',{automatic:true});await f.hide();await finishQuietEdit(f,job,'Hidden completed revision');
  assert.equal((await quietApply(f,job,{automatic:true})).ok,false);assert.equal(f.doc.text,job.base.text);assert.equal(f.note().text,job.base.text);assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);
  await f.reveal('panel');assert.equal((await quietApply(f,job,{automatic:true})).ok,false);assert.equal(f.note().text,job.base.text);await f.reveal('quiet');assert.equal((await quietApply(f,job,{automatic:true})).applied,true);
});
test('enabling automatic insertion after submission cannot retrofit consent, while explicit insert remains available',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f);await finishQuietEdit(f,job);
  await f.request('AI_QUIET_NOTE_AUTO_SET',{enabled:true});assert.equal(f.assistant().lastTurn.quietAutoApply,undefined);
  const denied=await quietApply(f,job,{automatic:true});assert.equal(denied.ok,false);assert.match(denied.error,/not enabled for this task/);assert.equal(f.note().text,job.base.text);
  assert.equal((await quietApply(f,job,{automatic:'true'})).ok,false);assert.equal((await quietApply(f,job)).applied,true);
});
test('turning automatic insertion off after completion revokes automatic application without losing the staged revision',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f,'Automatic baseline',{automatic:true});await finishQuietEdit(f,job);
  await f.request('AI_QUIET_NOTE_AUTO_SET',{enabled:false});assert.equal(f.assistant().lastTurn.quietAutoApply,true);assert.equal(f.assistant().quietAutoApply,false);
  assert.equal((await quietApply(f,job,{automatic:true})).ok,false);assert.equal(f.note().text,job.base.text);assert.equal(f.assistant().noteEditStage.appliedRevision,undefined);assert.equal((await quietApply(f,job)).applied,true);
});
test('automatic application cannot override newer local or disk changes or another selected note',async t=>{
  const local=await fixture();t.after(()=>local.close());const localJob=await quietEditable(local,'Local baseline',{automatic:true});await finishQuietEdit(local,localJob);await local.manual('Manual replacement');
  const conflicted=await quietApply(local,localJob,{automatic:true,force:true});assert.equal(conflicted.reason,'local_changes');assert.equal(local.doc.text,'Manual replacement');assert.equal(local.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);
  const disk=await fixture();t.after(()=>disk.close());const diskJob=await quietEditable(disk,'Disk baseline',{automatic:true});await finishQuietEdit(disk,diskJob);disk.setFile({hash:'f'.repeat(64)});
  assert.equal((await quietApply(disk,diskJob,{automatic:true,force:true})).reason,'disk_changed');assert.equal(disk.doc.text,diskJob.base.text);
  const owner=disk.assistantId;await disk.newNote('Other selected note');await disk.reveal('quiet');assert.equal((await quietApply(disk,diskJob,{automatic:true,assistantId:owner})).ok,false);assert.equal(disk.doc.text,'Other selected note');
});
test('hiding during automatic file verification cancels a delayed visible proposal',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f,'Hide race baseline',{automatic:true});await finishQuietEdit(f,job);f.delayNative('noteVerify',150);
  const applying=quietApply(f,job,{automatic:true});await until(()=>f.calls.some(x=>x.action==='noteVerify'),'automatic disk verification');await f.hide();const result=await applying;
  assert.equal(result.applied,false);assert.equal(result.reason,'hidden');assert.equal(f.note().text,job.base.text);assert.equal(f.doc.text,job.base.text);assert.equal(f.assistant().noteEditStage.appliedRevision,undefined);
});

test('the compact and Reference editing controls update one per-note consent in both directions',async t=>{
  const f=await fixture();t.after(()=>f.close());await f.reveal('panel');
  const shared=enabled=>{assert.equal(f.assistant().editNote,enabled);assert.equal(f.assistant().quietEditNote,enabled);};
  shared(false);
  assert.equal((await f.request('AI_NOTE_EDIT_SET',{enabled:true})).ok,true);shared(true);
  await f.reveal('quiet');shared(true);
  assert.equal((await f.request('AI_QUIET_NOTE_EDIT_SET',{enabled:false})).ok,true);shared(false);
  await f.reveal('panel');shared(false);
  await f.reveal('quiet');assert.equal((await f.request('AI_QUIET_NOTE_EDIT_SET',{enabled:true})).ok,true);shared(true);
  await f.reveal('panel');shared(true);
  assert.equal((await f.request('AI_NOTE_EDIT_SET',{enabled:false})).ok,true);shared(false);
  await f.reveal('quiet');shared(false);
});

test('enabling shared editing cannot retrofit a file grant into an already submitted ordinary turn',async t=>{
  for(const mode of ['quiet','panel'])await t.test(mode,async t=>{
    const f=await fixture();t.after(()=>f.close());await f.reveal(mode);await f.manual('Ungrantable existing note');
    const base={...f.doc},id=await f.send(),sent=f.calls.find(x=>x.action==='send'&&x.data.requestId===id).data;
    assert.equal(Object.hasOwn(sent,'noteEdit'),false);assert.equal(f.assistant().pending.noteEditBase,undefined);
    await f.reveal('panel');assert.equal((await f.request('AI_NOTE_EDIT_SET',{enabled:true})).ok,true);
    assert.equal(f.assistant().editNote,true);assert.equal(f.assistant().quietEditNote,true);
    assert.equal(f.assistant().pending.noteEditBase,undefined);assert.equal(f.assistant().pending.noteEditTarget,undefined);
    await f.publish(id,{noteId:base.id,baseRevision:base.revision,sequence:1,text:'Unrequested note revision'},'completed');
    assert.equal(f.assistant().noteEditStage==null,true);assert.equal(f.note().text,base.text);assert.equal(f.doc.text,base.text);
    assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);
    const file=f.setFile(),next=await f.send({noteBindingId:file.bindingId,noteFileHash:file.hash});
    assert.equal(f.calls.find(x=>x.action==='send'&&x.data.requestId===next).data.noteEdit.noteId,base.id);
    await f.publish(next,null,'completed');
  });
});

test('turning compact editing off suppresses automatic insertion but keeps explicit captured-revision insertion available',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f,'Shared automatic baseline',{automatic:true});
  await finishQuietEdit(f,job,'Accepted revision requiring explicit insertion');
  const captured=JSON.parse(JSON.stringify(f.assistant().lastTurn.noteEditTarget));
  assert.equal((await f.request('AI_QUIET_NOTE_EDIT_SET',{enabled:false})).ok,true);
  assert.equal(f.assistant().editNote,false);assert.equal(f.assistant().quietEditNote,false);assert.equal(f.assistant().quietAutoApply,true);
  assert.deepEqual(f.assistant().lastTurn.noteEditTarget,captured);assert.equal(f.assistant().lastTurn.quietAutoApply,true);
  const denied=await quietApply(f,job,{automatic:true});assert.equal(denied.ok,false);assert.match(denied.error,/note editing is now off/);
  assert.equal(f.note().text,job.base.text);assert.equal(f.doc.text,job.base.text);assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);
  assert.equal((await quietApply(f,job)).applied,true);assert.equal(f.note().text,'Accepted revision requiring explicit insertion');
  const next=await f.send();assert.equal(Object.hasOwn(f.calls.find(x=>x.action==='send'&&x.data.requestId===next).data,'noteEdit'),false);await f.publish(next,null,'completed');
});

test('turning shared editing off in Reference during a quiet task preserves its grant and stops automatic visible application',async t=>{
  const f=await fixture();t.after(()=>f.close());const job=await quietEditable(f,'Captured quiet baseline',{automatic:true});
  const captured=JSON.parse(JSON.stringify(f.assistant().pending.noteEditTarget)),base=JSON.parse(JSON.stringify(f.assistant().pending.noteEditBase));
  await f.reveal('panel');assert.equal((await f.request('AI_NOTE_EDIT_SET',{enabled:false})).ok,true);
  assert.equal(f.assistant().editNote,false);assert.equal(f.assistant().quietEditNote,false);
  assert.deepEqual(f.assistant().pending.noteEditTarget,captured);assert.deepEqual(f.assistant().pending.noteEditBase,base);
  await finishQuietEdit(f,job,'Quiet work accepted before opt-out');assert.equal(f.assistant().noteEditStage.text,'Quiet work accepted before opt-out');
  assert.equal(f.note().text,job.base.text);assert.equal(f.doc.text,job.base.text);
  await f.reveal('quiet');assert.equal((await quietApply(f,job,{automatic:true})).ok,false);
  assert.equal(f.messages.some(m=>m.type==='NOTE_AI_PROPOSE'),false);assert.equal((await quietApply(f,job)).applied,true);
});
