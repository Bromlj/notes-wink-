'use strict';
// Exercise app-server message phases without starting Codex, reading credentials,
// invoking connected services or writing a document. Full narration remains
// available to Reference; ordinary note insertion uses only finalText.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {Codex}=require('../native/host.cjs');
const {createRuntime,ORIGIN}=require('../desktop/worker-runtime.cjs');

function fixture(){
 const c=new Codex(),events=[];
 const turn={requestId:'request',turnId:'turn',items:new Map(),activity:new Map(),diff:'',plan:[]};
 c.turns.set('thread',turn);c.on('update',event=>events.push(event));
 const send=(method,params={})=>c.message({method,params:{threadId:'thread',turnId:'turn',...params}});
 const item=(id,text,phase,extra={})=>({id,text,type:'agentMessage',...(phase!==undefined?{phase}:{}),...extra});
 const started=(id,text='',phase)=>send('item/started',{item:item(id,text,phase)});
 const completed=(id,text,phase)=>send('item/completed',{item:item(id,text,phase)});
 const delta=(id,text)=>send('item/agentMessage/delta',{itemId:id,delta:text});
 const finish=(items=[],status='completed')=>{send('turn/completed',{turn:{id:'turn',status,items}});return events.at(-1);};
 return {c,turn,events,send,item,started,completed,delta,finish};
}

test('commentary remains in Reference but only the explicit final answer is insertable',()=>{
 const f=fixture();f.completed('progress',"I'll check the document.",'commentary');
 f.completed('tool-progress','Using the Pages service.','commentary');
 f.completed('answer','The exact requested note.','final_answer');
 const final=f.finish();
 assert.equal(final.text,"I'll check the document.\n\nUsing the Pages service.\n\nThe exact requested note.");
 assert.equal(final.finalText,'The exact requested note.');
});

test('multiple explicitly final items retain their order without commentary',()=>{
 const f=fixture();f.completed('first','First final paragraph.','final_answer');
 f.completed('interim','Another tool finished.','commentary');
 f.completed('second','Second final paragraph.','final_answer');
 assert.equal(f.finish().finalText,'First final paragraph.\n\nSecond final paragraph.');
});

test('phase supplied at item start survives delta streaming and an unclassified completion',()=>{
 const f=fixture();f.started('progress','','commentary');f.delta('progress','Progress narration.');f.completed('progress','Progress narration.');
 f.started('answer','','final_answer');f.delta('answer','Actual ');f.delta('answer','answer.');f.completed('answer','Actual answer.');
 const final=f.finish();assert.equal(final.text,'Progress narration.\n\nActual answer.');assert.equal(final.finalText,'Actual answer.');
});

test('phase arriving only at item completion classifies earlier untagged deltas',()=>{
 const f=fixture();f.delta('progress','I am working.');f.completed('progress','I am working.','commentary');
 f.delta('answer','Finished answer.');f.completed('answer','Finished answer.','final_answer');
 assert.equal(f.finish().finalText,'Finished answer.');
});

test('phase arriving only in the terminal turn payload corrects earlier unknown items',()=>{
 const f=fixture();f.delta('progress','Unknown progress text.');f.delta('answer','Partial answer');
 const final=f.finish([f.item('progress','Unknown progress text.','commentary'),f.item('answer','Authoritative final answer.','final_answer')]);
 assert.equal(final.text,'Unknown progress text.\n\nAuthoritative final answer.');assert.equal(final.finalText,'Authoritative final answer.');
});

test('completion text replaces streamed text instead of duplicating or appending it',()=>{
 const f=fixture();f.started('answer','','final_answer');f.delta('answer','Draft text');
 f.completed('answer','Corrected final text.','final_answer');
 const final=f.finish([f.item('answer','Corrected final text.')]);
 assert.equal(final.text,'Corrected final text.');assert.equal(final.finalText,'Corrected final text.');
});

