import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:workflow',
      order: 0,
      title: $t('page.execution.title'),
    },
    name: 'Shuzhiliu',
    path: '/shuzhiliu',
    redirect: '/shuzhiliu/workflow/list',
    children: [
      {
        name: 'WorkflowList',
        path: 'workflow/list',
        component: () => import('#/views/workflow/list.vue'),
        meta: {
          icon: 'mdi:format-list-bulleted',
          title: $t('page.execution.workflow'),
        },
      },
      {
        name: 'WorkflowEditor',
        path: 'workflow/editor/:id?',
        component: () => import('#/views/workflow/editor.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.execution.editor'),
        },
      },
      {
        name: 'ExecutionList',
        path: 'execution/list',
        component: () => import('#/views/execution/list.vue'),
        meta: {
          icon: 'mdi:history',
          title: $t('page.execution.list'),
        },
      },
      {
        name: 'ExecutionDetail',
        path: 'execution/detail/:id',
        component: () => import('#/views/execution/detail.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.execution.detail'),
        },
      },
    ],
  },
];

export default routes;
