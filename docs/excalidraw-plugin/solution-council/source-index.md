# Source index

| ID | Source | Version/date | Used for |
|---|---|---|---|
| S-001 | Excalidraw UIOptions docs: https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/%40excalidraw/excalidraw/api/props/ui-options.mdx | accessed 2026-10-29; local dependency `@excalidraw/excalidraw@0.18.1` | `canvasActions.loadScene/saveToActiveFile/export`, no arbitrary toolbar slot, and visibility boundaries |
| S-002 | Excalidraw Props docs: https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/%40excalidraw/excalidraw/api/props/props.mdx | accessed 2026-10-29; local 0.18.1 typings | `renderTopRightUI`, `initialData`, `onChange`, `onLibraryChange`, `excalidrawAPI` |
| S-003 | Excalidraw utils docs: https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/%40excalidraw/excalidraw/api/utils/utils-intro.md | accessed 2026-10-29 | scene/library serialization and export utility boundaries |
| S-004 | Local type declarations: `/Volumes/MacExtend/FrontProjects/treasure-plugins/excalidraw/node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts` | package 0.18.1 | authoritative local signatures for the locked dependency; avoids assuming current main-branch names |
| S-005 | Treasure SDK API reference: `/Volumes/MacExtend/FrontProjects/treasure-sdk/docs/API-REFERENCE.md` | Treasure SDK 2.0; accessed 2026-10-29 | `files`, `directories`, `storage`, `settings`, `permissions`, Result/error model and private data location |
| S-006 | Treasure SDK development guide: `/Volumes/MacExtend/FrontProjects/treasure-sdk/docs/SDK-DEVELOPMENT-GUIDE.md` | accessed 2026-10-29 | public API boundary, no absolute paths/internal actions, manifest/template rules |
| S-007 | Plugin development guide: `/Volumes/MacExtend/FrontProjects/treasure-plugins/docs/PLUGIN-DEVELOPMENT-GUIDE.md` | repository version; accessed 2026-10-29 | Treasure UI/scrollbar style, manifest settings and plugin integration constraints |
| S-008 | Current Excalidraw plugin source and manifest under `/Volumes/MacExtend/FrontProjects/treasure-plugins/excalidraw/` | working tree on 2026-10-29 | confirms current pure-native shell, manifest `workspace_dir`, and locked dependency context; not a normative API source |

## Evidence handling

- S-001–S-004 are used for Excalidraw API claims; where master docs may differ, the local 0.18.1 type declaration wins for implementation compatibility.
- S-005–S-007 are used for Treasure integration claims. Any behavior not explicitly present there is marked `[Open question]` or `[Assumption]` in the final document.
- The official libraries URL is treated as user-provided configuration, not as a guarantee that every future response is compatible with the current parser.

