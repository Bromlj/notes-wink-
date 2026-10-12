'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const {EventEmitter}=require('node:events');
const source=fs.readFileSync(path.join(__dirname,'../desktop/main.cjs'),'utf8');

function decodeRgba(filtered,width,height){
  const rowBytes=width*4,pixels=Buffer.alloc(rowBytes*height);
  for(let row=0;row<height;row++){
    const filter=filtered[row*(rowBytes+1)];assert(filter<=4);
    for(let column=0;column<rowBytes;column++){
      const offset=row*rowBytes+column,left=column>=4?pixels[offset-4]:0,above=row?pixels[offset-rowBytes]:0,corner=row&&column>=4?pixels[offset-rowBytes-4]:0;
      let predictor=0;
      if(filter===1)predictor=left;
      else if(filter===2)predictor=above;
      else if(filter===3)predictor=Math.floor((left+above)/2);
      else if(filter===4){const estimate=left+above-corner,dl=Math.abs(estimate-left),da=Math.abs(estimate-above),dc=Math.abs(estimate-corner);predictor=dl<=da&&dl<=dc?left:da<=dc?above:corner;}
      pixels[offset]=(filtered[row*(rowBytes+1)+1+column]+predictor)&255;
    }
  }
  return pixels;
}

function fixture(isPackaged,{redirected=false,canonicalizationFails=false}={}){
  // Codex's MSIX host can expose __dirname through an AppData alias while the
  // executable is in its physical package cache. Explorer needs the latter.
  const alias=String.raw`C:\Users\Example\AppData\Local\NotesWorkspace\DesktopProgram\resources\app`;
  const executable=String.raw`C:\Users\Example\AppData\Local\Packages\OpenAI.Codex_fixture\LocalCache\Local\NotesWorkspace\DesktopProgram\Notes Workspace.exe`;
  const processExecutable=redirected?path.win32.join(alias,'..','..','Notes Workspace.exe'):executable;
  const expectedExecutable=canonicalizationFails?processExecutable:executable;
  const desktop=String.raw`C:\Users\Example\Desktop`,calls={images:[],shortcuts:[],details:[],windows:[],realpaths:[]};
  const app=new EventEmitter();Object.assign(app,{isPackaged,setName(){},setAppUserModelId(){},setPath(){},getPath:name=>name==='desktop'?desktop:String.raw`C:\Users\Example\AppData\Roaming`,requestSingleInstanceLock:()=>false,quit(){}});
  class Window extends EventEmitter {
    constructor(options){super();this.id=calls.windows.length+1;calls.windows.push(options);this.webContents=new EventEmitter();Object.assign(this.webContents,{getURL:()=>this.url,setWindowOpenHandler(){},session:{setPermissionRequestHandler(){},setPermissionCheckHandler(){}}});}
    removeMenu(){}
    setAppDetails(details){calls.details.push(details);}
    async loadURL(url){this.url=url;}
    show(){}
  }
  const electron={app,BrowserWindow:Window,protocol:{registerSchemesAsPrivileged(){}},net:{},ipcMain:{handle(){},on(){}},dialog:{},shell:{writeShortcutLink:(...args)=>{calls.shortcuts.push(args);return true;}},nativeImage:{createFromPath:icon=>{calls.images.push(icon);return {icon};}}};
  const local={
    './worker-runtime.cjs':{ORIGIN:'notes://app',createRuntime(){throw Error('The icon test must not start the application runtime.');}},
    './codex-service.cjs':{},'./backup.cjs':{},'./note-files.cjs':{}
  };
  const mockFs=Object.create(fs);mockFs.realpathSync={native:input=>{calls.realpaths.push(input);assert.equal(input,processExecutable);if(canonicalizationFails)throw Object.assign(Error('Canonical path is unavailable.'),{code:'EPERM'});return executable;}};
  const context=vm.createContext({__dirname:alias,module:{exports:{}},process:{execPath:processExecutable,env:{LOCALAPPDATA:String.raw`C:\Users\Example\AppData\Local`}},URL,setTimeout,require:name=>name==='electron'?electron:name==='node:path'?path.win32:name==='node:fs'?mockFs:Object.hasOwn(local,name)?local[name]:require(name)});
  vm.runInContext(source,context,{filename:'desktop/main.cjs'});
  return {context,calls,alias,executable:expectedExecutable,processExecutable,desktop,icon:path.win32.join(path.win32.dirname(expectedExecutable),'resources','app','ui','icons','notes-blue.ico')};
}

