'use strict';
// Rebuild committed Windows icon assets from the same blue notebook artwork
// used by the editor chrome. Requires only the test Playwright dependency.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const folder=path.join(__dirname,'../extension/icons'),sizes=[16,32,48,128,256];
(async()=>{const browser=await chromium.launch({executablePath:process.env.NOTES_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const svg=fs.readFileSync(path.join(folder,'notes.svg'),'utf8'),images=[];
 for(const size of sizes){const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});await page.setContent('<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>'+svg);const image=await page.screenshot({omitBackground:true});fs.writeFileSync(path.join(folder,'notes'+size+'.png'),image);images.push(image);await page.close();}
 const header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
 sizes.forEach((size,index)=>{const entry=6+index*16;header[entry]=header[entry+1]=size===256?0:size;header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(images[index].length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=images[index].length;});
 const icon=Buffer.concat([header,...images]);fs.writeFileSync(path.join(folder,'notes-blue.ico'),icon);fs.writeFileSync(path.join(folder,'notes.ico'),icon);
 console.log(JSON.stringify({sizes,iconBytes:icon.length,artwork:'blue notepad',executableModified:false}));
}finally{await browser.close();}})().catch(error=>{console.error(error.stack);process.exitCode=1;});