test('an explicitly empty final item clears stale deltas and blocks legacy fallback',()=>{
 const f=fixture();f.completed('unknown','This is not a proven final answer.');
 f.started('answer','','final_answer');f.delta('answer','Abandoned draft');
 f.completed('answer','','final_answer');
 const final=f.finish([f.item('answer','',null)]);
 assert.equal(final.finalText,'');assert(!final.text.includes('Abandoned draft'));assert.match(final.text,/not a proven final/);
});

test('null or absent later phases cannot erase known commentary or final classifications',()=>{
 const f=fixture();f.started('comment','','commentary');f.completed('comment','Never insert this narration.',null);
 f.started('answer','','final_answer');f.completed('answer','Keep this answer.',null);
 const final=f.finish([f.item('comment','Never insert this narration.'),f.item('answer','Keep this answer.',null)]);
 assert.equal(final.finalText,'Keep this answer.');
});

test('legacy models without phases retain the last nonempty unknown message as their answer',()=>{
 const f=fixture();f.completed('old-progress','Legacy preamble.');f.completed('old-answer','Legacy final answer.');f.completed('empty','');
 const final=f.finish();assert.equal(final.finalText,'Legacy final answer.');assert.match(final.text,/Legacy preamble/);
});

test('nullable phases use the same legacy compatibility rule without including known commentary',()=>{
 const f=fixture();f.completed('progress','Known progress.','commentary');f.completed('old-one','Earlier unknown.',null);f.completed('old-two','Latest unknown.',null);
 f.completed('later-progress','More known progress.','commentary');
 assert.equal(f.finish().finalText,'Latest unknown.');
});

test('commentary-only and tool-only turns never manufacture an insertable answer',()=>{
 const narration=fixture();narration.completed('comment','No final answer was produced.','commentary');
 assert.equal(narration.finish().finalText,'');
 const tools=fixture();tools.send('item/completed',{item:{id:'cmd',type:'commandExecution',command:'fixture-only',aggregatedOutput:'Tool output',status:'completed',exitCode:0}});
 const final=tools.finish();assert.equal(final.finalText,'');assert.equal(final.activity[0].output,'Tool output');
});

test('final extraction keeps exact text and does not guess content from prose or directive-looking strings',()=>{
 const f=fixture(),text='The literal text to preserve:\n::page-preview{title="example"}\n```js\nconsole.log("sample");\n```\n';
 f.completed('answer',text,'final_answer');assert.equal(f.finish().finalText,text);
});

test('direct note revisions remain authoritative and separate from the completion report',()=>{
 const f=fixture(),actual='Original note.\nRequested addition.',report='Updated your note file.';
 // Isolate output routing from the independently tested filesystem poller.
 f.c.pollNote=()=>{};f.c.disposeNote=()=>{};
 f.turn.note={direct:true,noteId:'note',baseRevision:3,text:actual,initialText:'Original note.',initialHash:'before',metadata:{hash:'after',bindingId:'binding'},sequence:1};
 f.completed('comment','Editing the authoritative note file.','commentary');f.completed('answer',report,'final_answer');
 const final=f.finish();assert.equal(final.noteEdit.text,actual);assert.equal(final.finalText,report);
 assert.equal(final.noteEditOutcome.status,'changed');assert.notEqual(final.noteEdit.text,final.finalText);
});

test('failed or interrupted turns retain their status along with final text for review',()=>{
 for(const status of ['failed','interrupted']){
  const f=fixture();f.completed('comment','Partial progress.','commentary');f.completed('answer','Partial answer for review.','final_answer');
  const final=f.finish([],status);assert.equal(final.status,status);assert.equal(final.finalText,'Partial answer for review.');
 }
});

