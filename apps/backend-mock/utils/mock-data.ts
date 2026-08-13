export interface UserInfo {
  id: number;
  password: string;
  realName: string;
  roles: string[];
  username: string;
  homePath?: string;
  userId?: string;
  tenantId?: string;
}

export interface TimezoneOption {
  offset: number;
  timezone: string;
}

export const MOCK_USERS: UserInfo[] = [
  {
    id: 0,
    password: '123456',
    realName: 'Vben',
    roles: ['super'],
    userId: '1000',
    tenantId: 'tenant001',
    username: 'vben',
  },
  {
    id: 1,
    password: '123456',
    realName: 'Admin',
    roles: ['admin'],
    userId: '1001',
    tenantId: 'tenant001',
    username: 'admin',
    homePath: '/dashboard/workspace',
  },
  {
    id: 2,
    password: '123456',
    realName: 'Jack',
    roles: ['user'],
    userId: '1002',
    tenantId: 'tenant001',
    username: 'jack',
    homePath: '/dashboard/analytics',
  },
];

export const MOCK_CODES = [
  // super
  {
    codes: ['AC_100100', 'AC_100110', 'AC_100120', 'AC_100010'],
    username: 'vben',
  },
  {
    // admin
    codes: ['AC_100010', 'AC_100020', 'AC_100030'],
    username: 'admin',
  },
  {
    // user
    codes: ['AC_1000001', 'AC_1000002'],
    username: 'jack',
  },
];

const dashboardMenus = [
  {
    meta: {
      order: -1,
      title: 'page.dashboard.title',
    },
    name: 'Dashboard',
    path: '/dashboard',
    redirect: '/dashboard/analytics',
    children: [
      {
        name: 'Analytics',
        path: 'analytics',
        component: '/dashboard/analytics/index',
        meta: {
          affixTab: true,
          title: 'page.dashboard.analytics',
        },
      },
      {
        name: 'Workspace',
        path: 'workspace',
        component: '/dashboard/workspace/index',
        meta: {
          title: 'page.dashboard.workspace',
        },
      },
    ],
  },
];

const systemMenus = [
  {
    meta: {
      icon: 'ion:settings-outline',
      order: 9997,
      title: 'system.title',
    },
    name: 'System',
    path: '/system',
    children: [
      {
        name: 'SystemUser',
        path: 'user',
        component: '/system/user/list',
        meta: {
          icon: 'mdi:user',
          title: 'system.user.title',
        },
      },
      {
        name: 'SystemRole',
        path: 'role',
        component: '/system/role/list',
        meta: {
          icon: 'mdi:account-group',
          title: 'system.role.title',
        },
      },
      {
        name: 'SystemMenu',
        path: 'menu',
        component: '/system/menu/list',
        meta: {
          icon: 'mdi:menu',
          title: 'system.menu.title',
        },
      },
      {
        name: 'SystemDept',
        path: 'dept',
        component: '/system/dept/list',
        meta: {
          icon: 'charm:organisation',
          title: 'system.dept.title',
        },
      },
    ],
  },
];

const examplesMenus = [
  {
    meta: {
      icon: 'mdi:library',
      keepAlive: true,
      order: 100,
      title: 'examples.title',
    },
    name: 'Examples',
    path: '/examples',
    children: [
      {
        name: 'ExamplesForm',
        path: 'form',
        meta: {
          icon: 'mdi:form-select',
          title: 'examples.form.title',
        },
        redirect: '/examples/form/basic',
        children: [
          {
            name: 'ExamplesFormBasic',
            path: 'basic',
            component: '/examples/form/basic',
            meta: {
              icon: 'mdi:file-edit',
              title: 'examples.form.basic',
            },
          },
          {
            name: 'ExamplesFormDynamic',
            path: 'dynamic',
            component: '/examples/form/dynamic',
            meta: {
              icon: 'mdi:refresh',
              title: 'examples.form.dynamic',
            },
          },
          {
            name: 'ExamplesFormApi',
            path: 'api',
            component: '/examples/form/api',
            meta: {
              icon: 'mdi:api',
              title: 'examples.form.api',
            },
          },
        ],
      },
      {
        name: 'ExamplesTable',
        path: 'vxe-table',
        component: '/examples/vxe-table/basic',
        meta: {
          icon: 'mdi:table',
          title: 'examples.table.title',
        },
      },
      {
        name: 'ExamplesModal',
        path: 'modal',
        component: '/examples/modal/index',
        meta: {
          icon: 'mdi:clipboard-edit',
          title: 'examples.modal.title',
        },
      },
      {
        name: 'ExamplesDrawer',
        path: 'drawer',
        component: '/examples/drawer/index',
        meta: {
          icon: 'mdi:archive',
          title: 'examples.drawer.title',
        },
      },
    ],
  },
];

