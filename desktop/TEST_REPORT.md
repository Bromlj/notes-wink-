# Notes Workspace Desktop 5.3.1 verification

Verified on Windows x64 on 12 October 2026. This update adds explicit compact note editing and shared model/thinking shortcuts.

## Result and behavior

The small unlabeled checkbox in **Notes for self** grants the current verified note file and containing folder to the next compact request. It starts off for new notes and is separate from the sidebar's **Edit this note** permission. Accepted work can edit the real disk file while the displayed and recovery note remain frozen. A completed revision is held until explicit **Alt+I**, without opening Reference or approving a replacement dialog. Native Undo restores the original rich note and file. Manual changes, newer disk content, relinking, imported previews and wrong-note requests cannot force an overwrite.

**Alt+1–6** and previous/next model shortcuts now work in both unlocked modes and synchronize both menus. Previous/next accepts Alt+minus / Alt+plus (or equals), comma/period and the existing next-model Alt+Shift+M. Unsupported efforts retain the current selection; changing choices does not alter a running turn. Alt+Q conceals all AI surfaces while accepted work continues.

Codex receives an explicit description of the note-folder grant. Sandbox restrictions and genuine approvals remain enabled. Permissions cannot be added retrospectively to an already submitted request.

## Checks run for this update

- **184 helper tests:** core and agent behavior, desktop service/storage/backup, persistent files and races, native note scopes, worker note editing and icon configuration. This includes 11 new compact permission/application cases and local-only backup consent.
- **64 Chromium renderer checks:** 44 proposal/Undo cases and 20 explicit reply-insertion cases. Nine new cases cover explicit quiet application and its privacy/ownership guards.
- **124 packaged-app checks:** 30 desktop flows, 20 direct-file flows, 17 sidebar note-edit flows, 9 backup-import flows, 7 outcome-feedback flows, 19 compact-mode flows, 16 compact note-edit flows and 6 actual Codex compact note-edit checks.
- **3 additional real native-host checks:** an existing conversation in the default Conversations workspace receives a newly permitted managed note outside that workspace and edits/verifies its actual file without additional approval.

The **375 checks** cover independent tabs, project/file bindings, rich editing, file conflicts, hidden completion, once-only explicit insertion/application, empty final response readiness, passphrase/ownership races, native Undo and cross-menu keyboard selections. Renderer suites reported zero exceptions. No additional access approval was accepted by live tests.

The final packaged live run used **gpt-6.1-sol / Low**. It reused an existing conversation, reached the actual note file in **11.9 seconds**, completed in **14.5 seconds** and explicitly applied in **14.8 seconds**. The Reference sidebar remained hidden throughout; Undo restored the original rich text and disk file. These are individual observations, not latency guarantees.

The compact prompt capture was visually inspected against the established dark Windows Notepad appearance. A fresh independent read-only review returned **ship**, with no material fixes. A generic subagent substituted for the named design-review harness; no detector ran. Local screenshots, detailed results and disposable profiles are excluded from publication.

## Release construction and privacy

The public repository contains only explicitly curated source, synthetic fixtures, icons, licenses and guides. It retains the existing clean publication history and GitHub noreply commit identity. Source and release inventories are checked for credentials, notes, conversations, attachments, private profiles, generated test results and developer home paths. Each recipient signs in independently with their own Codex account.

Packaging uses explicit program/runtime inputs, creates a per-file SHA-256 manifest, checks every archived file and publishes an archive checksum. Installed app data and Codex home are not build inputs. The official Electron executable remains unmodified; window, taskbar and shortcut icons use application APIs. Embedded EXE metadata remain Electron's. No custom code-signing certificate is provided.

The verified per-user update preserves saved note text and formatting. Program files and recovery data remain separate.

## Methods and limits

Playwright drives isolated instances of the packaged Electron app. Deterministic suites use synthetic app-server fixtures. File-picker and sign-in launch checks substitute controlled main-process dialog responses; they do not complete physical Windows dialogs or fresh human OAuth. Real inference tests use disposable files and the current account's existing Codex sign-in without exporting credentials.

Fresh human sign-in, first-time administrator sandbox setup, every Codex desktop integration and other computers were not fully tested. Electron 44.7.0 and Codex CLI 0.160.0 are retained. The complete earlier 5.3.0 live project-work matrix was not rerun for this narrow update. No claim of perfection or compatibility with every future service change is made.

Visual hiding does not conceal disk changes, processes, recording, authentication pages or system inspection. Notes and backups are not encrypted. Closing the entire app, crashes, sleep or network loss can interrupt work. The optional restore passphrase prevents accidental reveals; it does not secure an unlocked computer.
