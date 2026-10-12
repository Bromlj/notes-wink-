'use strict';
// A real Codex turn edits only a disposable linked note. The actual installed
// Notes Workspace profile is not opened, and no approval is auto-accepted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(__dirname,'..'),EXE=process.env.NOTES_DESKTOP_EXE||path.join(ROOT,'desktop/dist/Notes Workspace/Notes Workspace.exe');
const data=fs.mkdtempSync(path.join(__dirname,'desktop-note-append-live-data-')),project=path.join(data,'project'),noteFile=path.join(project,'actual-note.txt');
const original='First line\nSecond line\n',prompt='Append the word test to the end of this note. Make the actual file edit, preserve existing text, and verify it.';
fs.mkdirSync(project);fs.writeFileSync(noteFile,original);
const passed=[],errors=[],timing={submittedAt:null,firstDiskEditMs:null,firstVisibleEditMs:null,totalTurnMs:null};
let application,page,selectedModel='gpt-6.1-sol',selectedEffort='low',originalHtml,noteId,assistantId,finalText,outcome;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const store=()=>JSON.parse(fs.readFileSync(path.join(data,'notes.json'),'utf8'));
const state=()=>page.evaluate(async()=>(await NoteConnection.request('AI_READY')).assistant);
const normal=()=>fs.readFileSync(noteFile,'utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
async function until(fn,label,timeout=180000){const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await pause(80);}throw Error('Timed out: '+label);}
const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS '+name);};
async function chooseOpen(target){await application.evaluate(({dialog},target)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[target]});},target);}
async function observe(){
  const disk=normal(),visible=await page.locator('#editor').evaluate(e=>e.value);
  if(disk!==original&&timing.firstDiskEditMs===null)timing.firstDiskEditMs=Date.now()-timing.submittedAt;
  if(visible!==original&&timing.firstVisibleEditMs===null)timing.firstVisibleEditMs=Date.now()-timing.submittedAt;
  assert.equal(await page.locator('#assistant-panel').isVisible(),true,'The Reference panel must remain visible for this reproduction.');
  assert.equal(await page.locator('#note-apply-dialog').isVisible(),false,'An automatic note append must not require an Apply dialog.');
  const current=await state();
  if(current.pending?.requests?.length)throw Error('The live append requested additional access; this test does not grant it.');
  if(current.error)throw Error(current.error);
  return {disk,visible,current};
}
(async()=>{try{
  const env={...process.env,NOTES_DESKTOP_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NOTES_FIXTURE_SIGNED_OUT;
  if(process.env.NOTES_LIVE_CODEX)env.NOTES_CODEX=process.env.NOTES_LIVE_CODEX;else delete env.NOTES_CODEX;
  application=await _electron.launch({executablePath:EXE,args:[],env,timeout:45000});page=await application.firstWindow();page.setDefaultTimeout(18000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.notepadReady);
  await chooseOpen(noteFile);await page.locator('#editor').press('Control+o');await page.waitForFunction(text=>document.querySelector('#editor').value===text,original);
  await page.evaluate(()=>NotepadEditor.flush());originalHtml=await page.evaluate(()=>RichEditor.html());
  await page.locator('#editor').press('Alt+w');await page.waitForFunction(()=>!document.querySelector('#assistant-panel').hidden&&!document.querySelector('#assistant-send').disabled,{},{timeout:80000});
  await chooseOpen(project);await page.locator('#assistant-project-browse').click();await page.waitForFunction(p=>document.querySelector('#assistant-project').value===p&&!document.querySelector('#assistant-send').disabled,project);
  if(await page.locator('#assistant-settings').isHidden())await page.locator('#assistant-options').click();
  const models=await page.locator('#assistant-model option').evaluateAll(es=>es.map(e=>e.value));assert(models.includes(selectedModel),'The live account must offer '+selectedModel+'; do not substitute another model.');
  await page.locator('#assistant-model').selectOption(selectedModel);await page.waitForFunction(()=>!document.querySelector('#assistant-model').disabled);
  const efforts=await page.locator('#assistant-thinking option').evaluateAll(es=>es.map(e=>e.value));assert(efforts.includes(selectedEffort),'The selected model must offer low thinking.');
  await page.locator('#assistant-thinking').selectOption(selectedEffort);await page.waitForFunction(()=>!document.querySelector('#assistant-thinking').disabled);
  await until(()=>store().codexSelection?.model===selectedModel&&store().codexSelection?.effort===selectedEffort,'explicit model and effort selection',15000);
  await page.locator('#assistant-edit-note').check();await until(async()=>(await state()).editNote===true,'direct note-edit opt-in',15000);
  const ready=await state();noteId=ready.noteId;assistantId=ready.id;
  await check('the visible live append uses gpt-6.1-sol/low and an opted-in actual disposable note',async()=>{
    assert.equal(ready.project,project);assert.equal((await page.evaluate(()=>NotepadEditor.file())).path,path.resolve(noteFile));assert.equal(normal(),original);assert.equal(store()['note:'+noteId].text,original);assert.equal(await page.evaluate(()=>RichEditor.html()),originalHtml);
  });
  await page.locator('#assistant-question').fill(prompt);timing.submittedAt=Date.now();await page.locator('#assistant-question').press('Enter');
  await until(async()=>{const observed=await observe();if(observed.current.pending){assert.equal(observed.current.pending.model,selectedModel);assert.equal(observed.current.pending.effort,selectedEffort);return true;}return !!observed.current.noteEditOutcome;},'accepted live append',15000);
  await until(async()=>{const {current}=await observe();if(current.pending)return false;timing.totalTurnMs=Date.now()-timing.submittedAt;outcome=current.noteEditOutcome;return true;},'real visible append completion');
  await until(async()=>{const {disk,visible,current}=await observe(),canonical=store()['note:'+noteId];return disk!==original&&visible===disk&&canonical.text===disk&&(!current.noteEditStage||current.noteEditStage.appliedRevision!=null);},'automatic visible and recovery note convergence',15000);
  finalText=normal();const completed=await state();
  await check('real Codex appends test without losing either original line and verifies the actual file',async()=>{
    assert(finalText.startsWith(original),'The actual file must retain all original text.');assert.match(finalText.slice(original.length),/^test\n?$/);assert.equal(await page.locator('#editor').evaluate(e=>e.value),finalText);assert.equal(store()['note:'+noteId].text,finalText);
    assert.equal(outcome?.status,'changed');assert.equal(outcome?.changed,true);assert.equal(outcome?.noteId,noteId);assert.equal(completed.pending,null);assert(!completed.noteFileError,completed.noteFileError||'');assert((completed.activity||[]).some(item=>item.type==='commandExecution'),'The requested verification must use an actual command.');
    assert.notEqual(timing.firstDiskEditMs,null);assert.notEqual(timing.firstVisibleEditMs,null);assert.notEqual(timing.totalTurnMs,null);
  });
  await check('the visible append needs no Apply step and leaves no unapplied revision or formatting conflict',async()=>{
    assert.equal(await page.locator('#note-apply-dialog').isVisible(),false);assert.equal(await page.locator('#assistant-note-apply').isVisible(),false);assert(!completed.noteEditStage||completed.noteEditStage.appliedRevision!=null);assert.equal(!!completed.noteEditStage?.conflict,false);assert.equal(!!completed.noteEditStage?.requiresApply,false);assert.doesNotMatch(await page.locator('#assistant-note-edit-status').textContent(),/formatting|needs review|revision is waiting/i);assert.equal(await page.locator('#assistant-note-undo').isEnabled(),true);
  });
  await page.locator('#assistant-note-undo').click();await page.waitForFunction(text=>document.querySelector('#editor').value===text,original);await until(()=>normal()===original&&store()['note:'+noteId].text===original,'actual file and recovery Undo',15000);
  await check('guarded Undo restores the original disk text and rich note exactly',async()=>{
    assert.equal(normal(),original);assert.equal(await page.evaluate(()=>RichEditor.html()),originalHtml);assert.equal(store()['note:'+noteId].html,originalHtml);assert.equal(await page.locator('#editor').evaluate(e=>e.value),original);assert.equal(await page.locator('#assistant-panel').isVisible(),true);
  });
  await check('the visible live append and rich Undo produce no renderer exceptions',async()=>assert.deepEqual(errors,[]));
  console.log('TIMING '+JSON.stringify({selectedModel,selectedEffort,...timing}));
}catch(error){console.error(error.stack);if(page&&!page.isClosed()){console.error('STATUS',await page.locator('#assistant-status').textContent().catch(()=>''));console.error('NOTE STATUS',await page.locator('#assistant-note-edit-status').textContent().catch(()=>''));console.error('FILE STATUS',await page.locator('#file-status').textContent().catch(()=>''));await page.screenshot({path:path.join(ROOT,'docs/desktop-note-append-live-failure.png')}).catch(()=>{});}process.exitCode=1;}
finally{await application?.close();fs.writeFileSync(path.join(__dirname,'desktop-note-append-live-results.json'),JSON.stringify({date:new Date().toISOString(),executable:EXE,data,project,noteId,assistantId,liveInference:true,selectedModel,selectedEffort,prompt,timing,outcome,passed,errors,failed:!!process.exitCode,scope:'One real Codex gpt-6.1-sol/low append with the panel continuously visible, automatic disk/visible/recovery convergence, no pending Apply, and exact rich Undo in a disposable app profile and project; no approvals accepted.'},null,2));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
