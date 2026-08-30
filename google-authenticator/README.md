# 谷歌验证器

Treasure 的本地离线 TOTP / HOTP 客户端。发布目录与插件编码均为 `google-authenticator`，界面别名为“谷歌验证器”。

## 已实现能力

- 图片导入标准 `otpauth://` 和 Google Authenticator `otpauth-migration://` 转移二维码；Google 转移载荷在浏览器端解析 Protobuf，不上传图片或密钥。
- TOTP 使用单一共享时钟刷新全部账号；HOTP 点击“生成”时使用当前 counter 出码，并在加密保险库写入成功后推进 counter。
- 所有账号及密钥以主密码派生的 PBKDF2 + AES-256-GCM 密文写入 Treasure 私有存储；数据库只保存不含账号信息的保险库版本和更新时间。
- 支持加密备份导入导出、手动新增账号、发行方与类型筛选、右侧账号详情抽屉。
- 页面不可见时立即清除内存中的主密码、账号和验证码；停留在页面时不因空闲而锁定。

## 安全边界

- 不使用 `localStorage`、远程接口或服务端同步。
- 不支持相机实时扫码，也不生成仅用于显示的 `otpauth://` 二维码。
- 加密备份需使用相同主密码恢复；忘记主密码无法恢复密钥。

## 视觉

页面使用 Treasure 的暖米色 `#F5EFE4` 为基底、暖金 `#E8C98A` 作边界与品牌点缀，深紫 `#3D3450` 仅用于文字与少量结构强调。服务商分组使用 CSS 多列瀑布流；宽度增加时自动增加分组卡片列数，卡片高度按账号数量自然变化。

## 开发与构建

```bash
npm install
npm test
npm run typecheck
npm run build
npm run build:plugin
```

在 Treasure 中注册开发地址后，宿主将从 `/treasure-manifest.json` 和 `/scripts/init/` 读取插件契约和迁移脚本。
