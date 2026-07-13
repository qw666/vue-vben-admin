import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:flow-tree',
      order: 101,
      title: 'page.shuzhiliu.title',
    },
    name: 'ShuZhiLiu',
    path: '/workflow',
    redirect: '/workflow/list',
    children: [
      {
        name: 'ShuZhiLiuList',
        path: 'list',
        component: () => import('#/views/workflow/list.vue'),
        meta: {
          icon: 'mdi:format-list-bulleted',
          title: 'page.shuzhiliu.list',
        },
      },
      {
        name: 'ShuZhiLiuEditor',
        path: 'editor/:id?',
        component: () => import('#/views/workflow/editor.vue'),
        meta: {
          hideInMenu: true,
          title: 'page.shuzhiliu.editor',
        },
      },
    ],
  },
];

export default routes;
