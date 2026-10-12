'use strict';
// Exercise the actual rich editor and guarded AI proposal handler in Chromium.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
async function main(){
 const browser=await chromium.launch({executablePath:process.env.NOTES_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage();
  const html=fs.readFileSync(path.join(root,'extension/editor.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
  await page.route('http://notes.test/**',route=>route.fulfill({contentType:'text/html',body:html}));await page.goto('http://notes.test/');
  await page.evaluate(()=>{
   globalThis.chrome={runtime:{id:'renderer-test'}};globalThis.noteListeners=[];globalThis.noteSavedDrafts=[];
   globalThis.NoteConnection={onMessage:fn=>noteListeners.push(fn),async request(type,{note}={}){if(type==='EDITOR_READY')return {note:{id:'note-test',text:'',revision:0},options:{}};if(type==='SAVE_NOTE'){noteSavedDrafts.push({...note});return {note:{...note,revision:note.revision+1}};}return {ok:true};}};
   globalThis.noteVisible=true;globalThis.noteMode='panel';globalThis.quietApplyRequest=null;globalThis.NotepadAssistant={visible:()=>noteVisible,mode:()=>noteMode,canApplyNote:()=>noteVisible&&noteMode==='panel',canApplyQuietNote:(id,requestId)=>id==='assistant-test'&&requestId===quietApplyRequest,owns:id=>id==='assistant-test',noteContext(){},working:()=>false,hide(){noteVisible=false;}};
   globalThis.noteMessage=m=>{let result;for(const fn of noteListeners)fn(m,{id:'renderer-test'},value=>{result=value;});return result;};
  });
  for(const file of ['core.js','rich-editor.js','editor.js'])await page.addScriptTag({path:path.join(root,'extension',file)});
  await page.waitForFunction(()=>globalThis.notepadReady);
  const results=await page.evaluate(async()=>{
   const editor=document.querySelector('#editor'),cases=[
    {label:'empty',html:'',text:''},
    {label:'plain',html:'',text:'Ordinary note'},
    {label:'multiline',html:'',text:'First line\nSecond line\n'},
    {label:'repeated blank lines',html:'',text:'First line\n\n\n'},
    {label:'leading whitespace',html:'',text:' \tFirst line\n'},
    {label:'heading',html:'<h1>Heading</h1><div>Body</div>'},
    {label:'list',html:'<ul><li>First</li><li>Second</li></ul>'},
    {label:'formatted raw newline',html:'<h1>Heading</h1><p><b>Body\n\n</b></p>'},
    {label:'table',html:'<table><tbody><tr><td>First</td><td>Second</td></tr></tbody></table>'},
    {label:'trailing paragraph',html:'<div>One</div><div><br></div>'},
    {label:'table and empty paragraph',html:'<table><tbody><tr><td>First</td><td>Second</td></tr></tbody></table><div><br></div>'}
   ],results=[];
   for(const item of cases)for(const suffix of ['test','\ntest',' test\n']){
    RichEditor.load(item.html,item.text||'');const text=editor.value,html=RichEditor.html();
    NotepadEditor.applyContext({note:{id:'note-test',text,html,revision:0}});
    const m={type:'NOTE_AI_PROPOSE',noteId:'note-test',assistantId:'assistant-test',editRequestId:'request-test',expectedText:text,expectedHtml:html,expectedRevision:0,text:text+suffix};
    const reply=noteMessage(m),after={text:editor.value,html:RichEditor.html()},result={label:item.label,suffix,reply,before:{text,html},after};
    if(reply?.accepted){
     noteMessage({type:'NOTE_AI_COMMITTED',noteId:m.noteId,editRequestId:m.editRequestId,text:m.text,html:RichEditor.html(),revision:1});
     editor.focus();document.execCommand('undo');result.nativeUndo={text:editor.value,html:RichEditor.html()};
     document.execCommand('redo');result.nativeRedo={text:editor.value,html:RichEditor.html()};
     await NotepadEditor.undoAI();result.aiUndo={text:editor.value,html:RichEditor.html()};
    }
    results.push(result);
   }
   noteMode='quiet';
   for(const variant of [{label:'quiet automatic proposal',reason:'quiet'},{label:'quiet missing transient guard',explicitQuiet:true,reason:'quiet'},{label:'quiet wrong request',explicitQuiet:true,guard:'different-request',reason:'quiet'},{label:'quiet whole replacement consent',explicitQuiet:true,confirmed:true,guard:'quiet-request',reason:'quiet'},{label:'quiet wrong assistant',explicitQuiet:true,assistantId:'other-assistant',guard:'quiet-request',reason:'quiet'}]){
    NotepadEditor.applyContext({note:{id:'note-test',text:'Keep quiet baseline',html:'',revision:0}});quietApplyRequest=variant.guard||null;
    const reply=noteMessage({type:'NOTE_AI_PROPOSE',noteId:'note-test',assistantId:variant.assistantId||'assistant-test',editRequestId:'quiet-request',expectedText:'Keep quiet baseline',expectedHtml:'',expectedRevision:0,text:'Unrequested replacement',explicitQuiet:variant.explicitQuiet,confirmed:variant.confirmed});
    results.push({guard:variant.label,expectedReason:variant.reason,reply,text:editor.value,expectedText:'Keep quiet baseline'});
   }
   for(const item of [{label:'explicit quiet formatted',html:'<h1>Heading</h1><p><b>Retain formatting</b></p>'},{label:'explicit quiet trailing empty block',html:'Ordinary private note<div><br></div>'}]){
    RichEditor.load(item.html,'');const text=editor.value,html=RichEditor.html();NotepadEditor.applyContext({note:{id:'note-test',text,html,revision:0}});quietApplyRequest='quiet-request';
    const suffix='\nQuiet revision',m={type:'NOTE_AI_PROPOSE',noteId:'note-test',assistantId:'assistant-test',editRequestId:'quiet-request',expectedText:text,expectedHtml:html,expectedRevision:0,text:text+suffix,explicitQuiet:true,confirmed:false};
    const reply=noteMessage(m),after={text:editor.value,html:RichEditor.html()},result={label:item.label,suffix,reply,before:{text,html},after};
    if(reply?.accepted){noteMessage({type:'NOTE_AI_COMMITTED',noteId:m.noteId,editRequestId:m.editRequestId,text:m.text,html:RichEditor.html(),revision:1,explicitQuiet:true});editor.focus();document.execCommand('undo');result.nativeUndo={text:editor.value,html:RichEditor.html()};document.execCommand('redo');result.nativeRedo={text:editor.value,html:RichEditor.html()};await NotepadEditor.undoAI();result.aiUndo={text:editor.value,html:RichEditor.html()};}
    results.push(result);
   }
   quietApplyRequest='quiet-request';noteMode='panel';NotepadEditor.applyContext({note:{id:'note-test',text:'Keep panel baseline',html:'',revision:0}});
   results.push({guard:'quiet grant in panel mode',expectedReason:'context_changed',reply:noteMessage({type:'NOTE_AI_PROPOSE',noteId:'note-test',assistantId:'assistant-test',editRequestId:'quiet-request',expectedText:'Keep panel baseline',expectedHtml:'',expectedRevision:0,text:'Wrong mode replacement',explicitQuiet:true}),text:editor.value,expectedText:'Keep panel baseline'});
   noteMode='quiet';quietApplyRequest=null;
   results.push({guard:'unrequested quiet file presentation',expectedReason:undefined,reply:noteMessage({type:'NOTE_FILE_PRESENTED',noteId:'note-test',assistantId:'assistant-test',editRequestId:'quiet-request',explicitQuiet:true,file:{noteId:'note-test'}}),text:editor.value,expectedText:'Keep panel baseline'});
   const rawFailure='Codex could not save this AI revision. Open Reference with Alt+W. File: C:\\Users\\Example\\AppData\\Local\\Packages\\OpenAI.Codex_fixture\\LocalCache\\NotesWorkspace\\note.txt';
   for(const scenario of ['hidden delayed failure','quiet delayed failure','visible failure then Alt+Q']){
    noteMode='panel';noteVisible=true;quietApplyRequest=null;
    const before='Keep the recoverable fixture note',after=before+'\nA completed revision';NotepadEditor.applyContext({note:{id:'note-test',text:before,html:'',revision:0}});
    const proposal=noteMessage({type:'NOTE_AI_PROPOSE',noteId:'note-test',assistantId:'assistant-test',editRequestId:'feedback-'+scenario,expectedText:before,expectedHtml:'',expectedRevision:0,text:after});
    const failure={type:'NOTE_AI_FAILED',noteId:'note-test',editRequestId:'feedback-'+scenario,error:rawFailure,revision:0};let visibleDetails;
    if(scenario==='visible failure then Alt+Q'){
     noteMessage(failure);visibleDetails=document.querySelector('#error').textContent;
     document.dispatchEvent(new KeyboardEvent('keydown',{key:'q',code:'KeyQ',altKey:true,bubbles:true}));
    }else{
     if(scenario==='hidden delayed failure'){noteVisible=false;NotepadEditor.concealAIError();}else noteMode='quiet';
     noteMessage(failure);
    }
    const banner={text:document.querySelector('#error').textContent,hidden:document.querySelector('#error').hidden},retained=editor.value;
    await NotepadEditor.flush();
    results.push({feedback:scenario,accepted:proposal?.accepted,banner,retained,expectedText:after,saved:noteSavedDrafts.at(-1)?.text,visibleDetails,rawFailure});
   }
   noteMode='panel';noteVisible=false;
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',code:'KeyP',ctrlKey:true,bubbles:true}));
   const ordinaryError={text:document.querySelector('#error').textContent,hidden:document.querySelector('#error').hidden};NotepadEditor.concealAIError();
   results.push({feedback:'ordinary editor warning survives hiding',before:ordinaryError,after:{text:document.querySelector('#error').textContent,hidden:document.querySelector('#error').hidden}});
   const legacyBanner=document.querySelector('#error');legacyBanner.textContent='ChatGPT sign-in failed. Open the Reference sidebar to reconnect.';legacyBanner.hidden=false;NotepadEditor.concealAIError();
   results.push({feedback:'external account banner is cleared when hiding',banner:{text:legacyBanner.textContent,hidden:legacyBanner.hidden}});
   noteMode='panel';quietApplyRequest=null;
   noteVisible=true;
   const baseline={id:'note-test',text:'Keep my note\n',html:'',revision:0};NotepadEditor.applyContext({note:baseline});
   const m={type:'NOTE_AI_PROPOSE',noteId:baseline.id,assistantId:'assistant-test',editRequestId:'guard-test',expectedText:baseline.text,expectedHtml:'',expectedRevision:0,text:'Replacement'};
   noteVisible=false;results.push({guard:'hidden',reply:noteMessage(m),text:editor.value});noteVisible=true;
   editor.value='Manual edit';editor.dispatchEvent(new Event('input',{bubbles:true}));results.push({guard:'dirty',reply:noteMessage(m),text:editor.value});
   return results;
  });
  for(const result of results){
   if(result.feedback){
    if(result.feedback==='ordinary editor warning survives hiding'){assert.equal(result.before.hidden,false);assert.match(result.before.text,/Save as/);assert.deepEqual(result.after,result.before);}
    else if(result.feedback==='external account banner is cleared when hiding'){assert.deepEqual(result.banner,{text:'',hidden:true});}
    else{assert.equal(result.accepted,true);assert.equal(result.retained,result.expectedText);assert.equal(result.saved,result.expectedText);assert.equal(result.banner.hidden,false);assert.match(result.banner.text,/file update could not be saved/i);assert.doesNotMatch(result.banner.text,/\b(?:codex|chatgpt|openai|AI|Reference)\b|Alt\+W|C:\\|Packages/i);if(result.feedback==='visible failure then Alt+Q')assert.equal(result.visibleDetails,result.rawFailure);}
    console.log('PASS '+result.feedback+' preserves the note and discreet failure feedback');continue;
   }
   if(result.guard){assert.equal(result.reply?.accepted,false);assert.equal(result.reply?.reason,Object.hasOwn(result,'expectedReason')?result.expectedReason:result.guard==='hidden'?'hidden':'local_changes');assert.equal(result.text,result.expectedText??(result.guard==='hidden'?'Keep my note\n':'Manual edit'));console.log('PASS '+result.guard+' note refuses automatic revision');continue;}
   assert.equal(result.reply?.accepted,true,result.label+' append '+JSON.stringify(result.suffix)+' '+JSON.stringify(result));
   assert.equal(result.after.text,result.before.text+result.suffix);assert.deepEqual(result.nativeUndo,result.before,result.label+' native Undo');assert.deepEqual(result.nativeRedo,result.after,result.label+' native Redo');assert.deepEqual(result.aiUndo,result.before,result.label+' AI Undo');
   if(result.label==='formatted raw newline')assert.match(result.after.html,/^<h1>Heading<\/h1><p><b>/);
   console.log('PASS '+result.label+' append '+JSON.stringify(result.suffix)+' with native Undo/Redo and AI Undo');
  }
  console.log(results.length+' guarded automatic note edit checks passed');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