async function assertShellPaths(f){
  await vm.runInContext('createWindow()',f.context);await vm.runInContext('createShortcut()',f.context);
  assert.deepEqual(f.calls.realpaths,[f.processExecutable]);
  assert.equal(f.context.module.exports.diagnostics().executablePath,f.executable);
  assert.equal(f.context.module.exports.diagnostics().iconPath,f.icon);
  assert.equal(f.calls.images[0],f.icon);assert.equal(f.calls.windows[0].icon.icon,f.icon);
  assert.equal(f.calls.details[0].appIconPath,f.icon);assert.equal(f.calls.details[0].appIconIndex,0);
  assert.equal(f.calls.details[0].relaunchCommand,'"'+f.executable+'"');assert.equal(f.calls.details[0].relaunchDisplayName,'Notes Workspace');assert.equal(f.calls.details[0].appId,'NotesWorkspace.Desktop');
  assert.equal(f.calls.shortcuts.length,1);const [shortcut,operation,properties]=f.calls.shortcuts[0];
  assert.equal(shortcut,path.win32.join(f.desktop,'Notes Workspace.lnk'));assert.equal(operation,'create');
  assert.equal(properties.target,f.executable);assert.equal(properties.cwd,path.win32.dirname(f.executable));
  assert.equal(properties.icon,f.icon);assert.equal(properties.iconIndex,0);assert.equal(properties.appUserModelId,'NotesWorkspace.Desktop');
}

test('packaged shortcut and taskbar canonicalize an MSIX executable alias to its physical location',async()=>{
  const f=fixture(true,{redirected:true});await assertShellPaths(f);
  assert.notEqual(f.executable,f.processExecutable);
  assert.notEqual(f.icon,path.win32.join(f.alias,'ui','icons','notes-blue.ico'));
});

test('packaged shortcut and taskbar preserve an already physical executable location',async()=>{
  const f=fixture(true);await assertShellPaths(f);assert.equal(f.executable,f.processExecutable);
});

test('unavailable canonicalization falls back consistently for all Windows Shell paths',async()=>{
  const f=fixture(true,{redirected:true,canonicalizationFails:true});await assertShellPaths(f);assert.equal(f.executable,f.processExecutable);
});

test('development windows retain the source icon and cannot create an installed shortcut',async()=>{
  const f=fixture(false,{redirected:true}),expected=path.win32.join(f.alias,'ui','icons','notes-blue.ico');await vm.runInContext('createWindow()',f.context);
  assert.equal(f.context.module.exports.diagnostics().iconPath,expected);assert.equal(f.calls.images[0],expected);assert.equal(f.calls.details[0].appIconPath,expected);
  await assert.rejects(vm.runInContext('createShortcut()',f.context),/packaged program/);assert.equal(f.calls.shortcuts.length,0);
});

for(const filename of ['notes.ico','notes-blue.ico'])test(`the distributed ${filename} contains complete, decodable RGBA images for desktop and taskbar sizes`,()=>{
  const icon=fs.readFileSync(path.join(__dirname,'../extension/icons',filename));
  assert.equal(icon.readUInt16LE(0),0);assert.equal(icon.readUInt16LE(2),1);const count=icon.readUInt16LE(4);assert.equal(count,5);
  const sizes=[];let previousEnd=6+16*count;
  for(let n=0;n<count;n++){
    const entry=6+16*n,width=icon[entry]||256,height=icon[entry+1]||256,length=icon.readUInt32LE(entry+8),offset=icon.readUInt32LE(entry+12);
    assert.equal(width,height);assert.equal(icon.readUInt16LE(entry+6),32);assert(offset>=previousEnd);assert(offset+length<=icon.length);previousEnd=offset+length;sizes.push(width);
    const png=icon.subarray(offset,offset+length);assert.deepEqual(png.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
    let cursor=8,ended=false;const imageData=[];
    while(cursor<png.length){
      assert(cursor+12<=png.length);const size=png.readUInt32BE(cursor),type=png.toString('ascii',cursor+4,cursor+8);assert(cursor+12+size<=png.length);const payload=png.subarray(cursor+8,cursor+8+size);
      if(cursor===8){assert.equal(type,'IHDR');assert.equal(size,13);assert.equal(payload.readUInt32BE(0),width);assert.equal(payload.readUInt32BE(4),height);assert.equal(payload[8],8);assert.equal(payload[9],6);assert.equal(payload[10],0);assert.equal(payload[11],0);assert.equal(payload[12],0);}
      if(type==='IDAT')imageData.push(payload);
      cursor+=12+size;if(type==='IEND'){assert.equal(size,0);ended=true;break;}
    }
    assert(ended);assert.equal(cursor,png.length);assert(imageData.length>0);const decoded=zlib.inflateSync(Buffer.concat(imageData)),stride=1+width*4;
    assert.equal(decoded.length,stride*height);const pixels=decodeRgba(decoded,width,height);let bluePixels=0;
    for(let offset=0;offset<pixels.length;offset+=4)if(pixels[offset+3]>128&&pixels[offset+1]>pixels[offset]+20&&pixels[offset+2]>pixels[offset]+20)bluePixels++;
    assert(bluePixels>width*height*.2,`${filename} at ${width}px must visibly contain the blue notepad, not a blank document or transparent image.`);
  }
  assert.deepEqual(sizes,[16,32,48,128,256]);assert.equal(previousEnd,icon.length);
});