const workflowMenus = [
  {
    meta: {
      icon: 'mdi:workflow',
      keepAlive: true,
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
        component: '/workflow/list',
        meta: {
          icon: 'mdi:format-list-bulleted',
          title: 'page.shuzhiliu.list',
        },
      },
    ],
  },
];

const vbenMenus = [
  {
    meta: {
      badgeType: 'dot',
      icon: 'carbon:data-center',
      order: 9998,
      title: 'demos.vben.title',
    },
    name: 'Project',
    path: '/vben-admin',
    children: [
      {
        name: 'VbenDocument',
        path: 'document',
        component: 'IFrameView',
        meta: {
          icon: 'carbon:book',
          iframeSrc: 'https://doc.vben.pro',
          title: 'demos.vben.document',
        },
      },
      {
        name: 'VbenGithub',
        path: 'github',
        component: 'IFrameView',
        meta: {
          icon: 'carbon:logo-github',
          link: 'https://github.com/vbenjs/vue-vben-admin',
          title: 'Github',
        },
      },
    ],
  },
];

const aboutMenu = [
  {
    component: '_core/about/index',
    meta: {
      icon: 'lucide:copyright',
      order: 9999,
      title: 'demos.vben.about',
    },
    name: 'About',
    path: '/about',
  },
];

const createDemosMenus = (role: 'admin' | 'super' | 'user') => {
  const roleWithMenus = {
    admin: {
      component: '/demos/access/admin-visible',
      meta: {
        icon: 'mdi:button-cursor',
        title: 'demos.access.adminVisible',
      },
      name: 'AccessAdminVisibleDemo',
      path: 'admin-visible',
    },
    super: {
      component: '/demos/access/super-visible',
      meta: {
        icon: 'mdi:button-cursor',
        title: 'demos.access.superVisible',
      },
      name: 'AccessSuperVisibleDemo',
      path: 'super-visible',
    },
    user: {
      component: '/demos/access/user-visible',
      meta: {
        icon: 'mdi:button-cursor',
        title: 'demos.access.userVisible',
      },
      name: 'AccessUserVisibleDemo',
      path: 'user-visible',
    },
  };

  return [
    {
      meta: {
        icon: 'ic:baseline-view-in-ar',
        keepAlive: true,
        order: 1000,
        title: 'demos.title',
      },
      name: 'Demos',
      path: '/demos',
      redirect: '/demos/access',
      children: [
        {
          name: 'AccessDemos',
          path: 'access',
          meta: {
            icon: 'mdi:cloud-key-outline',
            title: 'demos.access.backendPermissions',
          },
          redirect: '/demos/access/page-control',
          children: [
            {
              name: 'AccessPageControlDemo',
              path: 'page-control',
              component: '/demos/access/index',
              meta: {
                icon: 'mdi:page-previous-outline',
                title: 'demos.access.pageAccess',
              },
            },
            {
              name: 'AccessButtonControlDemo',
              path: 'button-control',
              component: '/demos/access/button-control',
              meta: {
                icon: 'mdi:button-cursor',
                title: 'demos.access.buttonControl',
              },
            },
            {
              name: 'AccessMenuVisible403Demo',
              path: 'menu-visible-403',
              component: '/demos/access/menu-visible-403',
              meta: {
                authority: ['no-body'],
                icon: 'mdi:button-cursor',
                menuVisibleWithForbidden: true,
                title: 'demos.access.menuVisible403',
              },
            },
            roleWithMenus[role],
          ],
        },
      ],
    },
  ];
};

export const MOCK_MENUS = [
  {
    menus: [
      ...dashboardMenus,
      ...examplesMenus,
      ...systemMenus,
      ...workflowMenus,
      ...createDemosMenus('super'),
      ...vbenMenus,
      ...aboutMenu,
    ],
    username: 'vben',
  },
  {
    menus: [
      ...dashboardMenus,
      ...examplesMenus,
      ...systemMenus,
      ...workflowMenus,
      ...createDemosMenus('admin'),
      ...vbenMenus,
      ...aboutMenu,
    ],
    username: 'admin',
  },
  {
    menus: [
      ...dashboardMenus,
      ...examplesMenus,
      ...workflowMenus,
      ...createDemosMenus('user'),
      ...aboutMenu,
    ],
    username: 'jack',
  },
];

