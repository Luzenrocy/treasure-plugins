# Revision 1

The writer incorporated all accepted user decisions into the candidate draft:

- Target: publish only to `specs/004-excalidraw-plugin/spec.md`; the existing `003-prototype-source-parity` spec remains untouched.
- Scope: local core editor plus drawing files, official libraries, and image export; no collaboration, accounts, share links, or cloud sync.
- Integration: directly use the official `@excalidraw/excalidraw` editor code, with a Vue/Treasure SDK adapter; remote iframe and self-built canvas are excluded.
- Files: one configured directory, explicit save, unsaved-change prompts, and overwrite/external-change confirmation.
- Libraries: persist installed libraries in plugin-private storage and support offline reuse.
- Export: PNG/SVG baseline; advanced web parity options remain a documented planning decision because the user phrased exact parity as preferred.

Review findings R-001, R-002, R-004, R-005, R-006, and R-007 are fixed. R-003 is an accepted P2 planning risk with an explicit baseline and open options.