function ownedFolder(t,prefix,beforeCleanup){
 const parent=fs.realpathSync(__dirname),folder=fs.mkdtempSync(path.join(parent,prefix));
 t.after(async()=>{if(beforeCleanup)await beforeCleanup();const target=path.resolve(folder);assert.equal(path.dirname(target),parent);assert(path.basename(target).startsWith(prefix));fs.rmSync(target,{recursive:true,force:true});});
 return folder;
}
function routingFixture(t){
 const folder=ownedFolder(t,'.note-output-host-',()=>c.close()),dataRoot=path.join(folder,'data'),project=path.join(folder,'project');
 fs.mkdirSync(path.join(dataRoot,'Conversations'),{recursive:true});fs.mkdirSync(project);
 const c=new Codex({dataRoot}),calls=[];c.cwd=path.join(dataRoot,'Conversations');c.start=async()=>{};c.requirements=async()=>{};
 c.models=[{model:'fixture',supportedReasoningEfforts:[{reasoningEffort:'low'}]}];
 c.rpc=async(method,params)=>{calls.push({method,params});return method==='turn/start'?{turn:{id:randomUUID()}}:{thread:{id:params.threadId||randomUUID()}};};
 const send=extra=>c.send({requestId:randomUUID(),text:'Write a short note.',project,model:'fixture',effort:'low',files:[],...extra});
 return {c,calls,folder,dataRoot,project,send};
}

test('new and cold-resumed threads receive the same local-notepad destination contract',async t=>{
 for(const oldThread of [undefined,'previously-opened-thread']){
  const f=routingFixture(t),result=await f.send({threadId:oldThread});
  const call=f.calls.find(x=>x.method===(oldThread?'thread/resume':'thread/start'));
  assert(call);assert.equal(call.params.threadId,oldThread);assert.equal(call.params.cwd,f.project);
  assert.match(call.params.developerInstructions,/local Windows notepad/i);
  assert.match(call.params.developerInstructions,/Unless the user explicitly names another destination/);
  assert.match(call.params.developerInstructions,/not ChatGPT Pages, Spaces or another cloud service/);
  assert.match(call.params.developerInstructions,/CURRENT turn.*authoritative-file grant/);
  if(oldThread)assert.equal(result.threadId,oldThread);
  f.c.finish(result.threadId,{status:'completed',items:[]});
 }
});

test('edit-off context exposes no current note content or file grant while retaining explicit project and cloud requests',async t=>{
 const f=routingFixture(t),privateText='PRIVATE_CURRENT_NOTE_19371',privateFile=path.join(f.dataRoot,'personal-note.txt');
 fs.writeFileSync(privateFile,privateText);
 const prompts=['Fix the code in the selected project.','Create a page in ChatGPT Pages with the title I supplied.'];
 for(const text of prompts){
  const result=await f.send({text}),turn=f.calls.filter(x=>x.method==='turn/start').at(-1).params;
  const context=turn.input.find(x=>x.type==='text'&&x.text.startsWith('[NOTES_WORKSPACE_CONTEXT]'));
  assert(context);assert.match(context.text,/editing the current local notepad is OFF/);
  assert.match(context.text,/There is no current note-file grant/);
  assert.match(context.text,/Explicit requests for named cloud destinations still use their normal tools and skills/);
  assert.match(context.text,/explicitly requested project, code and tool work remains available/);
  assert.equal(turn.input.at(-1).text,text);assert.deepEqual(turn.sandboxPolicy.writableRoots,[f.project]);
  const input=JSON.stringify(turn.input);assert(!input.includes(privateText));assert(!input.includes(JSON.stringify(privateFile).slice(1,-1)));
  assert(!input.includes('[NOTES_WORKSPACE_EDITABLE_NOTE]'));assert.equal(turn.config,undefined);
  f.c.finish(result.threadId,{status:'completed',items:[]});
 }
});

