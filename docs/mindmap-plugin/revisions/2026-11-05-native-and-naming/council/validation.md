# 交付验证

- 当前规则及12个记录文件的路径、mtime、SHA256由 reviewer/checker 独立复核一致。
- U-001–U-006 均有覆盖，reviewer 无发现，checker approve。
- 结构校验通过；批准稿与发布目标SHA256完全相同：91cdae0a39eeee41e6d139222feb5f2aba428d24c941697e2843ab2bd4a8b1db。
- 文稿、交付索引、原型README共50个本地链接核验通过（查询参数按网页链接解析），无断链。最初检查器未剥离查询参数而产生的误报已修正。
- 原型 node --check 与 git diff --check 通过；历史主方案SHA未变。
- 原型交互与有效下载证据见 ../../../prototype/qa-external-preview.md；其结果不代表实际外部解析/磁盘持久化。
