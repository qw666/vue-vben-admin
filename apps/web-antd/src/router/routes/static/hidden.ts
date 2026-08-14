import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const BasicLayout = () => import('#/layouts/basic.vue');

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      hideInBreadcrumb: true,
      title: '数智流',
    },
    name: 'ShuzhiliuStatic',
    path: '/shuzhiliu',
    children: [
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
