import type { RouteRecordStringComponent } from '@vben/types';

const mockMenus = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    component: 'BasicLayout',
    meta: {
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
          affixTab: true,
          icon: 'lucide:area-chart',
          title: '分析页',
        },
      },
      {
        name: 'Workspace',
        path: 'workspace',
        component: '/dashboard/workspace/index',
        meta: {
          icon: 'carbon:workspace',
          title: '工作台',
        },
      },
    ],
  },
  {
    name: 'Shuzhiliu',
    path: '/shuzhiliu',
    component: 'BasicLayout',
    meta: {
      icon: 'lucide:workflow',
      order: 0,
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
    name: 'Demos',
    path: '/demos',
    component: 'BasicLayout',
    meta: {
      icon: 'ic:baseline-view-in-ar',
      order: 1000,
      title: '演示',
    },
    children: [
      {
        name: 'AntDesignDemos',
        path: 'ant-design',
        component: '/demos/antd/index',
        meta: {
          title: 'Ant Design',
        },
      },
    ],
  },
  {
    name: 'VbenProject',
    path: '/vben-admin',
    component: 'BasicLayout',
    meta: {
      icon: 'mdi:github',
      order: 9998,
      title: 'Vben Admin',
    },
    children: [
      {
        name: 'VbenDocument',
        path: 'document',
        component: '/_core/fallback/not-found',
        meta: {
          link: 'https://doc.vben.pro',
          title: '文档',
        },
      },
      {
        name: 'VbenGithub',
        path: 'github',
        component: '/_core/fallback/not-found',
        meta: {
          link: 'https://github.com/vbenjs/vue-vben-admin',
          title: 'Github',
        },
      },
      {
        name: 'VbenAntdVNext',
        path: 'antdv-next',
        component: '/_core/fallback/not-found',
        meta: {
          link: 'https://antdv-next.vben.pro',
          title: 'AntdV Next',
        },
      },
      {
        name: 'VbenNaive',
        path: 'naive',
        component: '/_core/fallback/not-found',
        meta: {
          link: 'https://naive.vben.pro',
          title: 'Naive UI',
        },
      },
      {
        name: 'VbenTDesign',
        path: 'tdesign',
        component: '/_core/fallback/not-found',
        meta: {
          link: 'https://tdesign.vben.pro',
          title: 'TDesign',
        },
      },
      {
        name: 'VbenElementPlus',
        path: 'element-plus',
        component: '/_core/fallback/not-found',
        meta: {
          link: 'https://ele.vben.pro',
          title: 'Element Plus',
        },
      },
    ],
  },
  {
    name: 'VbenAbout',
    path: '/vben-admin/about',
    component: '/_core/about/index',
    meta: {
      icon: 'mdi:information',
      order: 9999,
      title: '关于',
    },
  },
] as RouteRecordStringComponent[];

export { mockMenus };
