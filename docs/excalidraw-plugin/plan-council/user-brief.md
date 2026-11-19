# User brief

> [$speckit-plan](/Volumes/MacExtend/FrontProjects/treasure-plugins/.agents/skills/speckit-plan/SKILL.md) [$writing-workshop](/Users/luzenrocy/.codex/skills/writing-workshop/SKILL.md)

Captured: 2026-10-16 Asia/Shanghai
Source: user message in the active Codex task

## Source feature context

The plan consumes the confirmed feature specification at `specs/004-excalidraw-plugin/spec.md`, which defines a local Excalidraw editor, SDK-backed drawing-directory file lifecycle, persistent offline libraries, PNG/SVG export, and explicit non-goals for collaboration, accounts, sharing, and cloud sync.

## Amendments

### 2026-10-18

用户指出当前 `treasure-menu-event` 仍是宿主内部兼容通道，并要求评估是否应通过 SDK 正式开放窗口菜单能力；用户建议由 SDK 与 Treasure 宿主同步调整，使插件可以自由注册窗口菜单，插件不直接依赖内部消息。
