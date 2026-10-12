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
   globalThis.chrome={runtime:{id:'renderer-test'}};globalThis.noteListeners=[];
   globalThis.NoteConnection={onMessage:fn=>noteListeners.push(fn),async request(type,{note}={}){if(type==='EDITOR_READY')return {note:{id:'note-test',text:'',revision:0},options:{}};if(type==='SAVE_NOTE')return {note:{...note,revision:note.revision+1}};return {ok:true};}};
   globalThis.noteVisible=true;globalThis.NotepadAssistant={visible:()=>noteVisible,owns:id=>id==='assistant-test',noteContext(){},working:()=>false};
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
   const baseline={id:'note-test',text:'Keep my note\n',html:'',revision:0};NotepadEditor.applyContext({note:baseline});
   const m={type:'NOTE_AI_PROPOSE',noteId:baseline.id,assistantId:'assistant-test',editRequestId:'guard-test',expectedText:baseline.text,expectedHtml:'',expectedRevision:0,text:'Replacement'};
   noteVisible=false;results.push({guard:'hidden',reply:noteMessage(m),text:editor.value});noteVisible=true;
   editor.value='Manual edit';editor.dispatchEvent(new Event('input',{bubbles:true}));results.push({guard:'dirty',reply:noteMessage(m),text:editor.value});
   return results;
  });
  for(const result of results){
   if(result.guard){assert.equal(result.reply?.reason,result.guard==='hidden'?'hidden':'local_changes');assert.equal(result.text,result.guard==='hidden'?'Keep my note\n':'Manual edit');console.log('PASS '+result.guard+' note refuses automatic revision');continue;}
   assert.equal(result.reply?.accepted,true,result.label+' append '+JSON.stringify(result.suffix)+' '+JSON.stringify(result));
   assert.equal(result.after.text,result.before.text+result.suffix);assert.deepEqual(result.nativeUndo,result.before,result.label+' native Undo');assert.deepEqual(result.nativeRedo,result.after,result.label+' native Redo');assert.deepEqual(result.aiUndo,result.before,result.label+' AI Undo');
   if(result.label==='formatted raw newline')assert.match(result.after.html,/^<h1>Heading<\/h1><p><b>/);
   console.log('PASS '+result.label+' append '+JSON.stringify(result.suffix)+' with native Undo/Redo and AI Undo');
  }
  console.log(results.length+' guarded automatic note edit checks passed');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
