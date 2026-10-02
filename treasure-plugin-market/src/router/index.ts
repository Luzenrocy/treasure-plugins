import { createRouter, createWebHistory } from 'vue-router';
import AdminConsoleView from '../views/AdminConsoleView.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', component: AdminConsoleView }, { path: '/admin', component: AdminConsoleView }],
});
