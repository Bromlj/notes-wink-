# Notes Workspace Desktop 5.3.0 verification

Verified on Windows x64 on 12 October 2026. The app bundles Electron 44.7.0 and official Codex CLI 0.160.0 and runs independently of Edge. Tests used disposable app profiles, actual disposable text files and projects. Recipients do not need a separate Node or Python installation or an API key.

## Passed checks

- **172 helper tests:** protocol, account/catalog, attachments, streaming/retries/disconnects, approvals and policy, project paths, backup/storage, real-file bindings and races, note/run/revision ownership, outcome reporting, physical icon paths and quiet-mode restore/hide guards.
- **35 guarded automatic-edit renderer checks:** insertions across ordinary and rich text, leading/trailing whitespace, CRLF handling, formatting preservation, native Undo/Redo, AI Undo and refusal to overwrite hidden or dirty notes.
- **20 compact-insertion renderer checks:** explicit once-only insertion, note ownership and hidden-state guards, pending refusal, whitespace, rich content and native Undo/Redo. Includes the mixed text node plus empty trailing paragraph that initially failed and was repaired.
- **30 packaged desktop checks:** ordinary notes, visible formatting, find/replace, native Save As results, restricted renderer/navigation, icon identity, model/thinking selection, attachments, independent chats, projects/history, hidden replies, approvals, settings, passphrases, restore races, account launch/cancel, sandbox setup flow and recovery.
- **20 packaged direct-file checks:** persistent bindings, actual Save/Save As, disk plus rich-note Undo, external-change refusal, Reload/Relink, hidden conflicts, restart protection, missing files and pending previews after Save As.
- **4 first-run checks:** the real bundled Codex runtime with an empty isolated Codex home reported signed out, ordinary notes worked, official sign-in was available, and panic returned to plain notes. No prompt was submitted from this empty profile.
- **9 packaged migration checks:** notes, chats, projects, drafts and partial replies survive import without resending unfinished work. Existing notes remain. Reviewed pending revisions write the current actual file and support rich Undo.
- **17 packaged note-edit checks:** opt-in file editing, visible updates, frozen hidden text and recovery, reveal catch-up, local conflicts, opt-out, independent tabs, explicit Apply, CRLF and rich-note Undo.
- **7 packaged feedback checks:** successful, unchanged, failed and retried turns report their actual file outcome, model and effort. Unchanged work is no longer silently presented as a note update.
- **18 packaged compact-mode checks:** plain Notes for self prompt, keyboard-only catalog model cycling and fixed thinking shortcuts, unsupported-level refusal, selection/hide races, running-task settings preserved while next-task choices change, no implicit note context or grant even with editing checked, no partial insertion, green readiness only for the completed owning reply, once-only insertion, native Undo/Redo, concealed completion, hidden/wrong-note guards, error/approval states, role colours, passphrase and queued-hide races.
- **5 live Codex append checks:** real gpt-6.1-sol at Low appended to the actual opted-in note file without an Apply step. Visible and disk text retained both original lines, no pending formatting conflict remained, and guarded Undo restored the exact original rich note and file.
- **6 live Codex compact checks:** real gpt-6.1-sol at Low was selected through compact keyboard shortcuts; panic hid all AI surfaces while inference completed; the note stayed unchanged; restore showed readiness; Alt+I inserted once; normal Undo restored the original text, markup and file. The full sidebar stayed hidden throughout.

These comprise **172 helper tests, 55 renderer checks and 116 packaged-app checks**. Suites recording renderer exceptions reported zero. Live tests did not automatically approve additional access.

The real append reached disk in 13.5 seconds, the visible note in 14.1 seconds and completed in 16.6 seconds. The final real compact reply completed in 5.1 seconds. These are individual measurements, not latency guarantees; model effort, tools, service load and connection affect duration.

Plain notes, compact prompt and coloured full-sidebar captures were visually inspected. The established dark Windows Notepad appearance was retained. Local captures and detailed results are excluded from publication.

## Release privacy and construction

The public repository is a fresh source-only publication, with GitHub noreply commit identity and no copied development history. Source and release inventories were checked for private profiles, credentials, notes, conversations, attachments, generated results and developer home paths. Dependencies and runtimes are copied from explicit build inputs; the installed app profile and Codex home are never inputs. Each recipient signs in independently.

Packaging writes a per-file SHA-256 manifest, verifies every archived file against it, rejects private-data filenames and publishes an archive checksum. The unmodified vendor Electron executable is renamed; window, taskbar and desktop shortcut use the notepad icon through application APIs. Embedded EXE icon/version metadata remain Electron's. No custom code-signing certificate is provided.

The per-user installation was verified on this host: all 678 program files matched the release manifest, the desktop shortcut resolved with the physical notepad icon, startup succeeded, and saved note text and formatting were retained. Program files and recovery data remain separate.

## Methods and limits

Playwright drove the app's own packaged Electron instance, with sandboxing, context isolation and disabled renderer Node integration retained. Deterministic suites use an isolated app-server fixture. File/folder picker and account-launch tests substitute controlled responses at the main-process boundaries, then verify actual writes and official HTTPS authentication launch. They do not complete physical Windows dialogs or fresh human OAuth.

Fresh human sign-in, first-time administrator sandbox setup, every Codex desktop integration and other computers were not fully tested. Earlier live project command workflows passed on this host; this release retains CLI 0.160.0 because 0.162.0 exposed a Windows sandbox refresh failure in earlier verification. Sandbox restrictions and approval prompts remain enabled. No claim of perfection or compatibility with every future service change is made.

## Files and visual discretion

Compact requests do not implicitly grant note editing. Their reply is held outside the note until explicit Alt+I insertion while the owning note is visible and unlocked. Native Undo removes that insertion.

Sidebar **Edit this note** is separate: it grants the real note file and containing folder to that accepted turn. Alt+Q freezes the displayed note and its canonical recovery text while actual disk edits may continue. Another program reading that file can see those changes. Reveal catches up unless manual changes require review. Save and Undo refuse stale disk hashes. Turning note editing off pauses updates but cannot revoke access already granted to an active task; Stop cancels explicitly.

Visual hiding does not conceal processes, recording, authentication pages, file dialogs or system activity. Notes and backups are not encrypted. Closing the whole app, crashes, sleep or connection loss can interrupt work. The optional restore passphrase prevents accidental reveals, not access to an unlocked computer.
