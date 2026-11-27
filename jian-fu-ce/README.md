# 缄符册

缄符册是 Treasure 的本地私密资料库。它支持 API Key、密钥、Token、密码、提示词和文本，可以用标题、标签和备注查找条目，也可以收藏和快速复制常用内容。

## 安装与使用

在 Treasure 插件中心选择「导入插件包」，导入 [1.0.0 安装包](https://github.com/Luzenrocy/treasure-plugins/releases/download/plugin/jian-fu-ce/v1.0.0/jian-fu-ce.zip)。首次打开时设置主密码，再用「新建条目」录入资料。

四种凭据默认遮蔽，点击眼睛图标可显示内容。搜索框内按上下方向键切换条目，按回车复制当前条目的内容。关闭页面、切到后台或空闲五分钟后，资料库需要重新解锁。

1.0.0 提供本地资料库和条目管理。加密备份、恢复和回退仍在技术方案中。

## 数据存储

插件通过 Treasure SDK 在宿主分配的 SQLite 表中保存数据。浏览器 Web Crypto 通过 PBKDF2 从主密码派生密钥，并使用 AES-GCM 加密条目。插件身份为 `jian-fu-ce-mrkt7z`，对应的安装初始化脚本位于 `scripts/init/1.0.0.sql`。

## 界面

三处品牌图标统一采用「封签册」，宿主侧栏用单色版本继承当前菜单颜色。页面用暖米色区分顶栏（`#FCF9F4`）、侧栏（`#F5EEE5`）和详情（`#FFFCF8`），以紫罗兰色（`#65458D`）标记主操作，浅紫色（`#EDE5F4`）标记选中状态。深色模式随系统配色变化。

## 开发

使用 Node.js 22 和有权读取 GitHub Packages 中 Treasure SDK 的 `NODE_AUTH_TOKEN`。启动开发服务后，在 Treasure 插件中心注册调试地址。

```sh
npm ci --include=dev
npm run dev
npm run typecheck
npm test
npm run build:plugin:zip
```

安装包生成在 `build-output/jian-fu-ce.zip`。

[交互原型](../docs/vault-plugin/prototype/treasure-vault.html) · [技术架构](../docs/vault-plugin/technical-architecture.md) · [研发方案](../docs/vault-plugin/implementation/technical-plan.md) · [图标方案](../docs/vault-plugin/design/icon-options.html)
