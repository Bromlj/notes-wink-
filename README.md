# Notes Workspace

A Windows notepad with Codex in an optional sidebar or a small **Notes for self** box. Write ordinary notes, work on real project files, choose account-provided models and thinking levels, and revise the current note with Undo. Compact requests can wait for your insert shortcut or apply a completed note revision automatically when you opt in.

**Start here: [Illustrated setup guide](docs/SETUP.md).** Each person signs in with their own account. Read [what is public and what stays local](docs/PRIVACY.md) before sharing your own backups or data folders.

## Install the Windows app

1. Download the Windows x64 ZIP from [the latest release](https://github.com/Bromlj/notes-wink-/releases/latest).
2. Right-click it in File Explorer and choose **Extract All**.
3. Open the extracted **Notes Workspace** folder and run **Install.cmd**.
4. Open the desktop shortcut with the blue notepad icon. Press **Alt+W → Options → Account → Sign in with ChatGPT**, complete your own sign-in, then return and choose **Reconnect**.

The ZIP includes an illustrated offline `SETUP.html`. No separate Node, Python, development environment, Edge extension or API key is needed to use the app.

Alternatively, if you have Git:

```powershell
git clone https://github.com/Bromlj/notes-wink-.git
cd notes-wink-
.\Get-App.cmd
```

The downloader gets the Windows release. Git only downloads the small source repository; the large application runtimes are release assets rather than Git objects.

AI usage comes from your account's available **Codex allowance**. A ChatGPT browser session alone does not authenticate the app's Codex runtime. The app does not transfer another person's subscription, credentials or website conversations.

## Compact mode

![Notes for self with made-up note text and both compact checkboxes selected](docs/images/notes-for-self.png)

The two small checkboxes have no visible labels. **The first permits the next request to read and edit the current real note. The second permits automatic application of its completed revision.** Both start off for a new note; they are independent of the sidebar's Edit this note setting.

| Shortcut | Action |
| --- | --- |
| **Alt+S** | Open/close Notes for self. Enter sends and closes it; Shift+Enter adds a line. |
| **Alt+I** | Append a completed compact reply once, or apply its permitted note revision once, with Undo. |
| **Alt+Q** | Hide every AI control and indicator, and freeze visible AI note changes. Accepted work continues. |
| **Alt+W** | Open the full Reference sidebar, with distinct colours and labels for your text and Codex replies. |
| **Alt+1–6** | Low, Medium, High, Extra high, Maximum or Ultra thinking, when supported. |
| **Alt+- / Alt+=** | Previous / next model. Both unlocked views stay synchronized. |
| **Alt+Shift+S** | Settings, optional restore passphrase, backups and desktop shortcut creation. |

A small dot after **Plain text** in the bottom status bar is grey while working, green when ready, and amber when attention is needed. **Alt+I** handles a ready result without opening the sidebar. A green **Done** pulse lasts about four seconds after automatic application, including an automatic note task that made no change.

Automatic application works only for a completed, authorized **note revision**, with consent set before sending and still enabled. It does not stream changes into your note or append ordinary replies automatically. If you hide with Alt+Q, a completed revision waits until you return with Alt+S. Newer local or disk changes remain protected. Command and access approvals always wait for your decision.

The numeric title marker means **model position / thinking level**; model positions follow the account catalog. The full sidebar shows actual names. Unsupported thinking levels leave the current choice unchanged. Comma/period also cycle models, and Alt+Shift+M selects the next model. Settings apply to the next request; they do not change a running task.

See the [setup guide](docs/SETUP.md) for checkbox examples, screenshots, model numbering and troubleshooting.

## Notes and project work

- **File → Open** binds a real UTF-8 text file. Save updates it; Save as chooses another file. Untitled notes receive persistent document files in the app's local data folder.
- **+** creates another note and independent Codex chat. Choose **Browse** in the Reference sidebar to select a project folder.
- Codex can edit, create and move the project's actual files, run commands and use attachments under its normal sandbox and approval controls. Project changes save directly; **Alt+I is not needed for project files**.
- The sidebar's **Edit this note** enables real note-file revisions with visible progress. Compact editing has its own checkbox and waits for completion before manual or opted-in automatic application.
- **Alt+Q freezes the displayed note and indicator, while accepted disk/project work continues.** Another program viewing the file can see those disk changes. Stop the task explicitly to stop its work.
- **Undo AI edit** restores an accepted note revision after completion if neither the note nor disk file changed again. Ordinary Undo also works for compact insertion. Conflicting local text stays in recovery rather than being silently overwritten.
- **Apply pending** in the sidebar can apply one confirmed revision even when persistent note editing is off. **Reload from disk** and **Relink moved file** are deliberate recovery actions for external changes or moved documents.

The interface provides visual discretion. It does not encrypt notes or conceal running processes and system activity. A restore passphrase prevents accidental reveals; it does not secure an unlocked computer.

## Build from source

Build on **Windows x64** with Git and Node.js 22.12 or newer. Runtime downloads require internet access. Python 3.11 or newer is needed only to create a release ZIP.

```powershell
npm ci --prefix native
npm ci --prefix desktop
node desktop/build.cjs
```

The program is generated at `desktop/dist/Notes Workspace/Notes Workspace.exe`. Run Install.cmd from that generated folder to install your build. `desktop/Install.cmd` in the source tree is a packaging input, not a ready-to-run installer.

To create a release ZIP with an embedded per-file manifest and SHA-256 verification:

```powershell
python tests/build-desktop-release.py
```

The ZIP and checksum are written to `release/`. The build copies explicit app files, licensed runtimes and notices. It does not package installed app data, browser profiles, account credentials, notes or test profiles.

## Tests

The 5.3.2 update passed **360 checks: 195 helper tests, 64 renderer checks and 101 packaged-app checks**. These cover compact note permissions, manual and automatic application, hidden completion, conflicts, rich Undo, model shortcuts, account isolation and Windows icon handling. The [test report](desktop/TEST_REPORT.md) records the measured scope and limits.

After installing source dependencies, run helper tests without signing in:

```powershell
node --test tests/core.test.cjs tests/direct.test.cjs tests/agent.test.cjs tests/desktop-service.test.cjs tests/desktop-backup.test.cjs tests/desktop-storage.test.cjs tests/desktop-note-files.test.cjs tests/desktop-direct-host.test.cjs tests/desktop-note-file-races.test.cjs tests/note-host.test.cjs tests/worker-note-edit.test.cjs tests/desktop-icon.test.cjs
```

For packaged application tests, build the app and install the test driver first:

```powershell
npm install --prefix tests
node tests/desktop-e2e.cjs
node tests/desktop-import.cjs
node tests/desktop-note-edit-e2e.cjs
node tests/desktop-direct-file-e2e.cjs
node tests/desktop-first-run.cjs
node tests/desktop-note-feedback-e2e.cjs
node tests/desktop-quiet-e2e.cjs
node tests/desktop-quiet-note-e2e.cjs
node tests/desktop-quiet-auto-e2e.cjs
node tests/desktop-icon-e2e.cjs
```

These scripts use disposable profiles and text files. `desktop-first-run.cjs` uses the real bundled Codex runtime with an empty sign-in profile; deterministic editor tests use the included app-server fixture. Generated test profiles, logs and screenshots are ignored by Git. The two documentation pictures above and in the setup guide are explicit synthetic examples.

The following **live tests use your current Codex sign-in and account allowance**. They make real requests restricted to disposable projects and do not automatically approve additional access:

```powershell
node tests/desktop-live.cjs
node tests/desktop-note-edit-live.cjs
node tests/desktop-direct-file-live.cjs
node tests/desktop-note-append-live.cjs
node tests/desktop-quiet-live.cjs
node tests/desktop-quiet-note-live.cjs
node tests/desktop-note-scope-live.cjs
```

Optional overrides: `PLAYWRIGHT_MODULE` selects an existing Playwright installation, `NOTES_DESKTOP_EXE` selects a built executable, and `NOTES_TEST_NODE` selects Node for deterministic fixtures.

## Compatibility and licenses

The desktop shortcut, window and taskbar use the blue notepad icon. The EXE preserves the vendor Electron runtime's embedded icon and version metadata; its executable bytes are not resource-modified. An old pinned taskbar shortcut may need to be unpinned and recreated.

This release has no custom code-signing certificate. Windows reputation warnings and managed policies can vary. Fresh human sign-in, first-time administrator sandbox setup and every other computer were not fully tested. Results describe the performed checks, not a guarantee of perfection or future compatibility.

Notes Workspace source is [MIT licensed](LICENSE.txt). Bundled components retain their licenses; see [desktop/licenses](desktop/licenses) and release runtime notices. Independent personal-use software, not affiliated with OpenAI or Microsoft.
