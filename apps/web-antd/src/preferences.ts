import logoUrl from '#/assets/images/logo.png';
import avatarUrl from '#/assets/images/avatar.svg';
import {
  appCopyrightPreferences,
  defineOverridesPreferences,
} from '@vben/preferences';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  app: {
    accessMode: 'backend',
    defaultAvatar: avatarUrl,
    layout: 'sidebar-nav',
    name: import.meta.env.VITE_APP_TITLE,
  },
  copyright: {
    ...appCopyrightPreferences,
    enable: false,
  },
  logo: {
    source: logoUrl,
  },
  widget: {
    fullscreen: false,
    globalSearch: false,
    languageToggle: false,
    refresh: false,
    themeToggle: false,
    timezone: false,
  },
});
