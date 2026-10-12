# Notes Workspace Desktop 5.3.3 verification

Verified on Windows x64 on 12 October 2026. This update makes shortcuts, selection, permission saving, restore retries and status feedback consistent across Reference and Notes for self.

## Result and behavior

**Alt+M selects the next model in both unlocked AI views.** Options opens connection settings. Alt+1–6 selects Low, Medium, High, Extra high, Maximum or Ultra when supported. Previous/next accepts Alt+minus / Alt+plus (or equals), comma/period and the legacy Alt+Shift+M. Both menus and the compact numeric marker stay synchronized. Unsupported efforts retain the current choice; held shortcuts act once. A running turn keeps its original model and effort.

Direct menus and keyboard choices share a busy guard, so Send waits for the selected model to be saved. A committed global choice remains synchronized after switching notes. Rejected choices restore the saved dropdown and keep their error visible. The sidebar's Edit this note checkbox remains selected while its permission is saving, blocks Send until that save settles, and restores saved state on rejection. A failed restore can be retried immediately. Settings and native shortcut help list the same complete controls.

Compact note-edit tasks show their own actual source and pending-application instructions in Reference. AI-specific file-error wording becomes a neutral file-save message after hiding; ordinary editor warnings remain visible. Alt+Q clears AI controls, status and transient display grants without cancelling accepted work. Visible and recovery note content stay frozen while accepted disk/project work continues.

The first small compact checkbox grants the current verified note file and containing folder to the next request. The second opts that request into automatic application of its completed revision while compact mode is unlocked. Both start off for new notes and are separate from the sidebar's Edit this note permission. Without the second opt-in, Alt+I explicitly applies the completed revision. Hidden automatic completion waits until Alt+S restores compact mode and rechecks captured/current consent, ownership and conflicts. Ordinary prose replies never auto-insert. Genuine command/access approvals still require a response. Project file changes save directly without Alt+I. Rich Undo restores the original note and actual file when its guards pass.

## Checks run for this update

- **201 helper tests:** core and agent behavior, service/storage/backup, persistent files and races, native note scopes, worker editing/automatic consent, icon paths/artwork and six new shortcut/runtime/settings compatibility cases.
- **69 Chromium renderer checks:** 49 guarded proposal/Undo/error-concealment cases and 20 explicit compact reply-insertion cases.
- **172 packaged-app checks:** 30 desktop flows, 20 direct-file flows, 17 sidebar note-edit flows, 9 import flows, 7 note-feedback flows, 4 native Windows icon checks, 19 compact flows, 16 manual compact note-edit flows, 17 automatic compact flows, 23 consistency cases, 6 actual Codex automatic note-edit checks and 4 fresh-profile checks using the real bundled runtime.

**442 checks passed.** The final successful suites reported zero renderer exceptions. Consistency cases exercise actual native held-key repeats, all six supported levels, unavailable efforts, menu/keyboard overlap, selection response races during hiding/view/tab changes, the actual next Send after switching tabs, stale file-state rendering during held successful/rejected permission changes, restore failure retry, complete shortcut help and source-aware task status. Independent tabs, project/file bindings, imports, CRLF, rich formatting and Undo, conflicts, hidden completion, once-only manual/automatic application and real approval separation were also checked.

The final live run used **gpt-6.1-sol / Low** on disposable files and the current account's existing sign-in. It reused an existing conversation, reached the real note file in **14.1 seconds**, completed in **17.5 seconds**, and automatically presented the verified revision after compact restore in **17.8 seconds**. Reference remained hidden, no extra approval was requested or accepted, and Undo restored exact rich text and disk content. These are individual observations, not latency guarantees. An earlier live attempt ended when its test window closed before the editable-note request; it is not counted as a pass.

Native Windows APIs resolved the blue icon from both small/large window handles and the actual Shell shortcut/ICO. The official Electron executable remains unmodified. An already running app must restart to load its taskbar icon; an old pinned shortcut can require unpinning and recreating.

Four bounded captures at nominal 1280x900 and 680x500 were reviewed. Both composers remain visible without horizontal overflow; the narrow full sidebar uses vertical scrolling. Native DPI rounding produced actual viewports one CSS pixel larger. Two independent read-only reviews found and confirmed fixes for the tab-selection race and restore retry latch; final review returned ship. A generic reviewer substituted for the unavailable named design-review harness; no detector ran. No further visual iteration was needed.

The published guide images contain only synthetic sample text and a signed-out disposable account view. Other screenshots, logs, detailed results and disposable profiles are excluded from publication. Offline SETUP.html and GitHub Markdown explain own-account sign-in, both checkboxes, shared shortcuts, project work, hiding and updates.

## Release construction and privacy

The public repository contains only explicitly curated source, synthetic fixtures, icons, licenses and guides, with the existing clean publication history and GitHub noreply commit identity. Inventories are checked for credentials, notes, conversations, attachments, private profiles, generated test results and developer home paths. Each recipient signs in independently with their own Codex account.

The build copies explicit program/runtime inputs only. Packaging creates a per-file SHA-256 manifest, checks every archived file and publishes an archive checksum. Installed app data and Codex home are not build inputs. Program files and recovery data remain separate. The update installer preserves existing note text and formatting. Embedded EXE metadata remain Electron's; no custom code-signing certificate is provided.

## Methods and limits

Playwright drives isolated instances of the packaged Electron app. Deterministic suites use synthetic app-server fixtures and disposable actual files. Dialog and sign-in launch checks substitute controlled main-process responses; they do not complete physical Windows dialogs or fresh human OAuth. The fresh-profile suite uses the real bundled Codex with an empty CODEX_HOME. Real inference tests use the existing account without exporting credentials.

Fresh human sign-in, first-time administrator sandbox setup, every Codex desktop integration and other computers were not fully tested. Electron 44.7.0 and Codex CLI 0.160.0 are retained. Live project-work matrices beyond the disposable note edit were not rerun. These checks do not establish perfection or compatibility with every future service change.

Visual hiding does not conceal disk changes, processes, recording, authentication pages or system inspection. Notes and backups are not encrypted. Closing the entire app, crashes, sleep or network loss can interrupt work. The optional restore passphrase prevents accidental reveals; it does not secure an unlocked computer.
