import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:folder-multiple-image',
      order: 3,
      title: '项目管理',
    },
    name: 'ProjectManage',
    path: '/project',
    component: () => import('#/views/project/index.vue'),
  },
];

export default routes;
