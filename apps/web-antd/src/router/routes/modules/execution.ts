import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:history',
      order: 102,
      title: 'page.execution.title',
    },
    name: 'Execution',
    path: '/execution',
    redirect: '/execution/list',
    children: [
      {
        name: 'ExecutionList',
        path: 'list',
        component: () => import('#/views/execution/list.vue'),
        meta: {
          icon: 'mdi:format-list-bulleted',
          title: 'page.execution.list',
        },
      },
      {
        name: 'ExecutionDetail',
        path: 'detail/:id',
        component: () => import('#/views/execution/detail.vue'),
        meta: {
          hideInMenu: true,
          title: 'page.execution.detail',
        },
      },
    ],
  },
];

export default routes;