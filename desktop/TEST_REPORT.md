# Notes Workspace Desktop 5.3.2 verification

Verified on Windows x64 on 12 October 2026. This update adds optional automatic compact note application, fixes Windows icon paths, and includes an illustrated setup guide.

## Result and behavior

The first small unlabeled checkbox in **Notes for self** grants the current verified note file and containing folder to the next compact request. The second opts that request into automatic application of its completed revision while compact mode is unlocked. Both start off for new notes and are separate from the sidebar's **Edit this note** permission. Accepted work can edit the real disk file while the displayed and recovery note remain frozen. Without the second opt-in, **Alt+I** explicitly applies the completed revision. With both opt-ins, completion applies once and briefly pulses green; an unchanged authorized note task also shows Done without an apply request. Native Undo restores the original rich note and file. Manual changes, newer disk content, relinking, imported previews and wrong-note requests cannot force an overwrite.

**Alt+Q** revokes the transient display grant and hides controls and the completion indicator. Accepted work continues on disk; a hidden completed revision waits until **Alt+S** restores compact mode, then applies only if its captured and current permissions and ownership/conflict guards still pass. Automatic application does not insert partial revisions or ordinary prose replies. Genuine command/access approvals still require a response.

**Alt+1–6** and previous/next model shortcuts work in both unlocked modes and synchronize both menus. Previous/next accepts Alt+minus / Alt+plus (or equals), comma/period and Alt+Shift+M. Unsupported efforts retain the current selection; changing choices does not alter a running turn. Codex receives an explicit description of the note-folder grant. Permissions cannot be added retrospectively to an already submitted request.

## Checks run for this update

- **195 helper tests:** core and agent behavior, desktop service/storage/backup, persistent files and races, native note scopes, worker note editing and icon configuration. Eight new worker cases cover automatic consent and its races; six icon cases cover canonical paths, fallback and all five blue artwork sizes.
- **64 Chromium renderer checks:** 44 proposal/Undo cases and 20 explicit reply-insertion cases, including explicit quiet application and privacy/ownership guards.
- **101 packaged-app checks:** 30 desktop flows, 9 backup-import flows, 19 compact-mode flows, 16 manual compact note-edit flows, 17 automatic compact flows, 6 actual Codex automatic note-edit checks and 4 native Windows icon checks.

The **360 checks** cover independent tabs, project/file bindings, rich editing, file conflicts, hidden completion, once-only explicit/automatic application, empty final response readiness, unchanged completion, reduced motion, passphrase/ownership races, native Undo and cross-menu keyboard selections. Renderer suites reported zero exceptions. No additional access approval was accepted by live tests. The automatic fixture also verifies project file implementation without a note grant and that real approval requests remain unanswered.

The final packaged live run used **gpt-6.1-sol / Low**. It reused an existing conversation, reached the actual note file in **10.5 seconds**, completed in **12.6 seconds** and automatically applied after compact restore in **12.9 seconds**. The Reference sidebar remained hidden throughout; Undo restored the original rich text and disk file. These are individual observations, not latency guarantees.

Windows itself resolved blue artwork from the actual shortcut and ICO; both small and large native window icons were checked. Shell paths use the same canonical physical program root instead of mixing an AppData alias with the physical executable. The desktop shortcut was repaired without interrupting the running old app; an already running instance must restart to load its new taskbar icon. Existing pinned old shortcuts can require unpinning and pinning the updated shortcut.

The compact prompt and account guide captures were visually inspected. The two published guide images contain only synthetic sample text and a signed-out disposable account view. Other local screenshots, detailed results and disposable profiles are excluded from publication. The guide is included as offline SETUP.html with local image assets, as well as GitHub Markdown. A fresh independent read-only finish review returned **ship**, with no actionable findings. A generic subagent substituted for the unavailable named design-review harness; no detector ran.

## Release construction and privacy

The public repository contains only explicitly curated source, synthetic fixtures, icons, licenses and guides. It retains the existing clean publication history and GitHub noreply commit identity. Source and release inventories are checked for credentials, notes, conversations, attachments, private profiles, generated test results and developer home paths. Each recipient signs in independently with their own Codex account.

Packaging uses explicit program/runtime inputs, creates a per-file SHA-256 manifest, checks every archived file and publishes an archive checksum. Installed app data and Codex home are not build inputs. The official Electron executable remains unmodified; window, taskbar and shortcut icons use application APIs. Embedded EXE metadata remain Electron's. No custom code-signing certificate is provided.

The verified per-user update preserves saved note text and formatting. Program files and recovery data remain separate.

## Methods and limits

Playwright drives isolated instances of the packaged Electron app. Deterministic suites use synthetic app-server fixtures. File-picker and sign-in launch checks substitute controlled main-process dialog responses; they do not complete physical Windows dialogs or fresh human OAuth. Real inference tests use disposable files and the current account's existing Codex sign-in without exporting credentials.

Fresh human sign-in, first-time administrator sandbox setup, every Codex desktop integration and other computers were not fully tested. Electron 44.7.0 and Codex CLI 0.160.0 are retained. The complete earlier live project-work and sidebar/direct-file matrices were not rerun for this narrow update. No claim of perfection or compatibility with every future service change is made.

Visual hiding does not conceal disk changes, processes, recording, authentication pages or system inspection. Notes and backups are not encrypted. Closing the entire app, crashes, sleep or network loss can interrupt work. The optional restore passphrase prevents accidental reveals; it does not secure an unlocked computer.
