'use strict';
// Exercise the native key dispatcher, real worker privacy gate and rendered
// settings rows without starting Electron or touching an account.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {createRuntime,ORIGIN}=require('../desktop/worker-runtime.cjs');
const root=path.resolve(__dirname,'..');

function nativeFixture(){
 const calls=[],instances=[],app=new EventEmitter();Object.assign(app,{isPackaged:false,setName(){},setAppUserModelId(){},setPath(){},getPath:()=>String.raw`C:\Users\Example\AppData\Local`,requestSingleInstanceLock:()=>false,quit(){}});
 class Window extends EventEmitter {
  constructor(){super();this.id=instances.length+1;this.webContents=new EventEmitter();this.webContents.session={setPermissionRequestHandler(){},setPermissionCheckHandler(){}};Object.assign(this.webContents,{setWindowOpenHandler(){},getURL:()=>this.url});instances.push(this);}
  removeMenu(){}setAppDetails(){}async loadURL(url){this.url=url;}show(){}focus(){}isDestroyed(){return false;}
 }
 const electron={app,BrowserWindow:Window,protocol:{registerSchemesAsPrivileged(){}},ipcMain:{handle(){},on(){}},net:{},shell:{},nativeImage:{createFromPath:()=>({})},dialog:{}};
 const local={'./worker-runtime.cjs':{ORIGIN,createRuntime(){}},'./codex-service.cjs':{},'./backup.cjs':{},'./note-files.cjs':{}};
 const context=vm.createContext({__dirname:path.join(root,'desktop'),module:{exports:{}},process:{execPath:process.execPath,env:{LOCALAPPDATA:String.raw`C:\Users\Example\AppData\Local`}},URL,setTimeout,require:name=>name==='electron'?electron:Object.hasOwn(local,name)?local[name]:require(name),testCalls:calls});
 vm.runInContext(fs.readFileSync(path.join(root,'desktop/main.cjs'),'utf8'),context);
 vm.runInContext("runtime={command:async(name,id)=>testCalls.push({name,id})};",context);
 return {context,calls,async window(){await vm.runInContext('createWindow()',context);return instances.at(-1);}};
}
function key(win,changes={}){let prevented=0;win.webContents.emit('before-input-event',{preventDefault(){prevented++;}},{type:'keyDown',key:'m',alt:true,control:false,meta:false,shift:false,isAutoRepeat:false,...changes});return prevented;}

test('native Alt+M and Alt+Shift+M dispatch the same next-model command once and suppress DOM duplicates',async()=>{
 const f=nativeFixture(),win=await f.window();assert.equal(key(win),1);assert.equal(key(win,{shift:true,key:'M'}),1);
 assert.deepEqual(f.calls.map(x=>({...x})),[{name:'next-model',id:win.id},{name:'next-model',id:win.id}]);
 assert.equal(key(win,{isAutoRepeat:true}),1);assert.equal(f.calls.length,2);
 for(const changes of [{type:'keyUp'},{control:true},{meta:true},{alt:false},{key:'x'}])assert.equal(key(win,changes),0);
 assert.equal(f.calls.length,2);
});

test('native shortcut help includes every supported family and states unlocked, hidden and focus requirements',()=>{
 const f=nativeFixture(),help=vm.runInContext('desktopShortcutHelp()',f.context);assert.equal(help.message,'Notes Workspace shortcuts');
 for(const key of ['Alt+S','Alt+W','Alt+Q','Alt+I','Alt+M','Alt+1–6','Alt+- / Alt+=','Alt+Shift+M','Alt+Shift+S','Alt+, / Alt+.'])assert(help.detail.includes(key),key);
 assert.match(help.detail,/Alt\+M — Select the next model/);assert.match(help.detail,/either unlocked AI view/);assert.match(help.detail,/hidden or locked/);assert.match(help.detail,/do not change the selection or reveal controls/);assert.match(help.detail,/next request/);assert.match(help.detail,/native Windows dialogs/);assert.doesNotMatch(help.detail,/opens its options/);
});

