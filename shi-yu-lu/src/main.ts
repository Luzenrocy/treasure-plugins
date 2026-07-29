import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import {
  Fold, Expand, Document, Folder,
  DocumentAdd, FolderAdd, Delete, Loading,
  Download, Close, Notebook, EditPen, View, Operation,
  ArrowRight,
} from '@element-plus/icons-vue';
import App from './App.vue';
import { initTreasure } from '@treasure/sdk';

const app = createApp(App);
// 注册所有图标到全局组件，模板中可直接通过字符串名使用 <el-icon><component :is="'Close'" /></el-icon>
const icons = { Fold, Expand, Document, Folder, DocumentAdd, FolderAdd, Delete, Loading, Download, Close, Notebook, EditPen, View, Operation, ArrowRight };
for (const [key, component] of Object.entries(icons)) {
  app.component(key, component);
}
app.use(ElementPlus);
initTreasure();
app.mount('#app');
