# What is public, and what stays local

The public repository contains application source, synthetic test fixtures, icons, licenses and documentation. Its clean publication history does not include the developer's working directory or previous local Git history. Public commits use the repository owner's GitHub noreply address.

The Windows release is built from an explicit list of app files plus the official Electron and Codex runtimes and their dependencies. It does **not** copy an installed application profile or a Codex account folder. Packaging rejects private-data filenames, creates a per-file SHA-256 manifest, verifies every archived file, and publishes an archive checksum.

The repository ignores credentials, `.codex`, browser profiles, notes, document bindings, exported backups, local test profiles, logs, screenshots and generated release folders. A release check inspects the final publication inventory; `.gitignore` alone is not treated as proof that a package is clean.

Examples such as `fixture@example.invalid` and test note text are synthetic. They do not identify a real account or conversation. The public repository owner's username appears in repository and release links because those links identify the publisher.

## After you install

Each user signs in independently. Notes, conversation transcripts, attachments used by the app, file bindings and backups may contain personal information on that user's computer. Codex stores its own authentication and configuration under that Windows user's account. These local folders are separate from the program files and must not be uploaded or shared.

Your questions, attachments and requested project work use your own Codex account. There is no shared API key or bundled sign-in. The app contains no developer-account export, analytics endpoint or separate account-token reader.

Visual hiding does not encrypt documents or conceal system activity. In sidebar note-edit mode, accepted work can continue changing a real file on disk while the displayed note is frozen. Compact mode keeps replies out of the note until you explicitly insert them.
