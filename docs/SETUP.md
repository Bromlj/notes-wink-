# Set up Notes Workspace

This Windows app looks like a notepad and includes an optional Codex panel and a compact prompt mode. Every person connects **their own account**. The download contains the app and its runtimes, not the developer's sign-in, chats or notes.

## 1. Install

1. Download the Windows x64 ZIP from [Releases](https://github.com/Bromlj/notes-wink-/releases/latest).
2. Extract the **entire ZIP**. Keep the EXE, DLLs and `resources` folder together.
3. Run `Install.cmd` inside the extracted `Notes Workspace` folder. It installs for your Windows account and creates a notepad desktop shortcut.
4. Open **Notes Workspace** from the desktop. You can write notes immediately.

No separate Node, Python, development environment or API key is needed.

## 2. Connect your own AI account

1. Press **Alt+W** to open the Reference sidebar.
2. Choose **Options → Account → Sign in with ChatGPT**.
3. Complete the official OpenAI sign-in in your browser using **your own account**, then return to Notes Workspace.
4. Choose **Options → Reconnect**. Select a model and thinking level from the choices returned for your account.
5. Send a short question in the sidebar and check that a reply appears.

An existing Codex sign-in for your Windows user may already be available. Being signed in to the ChatGPT website alone does not sign in this app. This app currently connects to **Codex through ChatGPT sign-in**; it uses your account's available Codex access and usage limits. It does not copy another person's subscription, website chats or credentials.

For project commands, open the Account page's **Windows project tools** section. If it requests setup, use **Set up Windows sandbox** and complete the official Windows administrator prompt. The app keeps Codex's normal workspace restrictions and approval controls.

## 3. Choose how to work

| Shortcut | Action |
| --- | --- |
| **Alt+W** | Open the full Reference sidebar. |
| **Alt+S** | Open or close **Notes for self**. Enter sends and closes it; Shift+Enter adds a line. |
| **Alt+1–6** | Set thinking: 1 Low, 2 Medium, 3 High, 4 Extra high, 5 Maximum, 6 Ultra. |
| **Alt+− / Alt++** | Previous / next account-provided model in either unlocked menu. Alt+, / Alt+. also work. |
| **Alt+I** | Insert the completed compact reply, or apply its permitted note revision, once. |
| **Alt+Q** | Immediately hide the sidebar, compact box, controls and indicator. Accepted work continues. |
| **Alt+Shift+S** | Open app settings and optional restore passphrase. |

**Notes for self** contains a text area, close button and small unlabeled checkbox. The checkbox starts off for each new note. Leave it off for a reply; check it before sending to let that task read and edit the current real note file. This permission is separate from the full sidebar’s **Edit this note** option. Its keyboard shortcuts do not open model menus. A numeric selection marker uses model position / thinking level; model positions follow your account's current catalog. Level 0 means a catalog default outside the six mapped levels. Unsupported thinking levels leave your selection unchanged. Alt+Shift+M also cycles to the next model. Selection shortcuts work in both unlocked menus and update both displays. Alt+= also selects the next model. They apply to the next request and do not change a running task.

The box closes after sending. A small green dot after **Plain text** in the status bar means a completed reply or note revision is ready. The displayed note stays unchanged until you press **Alt+I**; no sidebar is needed. With the checkbox on, accepted work can change the real file on disk in the background. Alt+I applies that exact revision with ordinary Undo instead of inserting the assistant’s completion message. Manual note changes, a relinked file or newer disk edits keep the revision pending for review. While a task is still running, insertion is unavailable. If a task fails or needs approval, open the sidebar with **Alt+W** to read the details and respond. The app never automatically approves requests.

After **Alt+Q**, reopen a mode before inserting anything. A configured restore passphrase applies to reopening the compact mode too. These shortcuts work while the app has focus; native Windows dialogs can take priority.

In the full sidebar, your messages and Codex replies use different colours and role labels. **Edit this note** lets a sidebar task directly revise the current note file, with Undo. The compact checkbox controls compact requests independently. Changing it cannot grant access to a request already running. Compact edits are never automatically shown, even if sidebar editing is on. Higher thinking levels can take longer; choose **Low** for simple edits when supported.

## 4. Notes, files and projects

- Use **File → Open**, **Save** and **Save as** for UTF-8 text files. Ordinary editing and formatting work independently of AI.
- Click **+** for a separate note and Codex chat.
- Choose **Browse** in the Reference sidebar to select a project. Codex can work with that project's real files and commands under its normal permissions.
- Attach supported documents or images in the sidebar, or drag them onto it.
- The sidebar's **Undo AI edit** restores an accepted note revision after its task finishes, if the file has not changed again. Compact reply insertions and permitted compact revisions also support ordinary Undo.

Try the shortcuts with an unimportant note first: send, hide, continue typing, reopen, insert, and undo. Closing the entire program can interrupt work; hiding its AI controls does not cancel it.

## 5. Keep your own data private

Your notes and conversations are saved locally under `%LOCALAPPDATA%\NotesWorkspace\DesktopData`. Codex manages sign-in in its own user storage. Requests and attachments you submit are sent through your own Codex account.

**Share the original release ZIP or this repository link. Never share your app-data folder, Codex home, exported backups or test profiles.** Backups can contain your note text and conversations. See [what is included in a public release](PRIVACY.md).

The compact UI provides visual discretion. It does not hide running processes, recording, account sign-in pages or activity from system inspection. Notes and backups are not encrypted. An optional restore passphrase prevents accidental reveals; it does not secure an unlocked computer.

## Troubleshooting

- **No reply:** open the sidebar and read its status and any approval request. Use Reconnect after checking your account. Stop is available for an active task.
- **No models:** finish the app's own sign-in, then Reconnect. Available models depend on the account.
- **No note change:** a completed task reports whether the file actually changed. In compact mode, check the small box before sending an edit request, then use Alt+I when the green dot appears. A request sent before permission was enabled must be stopped and sent again; permissions cannot be added retrospectively.
- **Pending revision:** the sidebar preserves manual changes rather than overwriting them. Review the revision before applying it.
- **Blank shortcut icon:** press **Alt+Shift+S → Desktop program → Create desktop shortcut** to recreate it. Keep the installed resources beside the EXE.

Independent personal-use software, not affiliated with Microsoft or OpenAI.
