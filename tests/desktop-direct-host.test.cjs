'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const {Codex}=require('../native/host.cjs'),{createNoteFiles}=require('../desktop/note-files.cjs');
function fixture(t){const dataRoot=fs.mkdtempSync(path.join(__dirname,'direct-host-data-')),project=path.join(dataRoot,'project');fs.mkdirSync(project);fs.mkdirSync(path.join(dataRoot,'Conversations'));const noteFiles=createNoteFiles({dataRoot}),host=new Codex({dataRoot,noteFiles}),calls=[],events=[];host.cwd=path.join(dataRoot,'Conversations');host.start=async()=>{};host.requirements=async()=>{};host.models=[{model:'actual-model',supportedReasoningEfforts:[{reasoningEffort:'low'}]}];host.rpc=async(method,params)=>{calls.push({method,params});return method==='turn/start'?{turn:{id:randomUUID()}}:{thread:{id:randomUUID()}};};host.on('update',e=>events.push(e));t.after(()=>host.close());return {dataRoot,project,noteFiles,host,calls,events,send:extra=>host.send({requestId:randomUUID(),text:'Edit the actual bound note.',model:'actual-model',effort:'low',project,files:[],...extra})};}
const descriptor=(metadata,revision=3)=>({noteId:metadata.noteId,bindingId:metadata.bindingId,fileHash:metadata.hash,text:metadata.text,revision});

test('direct host edits the persistent actual file and preserves it through completion and the next turn',async t=>{
 const f=fixture(t),noteId=randomUUID(),bound=await f.noteFiles.ensure(noteId,'Initial actual note'),first=await f.send({noteEdit:descriptor(bound)}),turn=f.host.turns.get(first.threadId);assert.equal(turn.note.direct,true);assert.equal(turn.note.file,bound.path);assert.deepEqual(f.calls.find(c=>c.method==='turn/start').params.sandboxPolicy.writableRoots,[f.project,path.dirname(bound.path)]);
 fs.writeFileSync(bound.path,'\uFEFFActual first line\r\nActual second line\r\n');f.host.pollNote(first.threadId,turn);const update=f.events.at(-1);assert.equal(update.noteEdit.text,'Actual first line\nActual second line\n');assert.equal(update.noteEdit.file.path,bound.path);assert.equal(update.noteEdit.file.bindingId,bound.bindingId);assert.equal(update.noteEdit.file.hash,createHash('sha256').update(fs.readFileSync(bound.path)).digest('hex'));
 f.host.finish(first.threadId,{status:'completed',items:[]});assert.equal(fs.existsSync(bound.path),true);assert.equal(turn.note.closed,true);const current=await f.noteFiles.status(noteId);await f.send({threadId:first.threadId,noteEdit:descriptor(current,4)});assert.equal(f.host.turns.get(first.threadId).note.file,bound.path);assert.equal(fs.existsSync(path.join(f.dataRoot,'NoteWork')),false);
});

test('an actual picked project file keeps the project root and survives Stop and host close',async t=>{
 const f=fixture(t),file=path.join(f.project,'opened.txt');fs.writeFileSync(file,'Actual picked note');const bound=await f.noteFiles.bind(randomUUID(),await f.noteFiles.open(file)),started=await f.send({noteEdit:descriptor(bound)}),turn=f.host.turns.get(started.threadId);assert.equal(turn.note.file,file);assert.deepEqual(f.calls.find(c=>c.method==='turn/start').params.runtimeWorkspaceRoots,[f.project]);fs.writeFileSync(file,'Accepted actual disk progress');await f.host.stop(started.threadId,turn.requestId);assert.equal(fs.readFileSync(file,'utf8'),'Accepted actual disk progress');assert.equal(turn.note.closed,true);f.host.close();assert.equal(fs.existsSync(file),true);
});

test('missing actual file grants fail before a turn and cannot fall back to a disposable mirror',async t=>{
 const f=fixture(t),bound=await f.noteFiles.ensure(randomUUID(),'Keep actual file');fs.renameSync(bound.path,bound.path+'.moved');await assert.rejects(f.send({noteEdit:descriptor(bound)}),error=>error.code==='NOTE_FILE_MISSING');assert.equal(f.calls.filter(c=>c.method==='turn/start').length,0);assert.equal(fs.existsSync(bound.path),false);assert.equal(fs.readFileSync(bound.path+'.moved','utf8'),'Keep actual file');assert.equal(fs.existsSync(path.join(f.dataRoot,'NoteWork')),false);
});

