<template>
  <div class="app">
    <h1>{{ title }}</h1>
    <p>插件已加载</p>
    <div class="demo-section">
      <h2>文件操作演示</h2>
      <div class="demo-actions">
        <button @click="demoCreateDir">创建文件夹</button>
        <button @click="demoCreateFile">创建文件</button>
        <button @click="demoReadFile">读取文件</button>
        <button @click="demoUpdateFile">更新文件</button>
        <button @click="demoDeleteFile">删除文件</button>
        <button @click="demoDeleteDir">删除文件夹</button>
      </div>
      <pre class="demo-output">{{ output }}</pre>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { file } from '@treasure/sdk';

export default defineComponent({
  name: 'App',
  data() {
    return {
      title: '我的插件',
      output: '',
      demoDir: '/plugins/my-plugin/demo',
      demoFile: '/plugins/my-plugin/demo/hello.md',
    };
  },
  methods: {
    async demoCreateDir() {
      const res = await file.createDir(this.demoDir);
      this.output = `createDir: ${JSON.stringify(res)}`;
    },
    async demoCreateFile() {
      const res = await file.createFile(this.demoFile, '# Hello Plugin');
      this.output = `createFile: ${JSON.stringify(res)}`;
    },
    async demoReadFile() {
      const res = await file.readFile(this.demoFile);
      this.output = `readFile: ${JSON.stringify(res)}`;
    },
    async demoUpdateFile() {
      const res = await file.updateFile(this.demoFile, '# Updated Content');
      this.output = `updateFile: ${JSON.stringify(res)}`;
    },
    async demoDeleteFile() {
      const res = await file.deleteFile(this.demoFile);
      this.output = `deleteFile: ${JSON.stringify(res)}`;
    },
    async demoDeleteDir() {
      const res = await file.deleteDir(this.demoDir, { recursive: true });
      this.output = `deleteDir: ${JSON.stringify(res)}`;
    },
  },
});
</script>

<style>
html, body, #app { width: 100%; height: 100%; margin: 0; }
* { box-sizing: border-box; }
.app { display: flex; flex-direction: column; height: 100%; padding: 20px; font-family: sans-serif; }
.demo-section { flex: 1; min-height: 0; overflow: auto; }
.demo-actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
.demo-actions button { padding: 6px 12px; cursor: pointer; }
.demo-output { background: #f5f5f5; padding: 12px; border-radius: 4px; white-space: pre-wrap; min-height: 60px; }
</style>
