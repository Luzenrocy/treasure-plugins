# 来源与概念图机械校验

记录时间：2026-11-04T14:30:38.243578+00:00

该检查只验证链接形态/本地存在与图像语法，不代表远端服务可用、文件兼容或产品测试。

- source-engines.md: 32 个不同 HTTP(S) 来源 URL；SHA-256 `8828c324ebea739a68e7565499fa47220adf1cff1d29e443f00a16a34240300c`。
- source-xmind.md: 33 个不同 HTTP(S) 来源 URL；SHA-256 `3c8381d233acc0b34f94e216ab9f650c13a1b87718195d2411ca64f63fb9d1a1`。
- source-local.md: 0 个不同 HTTP(S) 来源 URL；SHA-256 `a9f9e72ee5f63955eaf627a9c5d1365abe6e1c41b1228168cbc18d5928c0caf7`。
- SVG XML 可解析，PNG 1440×960 已渲染并目视检查，标签/中文/分栏/节点与连线清晰。
- 未运行候选引擎、宿主或商业客户端；性能与往返验收仍为文档所列后续门槛。

- 本地证据完整性：12 个已取证文件重新比对 SHA-256，变更 0；本次未修改既有业务源码。

## 最终草稿检查（iteration 03，2026-11-04T15:17:31.430129+00:00）

- 主文358行，52956 UTF-8 bytes；SHA-256 `ad36cd91945a211eb111e208259447284f610f321459dfef61e104b796413b38`。
- 69个正文链接检查，本地目标缺失0；HTTP(S)链接不以形态检查冒称实时可用性。
- 14个hard需求覆盖齐全；3次迭代coverage与input-snapshot均为可解析JSON（合法YAML）。
- SVG/PNG跨3次迭代逐字节一致，保留已目视检查的版本；12个本地来源文件最终SHA重核均未变。
- 当前12个技能规则重新读取、SHA/mtime匹配；未发生规则重载。

## 发布后校验（2026-11-04T15:20:11.749715+00:00）

- `validate_council.py /Volumes/MacExtend/FrontProjects/treasure-plugins/docs/mindmap-plugin/council`：exit 0，`OK`。
- 主文、SVG和PNG与iteration03批准稿逐字节相同；主文SHA-256 `ad36cd91945a211eb111e208259447284f610f321459dfef61e104b796413b38`。
- 交付索引所有本地链接存在；最终manifest status=published、iteration=3；无unresolved.md。
- 独立checker最终 `approve`，R1-001/R1-002关闭；PoC/兼容/性能测试仍未执行。

## 继续交付复核（2026-11-05，Asia/Shanghai）

- UTC记录时刻：2026-11-05T01:19:37.931459+00:00。
- 主文358行、69个正文链接本地检查通过，14个hard需求覆盖齐全；12规则指纹未变。
- 独立delivery audit确认主文/SVG/PNG与iteration03批准稿逐字节一致、最终approve与published状态有效、交付索引47个本地链接存在。
- 复核未修改批准正文、资产或原有业务源码，未开展新的网络调研、PoC或业务开发。
