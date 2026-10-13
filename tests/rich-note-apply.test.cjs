'use strict';
// Synthetic rich-note regressions. Never reads the installed profile or notes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
async function main(){
 const browser=await chromium.launch({executablePath:process.env.NOTES_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage(),html=fs.readFileSync(path.join(root,'extension/editor.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
  await page.route('http://notes.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://notes.test/');
  await page.evaluate(()=>{
   globalThis.chrome={runtime:{id:'rich-note-test'}};globalThis.richNoteListeners=[];globalThis.richNoteMode='panel';globalThis.richNoteVisible=true;globalThis.richNoteRequest=null;
   globalThis.NoteConnection={onMessage:fn=>richNoteListeners.push(fn),async request(type,{note}={}){if(type==='EDITOR_READY')return {note:{id:'synthetic-rich-note',text:'',revision:0},options:{}};if(type==='SAVE_NOTE')return {note:{...note,revision:note.revision+1}};return {ok:true};}};
   globalThis.NotepadAssistant={visible:()=>richNoteVisible,mode:()=>richNoteMode,canApplyNote:()=>richNoteVisible&&richNoteMode==='panel',canApplyQuietNote:(id,requestId)=>id==='synthetic-assistant'&&requestId===richNoteRequest,owns:id=>id==='synthetic-assistant',noteContext(){},working:()=>false};
   globalThis.richNoteMessage=m=>{let result;for(const fn of richNoteListeners)fn(m,{id:'rich-note-test'},v=>result=v);return result;};
  });
  for(const file of ['core.js','rich-editor.js','editor.js'])await page.addScriptTag({path:path.join(root,'extension',file)});await page.waitForFunction(()=>globalThis.notepadReady);
  const results=await page.evaluate(async()=>{
   const editor=document.getElementById('editor'),fixtures=[
    {name:'empty',html:'',text:''},
    {name:'raw trailing newline',html:'',text:'Alpha\nBeta\n'},
    {name:'paragraph and trailing blank',html:'<div>Alpha</div><div><br></div><div><br></div>'},
    {name:'heading and styled paragraph',html:'<h1>Alpha</h1><p><b>Beta</b></p>'},
    {name:'pre and code',html:'<pre><code>Alpha\nBeta\n\n</code></pre>'},
    {name:'list',html:'<ul><li><b>Alpha</b></li><li>Beta</li></ul>'},
    {name:'link',html:'<p><a href="https://example.com/">Alpha</a> <i>Beta</i></p>'},
    {name:'table and trailing blank',html:'<table><tbody><tr><td><b>Alpha</b></td><td>Beta</td></tr><tr><td>Gamma</td><td>Delta</td></tr></tbody></table><div><br></div>'}
   ],results=[];
   for(const fixture of fixtures)for(const kind of ['append','edit','replace','confirmed replacement','empty replacement'])for(const mode of ['panel','quiet']){
    if(mode==='quiet'&&kind==='confirmed replacement')continue;
    RichEditor.load(fixture.html,fixture.text||'');const before={text:editor.value,html:RichEditor.html()};
    const next=kind==='append'?before.text+'\nAdded 😀 line\n':kind==='edit'?before.text.replace('Alpha','Revised Alpha'):kind==='empty replacement'?'':'New 😀 line\nSecond line\n';
    if(next===before.text)continue;
    NotepadEditor.applyContext({note:{id:'synthetic-rich-note',...before,revision:0}});richNoteMode=mode;richNoteVisible=true;richNoteRequest='synthetic-request';
    const proposal={type:'NOTE_AI_PROPOSE',noteId:'synthetic-rich-note',assistantId:'synthetic-assistant',editRequestId:'synthetic-request',expectedText:before.text,expectedHtml:before.html,expectedRevision:0,text:next,...(mode==='quiet'?{explicitQuiet:true}:{}),...(kind==='confirmed replacement'?{confirmed:true}:{})};
    const reply=richNoteMessage(proposal),after={text:editor.value,html:RichEditor.html()},result={name:fixture.name,kind,mode,reply,before,after,next};
    if(reply?.accepted){
     richNoteMessage({type:'NOTE_AI_COMMITTED',noteId:proposal.noteId,editRequestId:proposal.editRequestId,text:next,html:after.html,revision:1});
     editor.focus();document.execCommand('undo');result.undo={text:editor.value,html:RichEditor.html()};
     document.execCommand('redo');result.redo={text:editor.value,html:RichEditor.html()};
     await NotepadEditor.undoAI();result.aiUndo={text:editor.value,html:RichEditor.html()};
    }
    results.push(result);
   }
   // Local edits and concealment remain authoritative even for the new rich path.
   richNoteMode='quiet';richNoteVisible=true;richNoteRequest='synthetic-request';
   const baseline={id:'synthetic-rich-note',text:'Preserve this note',html:'',revision:0},proposal={type:'NOTE_AI_PROPOSE',noteId:baseline.id,assistantId:'synthetic-assistant',editRequestId:'synthetic-request',expectedText:baseline.text,expectedHtml:'',expectedRevision:0,text:'Changed note',explicitQuiet:true};
   NotepadEditor.applyContext({note:baseline});richNoteVisible=false;results.push({guard:'hidden',reply:richNoteMessage(proposal),text:editor.value,expected:baseline.text});richNoteVisible=true;
   editor.value='Keep local typing';editor.dispatchEvent(new Event('input',{bubbles:true}));results.push({guard:'local_changes',reply:richNoteMessage(proposal),text:editor.value,expected:'Keep local typing'});
   return results;
  });
  const failures=[];
  for(const r of results){try{
   if(r.guard){assert.equal(r.reply?.accepted,false);assert.equal(r.reply?.reason,r.guard);assert.equal(r.text,r.expected);console.log('PASS '+r.guard+' guard retains local text');continue;}
   const label=[r.name,r.kind,r.mode].join(' · ');assert.equal(r.reply?.accepted,true,label+' '+JSON.stringify(r.reply));assert.equal(r.after.text,r.next,label+' exact text');
   assert.deepEqual(r.undo,r.before,label+' native Undo');assert.deepEqual(r.redo,r.after,label+' native Redo');assert.deepEqual(r.aiUndo,r.before,label+' AI Undo');
   if(['append','edit'].includes(r.kind)&&r.name==='heading and styled paragraph')assert.match(r.after.html,/<h1>[\s\S]*<\/h1><p><b>Beta<\/b>/,label+' retains unchanged rich blocks');
   if(['append','edit'].includes(r.kind)&&r.name==='link')assert.match(r.after.html,/<a href="https:\/\/example.com\/">/,label+' retains link');
   if(['append','edit'].includes(r.kind)&&r.name==='table and trailing blank')assert.match(r.after.html,/<table>[\s\S]*<td>Delta<\/td>/,label+' retains cells');
   console.log('PASS '+label+' exact revision with formatting and native/AI Undo');
  }catch(e){failures.push(e.message);console.error('FAIL '+e.message);}}
  assert.deepEqual(failures,[],failures.length+' rich-note checks failed');console.log(results.length+' rich note apply checks passed');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
