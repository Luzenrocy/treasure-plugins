<template>
  <main class="app">
    <h1>我的插件</h1>
    <p>SDK 2.0 原子能力示例：选择文件、读取文件、选择导出目录并写入。</p>
    <div class="demo-actions">
      <button @click="chooseFile">选择并读取文件</button>
      <button :disabled="!selectedFile" @click="chooseOutputDirectory">选择目录并导出副本</button>
    </div>
    <pre class="demo-output">{{ output }}</pre>
  </main>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { files, type FileReference } from 'treasure-sdk';

export default defineComponent({
  name: 'App',
  data: () => ({ output: '', selectedFile: null as FileReference | null, bytes: new Uint8Array() }),
  methods: {
    async chooseFile() {
      const selected = await files.openDialog({ kind: 'file', title: '选择要读取的文件' });
      if (!selected.ok) { this.output = `${selected.error.code}: ${selected.error.message}`; return; }
      if (!Array.isArray(selected.value)) { this.output = '选择结果无效'; return; }
      const file = selected.value[0];
      if (!file) { this.output = '没有选择文件'; return; }
      const content = await files.readFile(file);
      if (!content.ok) { this.output = `${content.error.code}: ${content.error.message}`; return; }
      this.selectedFile = file;
      this.bytes = content.value;
      this.output = `已读取 ${file.name}（${content.value.byteLength} 字节）`;
    },
    async chooseOutputDirectory() {
      const selected = await files.openDialog({ kind: 'directory', title: '选择导出目录' });
      if (!selected.ok) { this.output = `${selected.error.code}: ${selected.error.message}`; return; }
      if (Array.isArray(selected.value)) { this.output = '选择结果无效'; return; }
      const exported = await files.writeFile({ directory: selected.value, fileName: this.selectedFile!.name, data: this.bytes });
      this.output = exported.ok ? `已导出 ${exported.value.name}` : `${exported.error.code}: ${exported.error.message}`;
    },
  },
});
</script>

<style>
html, body, #app { width: 100%; height: 100%; margin: 0; }
* { box-sizing: border-box; }
.app { padding: 20px; font-family: sans-serif; }
.demo-actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
.demo-actions button { padding: 6px 12px; cursor: pointer; }
.demo-output { background: #f5f5f5; padding: 12px; border-radius: 4px; white-space: pre-wrap; min-height: 60px; }
</style>
