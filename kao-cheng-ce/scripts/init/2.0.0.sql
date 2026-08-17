-- SDK 2.0 附件补偿队列：数据库删除成功但私有文件删除失败时重试。
CREATE TABLE IF NOT EXISTS attachment_cleanup_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storage_key TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