export const MOCK_MENU_LIST = [
  {
    id: 1,
    name: 'Workspace',
    status: 1,
    type: 'menu',
    icon: 'mdi:view-dashboard',
    path: '/workspace',
    component: '/dashboard/workspace/index',
    meta: {
      icon: 'carbon:workspace',
      title: 'page.dashboard.workspace',
      affixTab: true,
      order: 0,
    },
  },
  {
    id: 2,
    meta: {
      icon: 'carbon:settings',
      order: 9997,
      title: 'system.title',
      badge: 'new',
      badgeType: 'normal',
      badgeVariants: 'primary',
    },
    status: 1,
    type: 'catalog',
    name: 'System',
    path: '/system',
    children: [
      {
        id: 201,
        pid: 2,
        path: '/system/menu',
        name: 'SystemMenu',
        authCode: 'System:Menu:List',
        status: 1,
        type: 'menu',
        meta: {
          icon: 'carbon:menu',
          title: 'system.menu.title',
        },
        component: '/system/menu/list',
        children: [
          {
            id: 20_101,
            pid: 201,
            name: 'SystemMenuCreate',
            status: 1,
            type: 'button',
            authCode: 'System:Menu:Create',
            meta: { title: 'common.create' },
          },
          {
            id: 20_102,
            pid: 201,
            name: 'SystemMenuEdit',
            status: 1,
            type: 'button',
            authCode: 'System:Menu:Edit',
            meta: { title: 'common.edit' },
          },
          {
            id: 20_103,
            pid: 201,
            name: 'SystemMenuDelete',
            status: 1,
            type: 'button',
            authCode: 'System:Menu:Delete',
            meta: { title: 'common.delete' },
          },
        ],
      },
      {
        id: 202,
        pid: 2,
        path: '/system/dept',
        name: 'SystemDept',
        status: 1,
        type: 'menu',
        authCode: 'System:Dept:List',
        meta: {
          icon: 'carbon:container-services',
          title: 'system.dept.title',
        },
        component: '/system/dept/list',
        children: [
          {
            id: 20_401,
            pid: 202,
            name: 'SystemDeptCreate',
            status: 1,
            type: 'button',
            authCode: 'System:Dept:Create',
            meta: { title: 'common.create' },
          },
          {
            id: 20_402,
            pid: 202,
            name: 'SystemDeptEdit',
            status: 1,
            type: 'button',
            authCode: 'System:Dept:Edit',
            meta: { title: 'common.edit' },
          },
          {
            id: 20_403,
            pid: 202,
            name: 'SystemDeptDelete',
            status: 1,
            type: 'button',
            authCode: 'System:Dept:Delete',
            meta: { title: 'common.delete' },
          },
        ],
      },
    ],
  },
  {
    id: 9,
    meta: {
      badgeType: 'dot',
      order: 9998,
      title: 'demos.vben.title',
      icon: 'carbon:data-center',
    },
    name: 'Project',
    path: '/vben-admin',
    type: 'catalog',
    status: 1,
    children: [
      {
        id: 901,
        pid: 9,
        name: 'VbenDocument',
        path: '/vben-admin/document',
        component: 'IFrameView',
        type: 'embedded',
        status: 1,
        meta: {
          icon: 'carbon:book',
          iframeSrc: 'https://doc.vben.pro',
          title: 'demos.vben.document',
        },
      },
      {
        id: 902,
        pid: 9,
        name: 'VbenGithub',
        path: '/vben-admin/github',
        component: 'IFrameView',
        type: 'link',
        status: 1,
        meta: {
          icon: 'carbon:logo-github',
          link: 'https://github.com/vbenjs/vue-vben-admin',
          title: 'Github',
        },
      },
      {
        id: 903,
        pid: 9,
        name: 'VbenAntdv',
        path: '/vben-admin/antdv',
        component: 'IFrameView',
        type: 'link',
        status: 0,
        meta: {
          icon: 'carbon:hexagon-vertical-solid',
          badgeType: 'dot',
          link: 'https://ant.vben.pro',
          title: 'demos.vben.antdv',
        },
      },
    ],
  },
  {
    id: 10,
    component: '_core/about/index',
    type: 'menu',
    status: 1,
    meta: {
      icon: 'lucide:copyright',
      order: 9999,
      title: 'demos.vben.about',
    },
    name: 'About',
    path: '/about',
  },
];

export function getMenuIds(menus: any[]) {
  const ids: number[] = [];
  menus.forEach((item) => {
    ids.push(item.id);
    if (item.children && item.children.length > 0) {
      ids.push(...getMenuIds(item.children));
    }
  });
  return ids;
}

/**
 * 时区选项
 */
export const TIME_ZONE_OPTIONS: TimezoneOption[] = [
  {
    offset: -5,
    timezone: 'America/New_York',
  },
  {
    offset: 0,
    timezone: 'Europe/London',
  },
  {
    offset: 8,
    timezone: 'Asia/Shanghai',
  },
  {
    offset: 9,
    timezone: 'Asia/Tokyo',
  },
  {
    offset: 9,
    timezone: 'Asia/Seoul',
  },
];
