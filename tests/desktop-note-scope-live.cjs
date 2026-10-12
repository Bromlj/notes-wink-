'use strict';
// Real Codex: add an opted-in managed note outside an existing chat's project.
// Only disposable files are used. Additional access requests are never approved.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {Codex}=require('../native/host.cjs'),{createNoteFiles}=require('../desktop/note-files.cjs');
const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(__dirname,'desktop-note-scope-live-data-'));
const exe=process.env.NOTES_LIVE_CODEX||path.join(root,'desktop/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe');
const noteFiles=createNoteFiles({dataRoot:data}),host=new Codex({dataRoot:data,noteFiles,codexPath:exe,version:'5.3.1'}),events=new Map(),passed=[];
const initial='Scope check\n',marker='test-scope-'+randomUUID().slice(0,8),model='gpt-6.1-sol',effort='low';
host.on('update',event=>events.set(event.requestId,event));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(id){const start=Date.now();while(Date.now()-start<180000){const e=events.get(id);if(e?.requests?.length)throw Error('Unexpected additional access approval for opted-in note; no approval was accepted.');if(e&&e.status!=='working'){assert.equal(e.status,'completed',e.error||'Real turn did not complete');return e;}await pause(100);}throw Error('Real scoped note turn timed out.');}
const send=(text,extra={})=>host.send({requestId:randomUUID(),text,model,effort,files:[],...extra});
const check=(name,fn)=>{fn();passed.push(name);console.log('PASS '+name);};
(async()=>{let bound,threadId,outcome,lastResult;try{
 await host.start();await host.catalog();assert(host.models.some(m=>m.model===model&&m.supportedReasoningEfforts.some(e=>e.reasoningEffort===effort)),'Required real model/effort unavailable.');
 const seedId=randomUUID(),seed=await send('Reply with the single word ready. Do not use tools.',{requestId:seedId});threadId=seed.threadId;await wait(seedId);
 check('an existing real chat starts in the default Conversations workspace',()=>assert.equal(host.loaded.get(threadId),path.join(data,'Conversations')));
 bound=await noteFiles.ensure(randomUUID(),initial);
 check('the opted-in managed note is outside that workspace',()=>{assert.equal(bound.managed,true);assert(path.relative(path.join(data,'Conversations'),bound.path).startsWith('..'));});
 const requestId=randomUUID();await send('Append '+marker+' on a new line to my note. Make the actual file edit and verify it. Preserve existing text.',{requestId,threadId,noteEdit:{noteId:bound.noteId,bindingId:bound.bindingId,fileHash:bound.hash,text:bound.text,revision:0}});
 const result=lastResult=await wait(requestId);outcome=result.noteEditOutcome;
 check('the existing chat edits and verifies the outside-project note without additional approval',()=>{assert.equal(outcome?.status,'changed');assert.equal(outcome?.changed,true);const text=fs.readFileSync(bound.path,'utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');assert(text.startsWith(initial));assert.equal(text.slice(initial.length).trim(),marker);assert((result.activity||[]).some(i=>i.type==='commandExecution'||i.type==='fileChange'));});
 console.log(JSON.stringify({passed:passed.length,model,effort,approvalAccepted:false}));
}catch(error){console.error(error.stack);process.exitCode=1;}finally{host.close();fs.writeFileSync(path.join(__dirname,'desktop-note-scope-live-results.json'),JSON.stringify({date:new Date().toISOString(),passed,failed:!!process.exitCode,liveInference:true,model,effort,approvalAccepted:false,outcome,lastResult},null,2));}})().catch(error=>{console.error(error.stack);process.exitCode=1;host.close();});
