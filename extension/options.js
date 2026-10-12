'use strict';
const $ = id => document.getElementById(id);
if(!globalThis.NoteDesktop){
  const section=document.createElement('section');section.innerHTML='<h2>Move to the desktop program</h2><p>Export your saved notes and conversations, then import the file in the desktop program’s settings.</p><button id="export-desktop-backup">Export backup…</button><p id="export-desktop-status" role="status"></p>';
  document.querySelector('main footer').before(section);
  $('export-desktop-backup').onclick=async()=>{try{const {backup}=await request('EXPORT_BACKUP'),url=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='Notes Workspace backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),120000);$('export-desktop-status').textContent='Backup requested. This file contains private notes and conversations.';}catch(e){$('export-desktop-status').textContent=e.message;}};
}
async function request(type, extra = {}) {
  const result = globalThis.NoteDesktop ? await NoteDesktop.request(type,extra) : await chrome.runtime.sendMessage({type, ...extra});
  if (!result?.ok) throw new Error(result?.error || 'The operation failed.');
  return result;
}
async function refresh() {
  const result = await request('GET_SETTINGS');
  for (const [key, value] of Object.entries(result.options)) $(key).checked = value;
  $('current-row').hidden = !result.hasPassphrase;
  $('remove-passphrase').hidden = !result.hasPassphrase;
  $('save-passphrase').textContent = result.hasPassphrase ? 'Change passphrase' : 'Set passphrase';
  const desktop=!!globalThis.NoteDesktop;
  const shortcuts=[
    {name:'privacy-now',label:'Hide all AI controls and indicators'},
    {name:'resume-workspace',label:'Open the Reference sidebar'},
    {shortcut:'Alt+S',label:'Open or close Notes for self'},
    {shortcut:'Alt+I',label:'Insert a completed compact reply or note revision once'},
    {name:desktop?'next-model':'toggle-paper',label:'Select the next model'},
    {shortcut:'Alt+-',label:'Select the previous model'},
    {shortcut:'Alt+=',label:'Select the next model (alternative)'},
    {shortcut:'Alt+1',label:'Thinking: Low'},
    {shortcut:'Alt+2',label:'Thinking: Medium'},
    {shortcut:'Alt+3',label:'Thinking: High'},
    {shortcut:'Alt+4',label:'Thinking: Extra high'},
    {shortcut:'Alt+5',label:'Thinking: Maximum'},
    {shortcut:'Alt+6',label:'Thinking: Ultra'},
    {shortcut:'Alt+Shift+M',label:'Select the next model (legacy shortcut)'},
    {shortcut:'Alt+, / Alt+.',label:'Previous / next model (alternatives)'},
    {name:'open-settings',label:'Open these settings'}
  ];
  const list = $('shortcuts'); list.replaceChildren();
  const missing = [];
  for (const {name,label,shortcut} of shortcuts) {
    const command = name?result.commands.find(c => c.name === name):null;
    const row = document.createElement('div'); row.className = 'shortcut';
    const text = document.createElement('span'); text.textContent = label;
    const key = document.createElement('kbd'); key.textContent = shortcut || command?.shortcut || 'NOT ASSIGNED';
    row.append(text, key); list.append(row);
    if (name&&!command?.shortcut) missing.push(label);
  }
  $('shortcut-warning').hidden = missing.length === 0;
  $('shortcut-warning').textContent = desktop?'A desktop shortcut is unavailable. Reopen the installed program before relying on it.':'Assign the missing browser commands before relying on the cover. Another extension or browser command may already use them. The additional editor shortcuts are fixed.';
}
$('preferences').addEventListener('submit', async event => {
  event.preventDefault();
  try { await request('SAVE_SETTINGS', {options: {hideOnBlur: $('hideOnBlur').checked}}); $('preference-status').textContent = 'Saved.'; }
  catch (e) { $('preference-status').textContent = e.message; }
});
$('passphrase-form').addEventListener('submit', async event => {
  event.preventDefault(); $('save-passphrase').disabled = true;
  try {
    if ($('new-password').value !== $('repeat-password').value) throw new Error('The new passphrases do not match.');
    await request('SET_PASSPHRASE', {currentPassword: $('current-password').value, newPassword: $('new-password').value});
    $('passphrase-status').textContent = 'Passphrase set. It will be required the next time you restore a covered workspace.';
    for (const id of ['current-password', 'new-password', 'repeat-password']) $(id).value = '';
    await refresh();
  } catch (e) { $('passphrase-status').textContent = e.message; }
  finally { $('save-passphrase').disabled = false; }
});
$('remove-passphrase').addEventListener('click', async () => {
  try {
    await request('REMOVE_PASSPHRASE', {currentPassword: $('current-password').value});
    $('passphrase-status').textContent = 'Restore passphrase removed.'; $('current-password').value = ''; await refresh();
  } catch (e) { $('passphrase-status').textContent = e.message; }
});
$('edit-shortcuts').addEventListener('click', () => void request('OPEN_SHORTCUTS').catch(e => { $('shortcut-warning').textContent = e.message; $('shortcut-warning').hidden = false; }));
$('launch').addEventListener('click', async () => {
  try { await request('LAUNCH'); } catch (e) { $('launch').textContent = e.message; }
});
window.addEventListener('focus', () => { void refresh().catch(() => undefined); });
void refresh().catch(e => { $('shortcut-warning').hidden = false; $('shortcut-warning').textContent = e.message; });