test('a later edit-off turn removes the previous note grant and mirror root while retaining the existing conversation',async t=>{
 const f=routingFixture(t),noteId=randomUUID(),noteText='SECRET_GRANTED_NOTE_7283';
 const first=await f.send({noteEdit:{noteId,text:noteText,revision:4}}),granted=f.c.turns.get(first.threadId).note;
 const file=granted.file,root=granted.root;
 const firstInput=f.calls.filter(x=>x.method==='turn/start').at(-1).params.input;
 assert(firstInput.some(x=>x.text?.startsWith('[NOTES_WORKSPACE_EDITABLE_NOTE]')));
 f.c.finish(first.threadId,{status:'completed',items:[]});
 const second=await f.send({threadId:first.threadId,text:'A new ordinary question.'}),turn=f.calls.filter(x=>x.method==='turn/start').at(-1).params;
 assert.equal(second.threadId,first.threadId);assert.equal(f.calls.filter(x=>x.method.startsWith('thread/')).length,1);
 assert.deepEqual(turn.runtimeWorkspaceRoots,[f.project]);assert.deepEqual(turn.sandboxPolicy.writableRoots,[f.project]);
 const input=JSON.stringify(turn.input);
 for(const value of [noteId,noteText,'[NOTES_WORKSPACE_EDITABLE_NOTE]',JSON.stringify(file).slice(1,-1),JSON.stringify(root).slice(1,-1)])assert(!input.includes(value));
 assert(turn.input.some(x=>x.text?.includes('There is no current note-file grant')));
 f.c.finish(second.threadId,{status:'completed',items:[]});
});

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){const start=Date.now();while(!predicate()){if(Date.now()-start>5000)throw Error('Timed out: '+label);await pause(20);}}
async function workerFixture(t,initial){
 let runtime,assistantId;
 const folder=ownedFolder(t,'.note-output-worker-',()=>runtime?.close()),dataFile=path.join(folder,'notes.json'),calls=[],latest=new Map();
 if(initial)fs.writeFileSync(dataFile,JSON.stringify(initial));
 const tab={id:1,windowId:1,url:ORIGIN+'/editor.html',active:true,mutedInfo:{muted:false},autoDiscardable:false};
 const windows={async get(id){return id===1?tab:null;},async list(){return [tab];},async create(){return tab;},async update(id,change){Object.assign(tab,change);return tab;},async remove(){},async openSettings(){},async save(){return 1;}};
 const native=async(action,data)=>{
  calls.push({action,data});
  if(action==='catalog')return {ok:true,defaultProject:folder,models:[{model:'fixture',isDefault:true,defaultReasoningEffort:'low',supportedReasoningEfforts:[{reasoningEffort:'low'}]}]};
  if(action==='send')return {ok:true,threadId:'fixture-thread',turnId:'fixture-turn'};
  if(action==='updates')return {ok:true,updates:data.ids.map(id=>latest.get(id)).filter(Boolean),missing:[]};
  return {ok:true};
 };
 const open=async()=>{
  runtime=createRuntime({uiRoot:path.join(__dirname,'..','extension'),dataFile,native,windows});
  await runtime.connect(1,message=>{void runtime.receive(1,{replyTo:message.requestId,result:{ok:true}});});
  const ready=await runtime.request('EDITOR_READY',{}, {id:1,url:tab.url});assert.equal(ready.ok,true,ready.error);assistantId=ready.assistant.id;
 };
 const request=(type,data={})=>runtime.request(type,{assistantId,...data},{id:1,url:tab.url});
 const assistant=()=>runtime.snapshot()['assistant:'+assistantId];
 await open();
 return {calls,latest,assistant,request,async reload(){await runtime.close();await open();},async completed(text,finalText){
  const revealed=await request('RESUME',{token:randomUUID(),mode:'quiet'});assert.equal(revealed.ok,true,revealed.error);
  const id=randomUUID(),sent=await request('AI_SEND',{id,text:'Write the requested note.',files:[]});assert.equal(sent.ok,true,sent.error);
  await until(()=>calls.some(x=>x.action==='send'&&x.data.requestId===id),'mock request submitted');
  latest.set(id,{requestId:id,threadId:'fixture-thread',status:'completed',at:Date.now(),text,finalText,activity:[],diff:'',plan:[],requests:[]});
  await until(()=>assistant().pending===null&&assistant().lastTurn?.requestId===id,'completed reply persisted');
  return id;
 }};
}