async function workerFixture(t){
 const folder=fs.mkdtempSync(path.join(__dirname,'desktop-shortcuts-')),tabs=[{id:1,windowId:1,url:ORIGIN+'/editor.html',active:true},{id:2,windowId:2,url:ORIGIN+'/options.html',active:false}],messages=[];
 const windows={async get(id){return tabs.find(x=>x.id===id);},async list(){return tabs;},async create(){return tabs[0];},async update(id,changes){Object.assign(tabs.find(x=>x.id===id),changes);return tabs.find(x=>x.id===id);},async remove(){},async openSettings(){},async save(){}};
 const runtime=createRuntime({uiRoot:path.join(root,'extension'),dataFile:path.join(folder,'notes.json'),native:async()=>({ok:true}),windows});
 await runtime.connect(1,message=>{messages.push(message);void runtime.receive(1,{replyTo:message.requestId,result:{ok:true}});});
 const request=(type,data={})=>runtime.request(type,data,{id:1,url:tabs[0].url});assert.equal((await request('EDITOR_READY')).ok,true);
 t.after(async()=>{await runtime.close();const target=path.resolve(folder);assert(target.startsWith(path.resolve(__dirname)+path.sep));fs.rmSync(target,{recursive:true,force:true});});
 return {runtime,messages,request,settings:()=>runtime.request('GET_SETTINGS',{}, {id:2,url:tabs[1].url})};
}

test('next-model worker dispatch never reveals hidden controls and targets both unlocked AI modes without opening options',async t=>{
 const f=await workerFixture(t);await f.runtime.command('next-model',1);await f.request('AI_READY');assert.equal(f.messages.some(m=>m.type==='AI_NEXT_MODEL'),false);assert.equal(f.runtime.enabled(1),false);
 for(const mode of ['quiet','panel']){assert.equal((await f.request('RESUME',{token:require('node:crypto').randomUUID(),mode})).ok,true);const before=f.messages.filter(m=>m.type==='AI_NEXT_MODEL').length;await f.runtime.command('next-model',1);await f.request('AI_READY');assert.equal(f.messages.filter(m=>m.type==='AI_NEXT_MODEL').length,before+1);assert.equal(f.runtime.enabled(1),true);}
 await f.request('HIDE');const before=f.messages.filter(m=>m.type==='AI_NEXT_MODEL').length;await f.runtime.command('next-model',1);await f.runtime.command('next-model',2);await f.request('AI_READY');assert.equal(f.messages.filter(m=>m.type==='AI_NEXT_MODEL').length,before);assert.equal(f.messages.some(m=>m.type==='AI_OPEN_OPTIONS'),false);assert.equal(f.runtime.enabled(1),false);
});

test('desktop settings exposes next-model rather than the obsolete browser command name',async t=>{
 const f=await workerFixture(t),settings=await f.settings();assert.equal(settings.ok,true);assert.deepEqual(settings.commands,[{name:'privacy-now',shortcut:'Alt+Q'},{name:'resume-workspace',shortcut:'Alt+W'},{name:'next-model',shortcut:'Alt+M'},{name:'open-settings',shortcut:'Alt+Shift+S'}]);
});

class Element {
 constructor(){this.children=[];this.hidden=false;this.textContent='';this.checked=false;this.events={};}
 append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}addEventListener(type,fn){this.events[type]=fn;}before(){}
}
test('settings renders the complete desktop shortcut list with accurate action labels',async()=>{
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const context=vm.createContext({document:{getElementById:get,createElement:()=>new Element(),querySelector:()=>new Element()},window:{addEventListener(){}},NoteDesktop:{async request(){return {ok:true,options:{hideOnBlur:false},hasPassphrase:false,commands:[{name:'privacy-now',shortcut:'Alt+Q'},{name:'resume-workspace',shortcut:'Alt+W'},{name:'next-model',shortcut:'Alt+M'},{name:'open-settings',shortcut:'Alt+Shift+S'}]};}}});
 vm.runInContext(fs.readFileSync(path.join(root,'extension/options.js'),'utf8'),context);await new Promise(resolve=>setImmediate(resolve));
 const rows=get('shortcuts').children.map(row=>({label:row.children[0].textContent,key:row.children[1].textContent}));
 assert.deepEqual(rows.map(row=>row.key),['Alt+Q','Alt+W','Alt+S','Alt+I','Alt+M','Alt+-','Alt+=','Alt+1','Alt+2','Alt+3','Alt+4','Alt+5','Alt+6','Alt+Shift+M','Alt+, / Alt+.','Alt+Shift+S']);
 assert.equal(rows.find(row=>row.key==='Alt+M').label,'Select the next model');assert.equal(get('shortcut-warning').hidden,true);assert(rows.every(row=>!row.label.includes('connection options')));
});

test('browser updates retain the legacy command id with next-model meaning',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8'));assert.equal(manifest.commands['toggle-paper'].suggested_key.default,'Alt+M');assert.match(manifest.commands['toggle-paper'].description,/next available model/);assert.equal(Object.hasOwn(manifest.commands,'next-model'),false);
});
