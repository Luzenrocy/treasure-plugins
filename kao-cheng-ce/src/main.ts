import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import {
  List, CircleCheck, CircleClose, Close, Search, Plus,
  Calendar, Edit, Delete, MoreFilled,
} from '@element-plus/icons-vue';
import App from './App.vue';
import { initTreasure } from 'treasure-sdk';
import { ReminderChecker } from './reminder';
import { db } from './db';

const app = createApp(App);

const icons = { List, CircleCheck, CircleClose, Close, Search, Plus, Calendar, Edit, Delete, MoreFilled };
for (const [key, component] of Object.entries(icons)) {
  app.component(key, component);
}
app.use(ElementPlus);
initTreasure();
// Best-effort retry for files left after a previous SQL/file compensation failure.
db.attachments.retryPendingCleanup().catch(() => {});
app.mount('#app');

const checker = new ReminderChecker();
checker.start();
export { checker };