test('production state worker persists finalText separately and exactly across recovery reload',async t=>{
 const f=await workerFixture(t),text='Progress announcement.\n\nExact note content.\n',finalText='Exact note content.\n';
 const id=await f.completed(text,finalText),before=f.assistant().messages.find(m=>m.role==='assistant'&&m.requestId===id);
 assert.equal(before.text,text);assert.equal(before.finalText,finalText);assert.equal(before.mode,'quiet');
 await f.reload();const after=f.assistant().messages.find(m=>m.role==='assistant'&&m.requestId===id);
 assert.deepEqual(after,before);assert.equal(f.assistant().lastTurn.status,'completed');assert.equal(f.calls.filter(x=>x.action==='send').length,1);
});

test('an explicitly empty final remains empty in worker storage and recovery instead of falling back to narration',async t=>{
 const f=await workerFixture(t),text='Only progress narration; no final answer.';
 const id=await f.completed(text,''),before=f.assistant().messages.find(m=>m.role==='assistant'&&m.requestId===id);
 assert.equal(before.text,text);assert(Object.hasOwn(before,'finalText'));assert.equal(before.finalText,'');
 await f.reload();const after=f.assistant().messages.find(m=>m.role==='assistant'&&m.requestId===id);
 assert.equal(after.text,text);assert(Object.hasOwn(after,'finalText'));assert.equal(after.finalText,'');
 assert.equal(f.calls.filter(x=>x.action==='send').length,1);
});

function savedConsent(flags){
 const noteId=randomUUID(),assistantId=randomUUID();
 return {['note:'+noteId]:{id:noteId,text:'Existing personal note',html:'',revision:2},['assistant:'+assistantId]:{id:assistantId,agentVersion:4,noteId,messages:[],draft:'',pending:null,error:'',...flags},['noteAssistant:'+noteId]:assistantId,lastNoteId:noteId,lastAssistantId:assistantId};
}
test('legacy split editing choices migrate to one shared consent and persist through restart without submitting work',async t=>{
 const cases=[
  {name:'compact on and Reference off',flags:{quietEditNote:true,editNote:false},enabled:true},
  {name:'Reference on and compact off',flags:{quietEditNote:false,editNote:true},enabled:true},
  {name:'both on',flags:{quietEditNote:true,editNote:true},enabled:true},
  {name:'both off',flags:{quietEditNote:false,editNote:false},enabled:false},
  {name:'missing or nonboolean preferences',flags:{quietEditNote:'true'},enabled:false}
 ];
 for(const value of cases)await t.test(value.name,async t=>{
  const f=await workerFixture(t,savedConsent(value.flags));
  assert.equal(f.assistant().editNote,value.enabled);assert.equal(f.assistant().quietEditNote,value.enabled);
  await f.reload();assert.equal(f.assistant().editNote,value.enabled);assert.equal(f.assistant().quietEditNote,value.enabled);
  assert.equal(f.assistant().pending,null);assert.equal(f.calls.some(x=>['send','notePrepare'].includes(x.action)),false);
 });
});

test('turning a migrated compact consent off clears both saved aliases and cannot resurrect after restart',async t=>{
 const f=await workerFixture(t,savedConsent({quietEditNote:true,editNote:false}));
 assert.equal(f.assistant().editNote,true);assert.equal(f.assistant().quietEditNote,true);
 assert.equal((await f.request('RESUME',{token:randomUUID(),mode:'quiet'})).ok,true);
 assert.equal((await f.request('AI_QUIET_NOTE_EDIT_SET',{enabled:false})).ok,true);
 assert.equal(f.assistant().editNote,false);assert.equal(f.assistant().quietEditNote,false);
 await f.reload();assert.equal(f.assistant().editNote,false);assert.equal(f.assistant().quietEditNote,false);
 assert.equal(f.calls.some(x=>['send','notePrepare'].includes(x.action)),false);
});
