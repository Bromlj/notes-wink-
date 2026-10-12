# What is public, and what stays local

The public repository contains application source, synthetic test fixtures, icons, licenses and documentation. Its clean publication history does not include the developer's working directory or earlier local Git history. Public commits use the repository owner's GitHub noreply address.

The Windows release is built from an explicit list of app files plus the official Electron and Codex runtimes and dependencies. It does **not** copy an installed application profile or a Codex account folder. Packaging rejects private-data filenames, creates a per-file SHA-256 manifest, verifies archived files and publishes an archive checksum.

The repository ignores credentials, `.codex`, browser profiles, notes, document bindings, exported backups, local test profiles, logs, generated screenshots and release folders. Its only documentation screenshots are two deliberately created examples: **`docs/images/own-account.png`**, showing the signed-out Account page, and **`docs/images/notes-for-self.png`**, showing made-up note text. Neither contains a real account, private file path or conversation. These two explicit publication inputs are checked separately; other screenshots remain excluded.

A release check inspects the final publication inventory. `.gitignore` alone is not treated as proof that a package is clean. Examples such as `fixture@example.invalid` and fixture note text are synthetic. The public repository owner's username appears in repository and release links because it identifies the publisher.

## After you install

Each user signs in independently. Notes, conversation transcripts, attachments, file bindings and backups can contain that user's personal information. Codex stores authentication and configuration under that Windows user's account. These local folders are separate from the program files and must not be uploaded or shared.

Your questions, attachments and requested project work use your own Codex account and allowance. There is no shared API key or bundled sign-in. The app contains no developer-account export, analytics endpoint or separate account-token reader. Being signed in to the ChatGPT website alone does not authenticate the app's Codex runtime.

**Share the original release ZIP or repository link, not your installed data folder, Codex home or exported backups.** Backups can include private note text and conversations. Imported backups do not carry permission to edit a new installation's files or automatically apply revisions; those permissions require a new local opt-in.

## What the compact checkboxes permit

The first compact checkbox permits the next request to read and edit the current real note file and use its containing folder. The second permits automatic application of that request's completed note revision while compact mode is unlocked. Both start off for a new note and are separate from the full sidebar's Edit this note option. Neither can grant permission retrospectively to an already running request.

A permitted note-edit task can change the real disk file before its completed revision is shown. With automatic application off, Alt+I applies the revision to the displayed note. With it on before submission, the completed revision can appear automatically if the option is still enabled and the note, binding and disk content pass their guards. Newer local changes, moved files and disk conflicts are preserved for review. Ordinary replies are never appended automatically.

**Alt+Q hides the AI controls and dot and freezes visible AI note updates.** Accepted file and project work can continue on disk. Hidden automatic completion waits until compact mode is restored and unlocked before attempting to update the displayed note. Project edits save directly and do not wait for Alt+I. Unrelated command, access and service approvals always require the user's decision; neither checkbox accepts them.

Visual hiding does not encrypt documents, hide processes, stop recordings or conceal system activity. An optional restore passphrase prevents accidental reveals; it does not secure an unlocked computer. To stop accepted work, use Stop explicitly rather than relying on the display shortcut.
