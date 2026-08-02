# Treasure Plugin Scaffold

> Treasure 插件最小参考实现，也是 `treasure-sdk create` 生成项目的结构基线。

该目录不是面向最终用户发布的业务工具。它展示一个插件从 manifest、SDK 初始化、文件能力调用到 `.treasure-plugin` 打包的最小闭环，供新插件复制和二次开发。

## 适用场景

- 学习 Treasure 插件的目录和安装包结构；
- 验证 SDK 文件 API 在独立开发与宿主环境中的行为；
- 作为自定义插件的起点，而不是向已有业务插件复制相对路径或业务代码。

## 原型与功能

当前演示页提供创建目录、创建文件、读取、更新与删除文件的按钮，并显示调用结果。它刻意保持简单：重点是展示 SDK 调用边界，而非提供完整产品功能。

```text
演示页面 → treasure-sdk file 模块 → Treasure 宿主文件能力
```

## 工程结构

```text
treasure-plugin/
├── src/App.vue                 # 最小文件操作演示
├── src/main.ts                 # SDK 初始化与 Vue 挂载
├── manifest.json               # 示例插件元数据
├── scripts/init/1.0.0.sql      # 生命周期脚本占位
├── scripts/destroy.sql
└── scripts/build-plugin.mjs     # 目录包 / ZIP 打包
```

## 色彩方案

脚手架采用中性、低装饰的演示样式，避免将其误认为业务插件的视觉规范。新插件应根据业务建立自身色彩方案，并参考 [Treasure 宿主视觉参考](../docs/TREASURE-HOST-DESIGN.md) 保持与工作区的协调。

## 使用方式

```bash
npm install
npm run dev

# 生成可导入的目录包
npm run build:plugin
```

开始新插件时，推荐使用：

```bash
npx treasure-sdk create my-plugin --alias "我的插件"
```

完整研发流程见 [插件研发指南](../docs/PLUGIN-DEVELOPMENT-GUIDE.md)，SDK 方法见 [API 参考](https://github.com/Luzenrocy/treasure-sdk/blob/main/docs/API-REFERENCE.md)。
