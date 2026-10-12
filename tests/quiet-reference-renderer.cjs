'use strict';
// Exercise explicit quiet-reply insertion in the real rich editor, without
// Codex, credentials, a native file picker or any personal document.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
async function main(){
 const browser=await chromium.launch({executablePath:process.env.NOTES_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage(),html=fs.readFileSync(path.join(root,'extension/editor.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
  await page.route('http://notes.test/**',route=>route.fulfill({contentType:'text/html',body:html}));await page.goto('http://notes.test/');
  await page.evaluate(()=>{
   globalThis.chrome={runtime:{id:'quiet-renderer-test'}};globalThis.noteListeners=[];globalThis.saved=[];globalThis.saveFailure='';globalThis.saveFileError='';globalThis.saveGate=null;
   globalThis.NoteConnection={onMessage:fn=>noteListeners.push(fn),async request(type,{note}={}){
    if(type==='EDITOR_READY')return {note:{id:'note-test',text:'',revision:0},options:{}};
    if(type==='SAVE_NOTE'){if(saveGate)await saveGate;if(saveFailure){const message=saveFailure;saveFailure='';throw Error(message);}saved.push({...note});return {note:{...note,revision:note.revision+1},...(saveFileError?{fileError:saveFileError}:{})};}
    return {ok:true};
   }};
   globalThis.noteVisible=true;globalThis.noteMode='quiet';globalThis.notePending=false;globalThis.noteToken='quiet-token';
   globalThis.NotepadAssistant={visible:()=>noteVisible,mode:()=>noteMode,canApplyNote:()=>noteVisible&&noteMode==='panel',owns:id=>id==='assistant-test',noteContext(){},working:()=>notePending,token:()=>noteToken};
   globalThis.noteMessage=m=>{let result;for(const fn of noteListeners)fn(m,{id:'quiet-renderer-test'},value=>{result=value;});return result;};
  });
  for(const file of ['core.js','rich-editor.js','editor.js'])await page.addScriptTag({path:path.join(root,'extension',file)});
  await page.waitForFunction(()=>globalThis.notepadReady);
  const results=await page.evaluate(async()=>{
   const editor=document.querySelector('#editor'),results=[],cases=[
    {label:'empty',html:'',text:''},{label:'plain',html:'',text:'Ordinary note'},
    {label:'multiline',html:'',text:'First line\nSecond line\n'},
    {label:'blank lines',html:'',text:'First line\n\n\n'},
    {label:'heading',html:'<h1>Heading</h1><div>Body</div>'},
    {label:'list',html:'<ul><li>First</li><li>Second</li></ul>'},
    {label:'formatted raw newline',html:'<h1>Heading</h1><p><b>Body\n\n</b></p>'},
    {label:'table',html:'<table><tbody><tr><td>First</td><td>Second</td></tr></tbody></table>'},
    {label:'trailing paragraph',html:'<div>One</div><div><br></div>'},
    {label:'text node and trailing empty block',html:'Ordinary private fixture note 938<div><br></div>'}
   ];
   function load(item){noteVisible=true;noteMode='quiet';notePending=false;noteToken='quiet-token';saveFailure='';saveFileError='';RichEditor.load(item.html||'',item.text||'');const before={text:editor.value,html:RichEditor.html()};NotepadEditor.applyContext({note:{id:'note-test',...before,revision:0}});return before;}
   for(const item of cases){
    const before=load(item),reply='Reference reply\nSecond response line\n',separator=before.text?(before.text.endsWith('\n\n')?'':before.text.endsWith('\n')?'\n':'\n\n'):'',result=await NotepadEditor.insertReference(reply,{noteId:'note-test'}),after={text:editor.value,html:RichEditor.html()};
    editor.focus();document.execCommand('undo');const undo={text:editor.value,html:RichEditor.html()};document.execCommand('redo');const redo={text:editor.value,html:RichEditor.html()};
    results.push({label:item.label,before,after,expected:before.text+separator+reply,result,undo,redo});
   }
   async function reject(label,configure,options={noteId:'note-test'},text='Do not append'){
    const before=load({text:'Keep this ordinary note'});configure();let rejected=false;try{await NotepadEditor.insertReference(text,options);}catch{rejected=true;}results.push({guard:label,rejected,before,after:{text:editor.value,html:RichEditor.html()}});
   }
   await reject('hidden',()=>{noteVisible=false;noteToken=null;});await reject('wrong note',()=>{},{noteId:'other-note'});await reject('active task',()=>{notePending=true;});await reject('invalid reply',()=>{},{noteId:'note-test'},'bad\0reply');await reject('oversized reply',()=>{},{noteId:'note-test'},'x'.repeat(2*1024*1024));
   const quietBefore=load({text:'Keep quiet note'}),proposal=noteMessage({type:'NOTE_AI_PROPOSE',noteId:'note-test',assistantId:'assistant-test',editRequestId:'late-panel-request',expectedText:quietBefore.text,expectedHtml:quietBefore.html,expectedRevision:0,text:'Leaked panel revision'});results.push({guard:'late panel proposal',rejected:proposal?.accepted===false&&proposal.reason==='quiet',before:quietBefore,after:{text:editor.value,html:RichEditor.html()}});
   load({text:'Before typing'});editor.value='Manual draft';editor.dispatchEvent(new Event('input',{bubbles:true}));let release;saveGate=new Promise(resolve=>{release=resolve;});const inserting=NotepadEditor.insertReference('Delayed reply',{noteId:'note-test'});await new Promise(resolve=>setTimeout(resolve,0));noteVisible=false;noteToken=null;saveGate=null;release();let cancelled=false;try{await inserting;}catch{cancelled=true;}results.push({race:'hide during flush',cancelled,text:editor.value,expected:'Manual draft'});
   load({text:'Previous note'});editor.value='Previous manual draft';editor.dispatchEvent(new Event('input',{bubbles:true}));saveGate=new Promise(resolve=>{release=resolve;});const switching=NotepadEditor.insertReference('Wrong owning reply',{noteId:'note-test'});await new Promise(resolve=>setTimeout(resolve,0));NotepadEditor.applyContext({note:{id:'other-note',text:'Other note untouched',html:'',revision:0}});saveGate=null;release();cancelled=false;try{await switching;}catch{cancelled=true;}results.push({race:'note switch during flush',cancelled,text:editor.value,expected:'Other note untouched'});
   const failedBefore=load({html:'<p><b>Formatted original</b></p>'});saveFailure='Fixture save failure';const failedSave=await NotepadEditor.insertReference('Retained reply',{noteId:'note-test'});results.push({save:'IPC failure',result:failedSave,text:editor.value,expected:failedBefore.text+'\n\nRetained reply'});
   const conflictBefore=load({text:'Original disk draft'});saveFileError='Fixture newer disk revision';const conflictedSave=await NotepadEditor.insertReference('Local reply once',{noteId:'note-test'});results.push({save:'disk conflict',result:conflictedSave,text:editor.value,expected:conflictBefore.text+'\n\nLocal reply once'});
   return results;
  });
  for(const result of results){
   if(result.guard){assert.equal(result.rejected,true,result.guard);assert.deepEqual(result.after,result.before,result.guard+' preserves note');console.log('PASS '+result.guard+' prevents insertion');}
   else if(result.race){assert.equal(result.cancelled,true,result.race);assert.equal(result.text,result.expected);console.log('PASS '+result.race+' prevents delayed insertion');}
   else if(result.save){assert.equal(result.result.ok,true);assert.equal(result.result.inserted,true);assert.equal(result.text,result.expected);assert.match(result.result[result.save==='disk conflict'?'fileError':'saveError'],/Fixture/);console.log('PASS '+result.save+' retains one local insertion and reports saving problem');}
   else{assert.equal(result.result.ok,true);assert.equal(result.after.text,result.expected,result.label);assert.deepEqual(result.undo,result.before,result.label+' exact native Undo');assert.deepEqual(result.redo,result.after,result.label+' exact native Redo');console.log('PASS '+result.label+' explicit quiet insertion preserves text, formatting and native Undo/Redo');}
  }
  console.log(results.length+' explicit quiet-reference renderer checks passed');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
