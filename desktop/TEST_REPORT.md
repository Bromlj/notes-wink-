# Notes Workspace Desktop 5.3.4 verification

Verified on Windows x64 on 13 October 2026. This release fixes local-note destination handling, separates final answers from progress, shares the editing permission between both AI views, and repairs structured-note application with native Undo.

## Result and behavior

An ordinary request to add, write or save a note now defaults to the current local notepad. Host instructions are applied on new and cold-resumed Codex threads, with current-turn edit permission repeated in the input. Editing off returns ready-to-insert note content instead of saving another document. Explicitly requested cloud destinations and normal project tools remain available; the app does not disable them globally. This is an instruction contract, not a claim that every future model will always follow it.

The host preserves agent-message phases by item ID. Full progress and final text remain readable in Reference; a separate finalText contains completed final-answer messages. Compact Alt+I uses only that final text for ordinary replies. Known commentary and explicit empty finals cannot become insertable answers. Legacy unphased providers use their last nonempty unknown message; older saved combined transcripts cannot be safely reconstructed and remain readable rather than insertable. The implementation follows the bundled Codex schema and [official app-server item protocol](https://learn.chatgpt.com/docs/app-server#items).

The compact LEFT checkbox and sidebar Edit this note now control the same per-note permission. Changing either updates both views. Existing local opt-in in either old field is retained at upgrade. New notes, imported permissions and relinked documents start off. Submitted tasks cannot acquire a grant retrospectively. The compact RIGHT checkbox still controls only completed compact note revisions; it requires editing to be enabled. Turning shared editing off suppresses automatic compact application without cancelling already accepted disk work. Previously captured revisions remain available for explicit manual review/application. Genuine command and access approvals still require a response.

Rich-note selection now includes document containers for full replacements, avoiding empty table/pre wrappers. Confirmed revisions use one native range edit instead of formatBlock plus insertion, so unchanged formatting stays intact and native Undo restores the complete original. Exact-range retry must restore the precise text and HTML baseline first. Whole-document fallback is limited to replacement of all meaningful content; localized edits keep surrounding rich blocks and links. Visibility, ownership, dirty/revision, disk and conflict guards remain in place. Incompatible formatting still fails without silently accepting the wrong text.

Alt+Q hides AI controls and indicators and freezes visible/recovery note changes. Accepted file/project work can continue. Compact file revisions wait for completion and explicit Alt+I or captured automatic consent; they use verified file content, never the assistant's completion acknowledgement. Undo restores rich note and disk content when its guards pass. Model/thinking shortcuts remain synchronized and apply to the next request.

## Checks run for this update

- **233 helper tests:** existing core/service/storage/backup/file/worker/icon/shortcut matrix plus 26 output/context/migration checks and updated shared-consent tests. Phase ordering, explicit empty final, legacy fallback, cold resume, edit-off scope, persisted finalText, shared opt-in migration, pending grant immutability, current automatic consent and existing privacy/conflict protections are covered.
- **139 actual Chromium renderer checks:** 49 existing guarded note/Undo/error cases, 20 explicit reply-insertion cases, and 70 new structured-note cases. The synthetic matrix exposed 11 failures before the fix and all 70 pass afterward. It covers table append/edit/full/empty replacement, pre/code, lists, links, headings, empty notes and raw trailing LF in sidebar and compact modes; exact text, one-step native Undo/Redo, AI Undo and hidden/local-change guards are checked.
- **182 packaged-app checks:** 30 desktop flows, 20 direct-file flows, 17 sidebar note-edit flows, 9 import flows, 7 feedback flows, 4 native Windows icon checks, 13 destination/final-answer flows, 19 compact flows, 16 manual compact file-edit flows, 17 automatic compact flows, 24 consistency cases and 6 real Codex draft/cold-resume/edit checks.

**554 checks passed.** Successful renderer and packaged suites reported no renderer exceptions. The destination fixture keeps commentary and a synthetic Page preview out of inserted note content, applies actual file revisions independently from confirmations, preserves explicit cloud requests without performing remote writes, and verifies hidden freeze and exact Undo. Shared control tests cover toggling from both views, disabled retained auto preference, migration, no pending grant retrofit and opt-out during an accepted quiet task.

The real packaged test used **gpt-6.1-sol / Low** on disposable data. With both ticks off, the draft completed in **6.9 seconds**, inserted only its final answer, and undid exactly. After shared consent was enabled, the app closed and relaunched; the next request resumed the same thread. Its real file edit reached disk in **16.4 seconds**, completed in **21.1 seconds**, and automatically appeared after compact restore in **21.5 seconds**. Reference stayed hidden in both process lifetimes. No extra approval, cloud tool call or remote document write occurred; rich/file Undo passed. These observations are not latency guarantees.

Native Windows APIs verified the blue small/large window icons and actual Shell shortcut/ICO artwork. The official Electron executable remains unmodified. Existing desktop/setup guidance is updated for shared permissions, local-note defaults and final-only insertion. Independent read-only review returned ship for host/worker/backup interaction and final rich/editor changes; no detector ran.

## Release construction and privacy

Only explicitly curated source, synthetic fixtures, icons, licenses and guides enter the public repository. Existing clean publication history and GitHub noreply identity are retained. Source and release inventories are checked for credentials, personal notes, conversations, attachments, profiles, generated evidence and developer home paths. Each recipient signs in with their own account.

The build copies explicit app/runtime files, excluding installed data and Codex home. Packaging creates a per-file SHA-256 manifest, checks every archived file and publishes a checksum. Program and recovery data remain separate; the update preserves saved text and formatting. Guide screenshots contain synthetic sample text and a signed-out disposable profile. All other screenshots, test profiles, logs and detailed results stay local. Embedded EXE metadata remain Electron's; no custom signing certificate is provided.

## Methods and limits

Playwright drives isolated packaged instances and actual Chromium editors. Deterministic suites use synthetic app-server fixtures and real disposable files. Dialog and sign-in launch checks substitute controlled main-process responses; they do not complete physical Windows dialogs or fresh human OAuth. Real inference uses the existing account without exporting credentials.

The exact note identifier from the reported screenshot was unavailable in the readable installed data-store views. Its contents were neither copied nor modified for testing. Formatting regressions were reproduced using synthetic structures; these checks do not establish that every possible rich document will apply. Existing conflict handling deliberately preserves original text when an exact safe insertion cannot be verified.

Fresh human sign-in, first-time administrator sandbox setup, every Codex desktop integration and other computers were not fully tested. Electron 44.7.0 and Codex CLI 0.160.0 are retained. Live project-work matrices beyond disposable note editing were not rerun. No perfection or future-compatibility guarantee is made.

Visual hiding does not conceal disk changes, processes, recording, authentication pages or system inspection. Notes and backups are not encrypted. Closing the app, crashes, sleep or network loss can interrupt work. A restore passphrase prevents accidental reveals; it does not secure an unlocked computer.
