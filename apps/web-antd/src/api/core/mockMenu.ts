import type { RouteRecordStringComponent } from '@vben/types';

const mockMenus = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    component: 'BasicLayout',
    meta: {
      hideInMenu: true,
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: '概览',
    },
    children: [
      {
        name: 'Analytics',
        path: 'analytics',
        component: '/dashboard/analytics/index',
        meta: {
          hideInMenu: true,
          icon: 'lucide:area-chart',
          title: '分析页',
        },
      },
    ],
  },
  {
    name: 'Home',
    path: '/home',
    component: '/home/index',
    meta: {
      affixTab: true,
      icon: 'mdi:home',
      order: 0,
      title: '首页',
    },
  },
  {
    name: 'Shuzhiliu',
    path: '/shuzhiliu',
    component: 'BasicLayout',
    meta: {
      icon: 'lucide:workflow',
      order: 1,
      title: '数智流',
    },
    children: [
      {
        name: 'WorkflowList',
        path: 'workflow/list',
        component: '/workflow/list',
        meta: {
          icon: 'lucide:layout-list',
          title: '流程编排',
        },
      },
      {
        name: 'WorkflowEditor',
        path: 'workflow/editor/:id?',
        component: '/workflow/editor',
        meta: {
          hideInMenu: true,
          title: '流程编辑',
        },
      },
      {
        name: 'ExecutionList',
        path: 'execution/list',
        component: '/execution/list',
        meta: {
          icon: 'lucide:history',
          title: '执行记录',
        },
      },
      {
        name: 'ExecutionDetail',
        path: 'execution/detail/:id',
        component: '/execution/detail',
        meta: {
          hideInMenu: true,
          title: '执行详情',
        },
      },
    ],
  },
  {
    name: 'Profile',
    path: '/profile',
    component: '/_core/profile/index',
    meta: {
      hideInMenu: true,
      title: '个人中心',
    },
  },
] as RouteRecordStringComponent[];

export { mockMenus };