test('a completed direct-note task with no file changes reports an explicit unchanged outcome',async t=>{
 const f=fixture(t),bound=await f.noteFiles.ensure(randomUUID(),'Original note'),started=await f.send({noteEdit:descriptor(bound)}),turn=f.host.turns.get(started.threadId);
 const input=f.calls.find(c=>c.method==='turn/start').params.input[0].text;assert.match(input,/For a small note-only edit/);assert.match(input,/folder containing this document is included among the writable roots/);assert.match(input,/Verify the requested change in this authoritative file/);
 f.host.finish(started.threadId,{status:'completed',items:[{id:'answer',type:'agentMessage',text:'A reply that did not edit the file.'}]});
 const final=f.events.at(-1);assert.equal(final.status,'completed');assert.equal(final.noteEdit,undefined);assert.deepEqual(final.noteEditOutcome,{requestId:turn.requestId,noteId:bound.noteId,baseRevision:3,status:'unchanged',changed:false,sequence:0});assert.equal(fs.readFileSync(bound.path,'utf8'),'Original note');
});

test('direct-note completion checks final bytes, including byte-only edits and a reverted change',async t=>{
 const f=fixture(t),bound=await f.noteFiles.ensure(randomUUID(),'Original note'),first=await f.send({noteEdit:descriptor(bound)});
 fs.writeFileSync(bound.path,'\uFEFFOriginal note');f.host.finish(first.threadId,{status:'completed'});assert.equal(f.events.at(-1).noteEditOutcome.status,'changed');assert.equal(f.events.at(-1).noteEditOutcome.changed,true);assert.equal(f.events.at(-1).noteEdit.text,bound.text);
 const current=await f.noteFiles.status(bound.noteId),second=await f.send({threadId:first.threadId,noteEdit:descriptor(current,4)}),turn=f.host.turns.get(second.threadId);
 fs.writeFileSync(bound.path,'Temporary revision');f.host.pollNote(second.threadId,turn);fs.writeFileSync(bound.path,'\uFEFFOriginal note');f.host.finish(second.threadId,{status:'completed'});
 const outcome=f.events.at(-1).noteEditOutcome;assert.equal(outcome.status,'unchanged');assert.equal(outcome.changed,false);assert.equal(outcome.sequence,2);assert.equal(outcome.baseRevision,4);
});

test('a failed task reports its partial actual file change without describing it as success',async t=>{
 const f=fixture(t),bound=await f.noteFiles.ensure(randomUUID(),'Original note'),started=await f.send({noteEdit:descriptor(bound)});
 fs.writeFileSync(bound.path,'Partly revised');f.host.finish(started.threadId,{status:'failed',error:{message:'The model connection failed.'}});
 const final=f.events.at(-1);assert.equal(final.status,'failed');assert.equal(final.noteEditOutcome.status,'error');assert.equal(final.noteEditOutcome.changed,true);assert.equal(final.noteEditOutcome.error,'The model connection failed.');assert.equal(fs.readFileSync(bound.path,'utf8'),'Partly revised');
});

test('an unreadable final document reports an error even if the model turn completed',async t=>{
 const f=fixture(t),bound=await f.noteFiles.ensure(randomUUID(),'Original note'),started=await f.send({noteEdit:descriptor(bound)});fs.renameSync(bound.path,bound.path+'.moved');
 f.host.finish(started.threadId,{status:'completed'});const final=f.events.at(-1);assert.equal(final.status,'completed');assert.equal(final.noteEditOutcome.status,'error');assert.match(final.noteEditOutcome.error,/moved, renamed or deleted/);assert.equal(final.noteEditOutcome.sequence,0);assert.equal(final.noteEdit,undefined);assert.equal(fs.existsSync(bound.path),false);assert.equal(fs.readFileSync(bound.path+'.moved','utf8'),'Original note');
});
