# 持久决定

- A-01/U-015：以 Treasure 插件为默认宿主，仅用公开 SDK。
- A-02/U-016：.smm 默认 SimpleMindMap JSON 方言，必须明确同名格式识别。
- D-01/U-017：发布主文件 technical-ui-proposal.md，过程 council/。
- D-02/U-018：阶段与不做项是方案建议，无用户默示批准。
- 既有 excalidraw/package.json 与 docs/excalidraw-plugin/ 含用户未提交变更，不更改。

## 最终方案与裁决

- ADR-01：SimpleMindMap优先PoC，Mind Elixir并行对照；低维护fork责任是采用门槛。
- ADR-03：普通.smm单图保存，多sheet推荐自定义.treasuremind包，原始Xmind保留，不承诺无损回写。
- R1-001：同会话token/最新修订/临时内容锁保证四种离开路径，iteration2修订、iteration3复核关闭。
- R1-002：删除只可在remove调用前取消，发出后锁到实际结果，iteration3关闭。
- 最终round1 iteration3 checker approve，主文和概念图已按manifest发布；原有业务源码未改。
