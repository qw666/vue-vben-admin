/**
 * 节点图标解析
 *
 * 约定：
 * - 后端在节点的 `icon` 字段中存储图标名。
 * - 若图标名**不含前缀**（如 `variable-assembly`），前端自动补 `biz:`，即渲染 `biz:variable-assembly`。
 * - 若图标名**已含前缀**（如 `mdi:repeat`、`lucide:workflow`），按原样渲染，支持复用其他图标集。
 * - 若为空则回退到默认图标，保证动态加载的节点始终有 logo。
 * - 若图标名以 `biz:` 为前缀但在 biz-icons.json 中找不到，回退到默认图标。
 *
 * 新增动态节点的套路：
 * 1. 在 `apps/web-antd/src/assets/icons/biz-icons.json` 中设计并追加一个图标（prefix 为 `biz`）。
 * 2. 后端在该节点的 `icon` 字段返回图标名（如 `variable-assembly`，无需前缀）。
 * 3. 前端无需改动，自动渲染。
 */

import bizIcons from '#/assets/icons/biz-icons.json';

// 默认节点图标：当后端未返回 icon 时使用
export const DEFAULT_NODE_ICON = 'biz:node-default';

// 业务图标前缀（当后端只返回图标名不含前缀时自动补上）
const BIZ_PREFIX = 'biz:';

// 收集所有已注册的 biz 图标名称
const registeredBizIcons = new Set(Object.keys(bizIcons.icons || {}));

/**
 * 检查图标是否为有效的 biz 图标
 * @param icon 完整的图标名称（含前缀）
 */
function isValidBizIcon(icon: string): boolean {
  if (!icon.startsWith(BIZ_PREFIX)) {
    return true; // 非 biz 前缀的图标（如 mdi:、lucide:）不检查
  }
  const iconName = icon.slice(BIZ_PREFIX.length);
  return registeredBizIcons.has(iconName);
}

/**
 * 解析节点图标：
 * - 为空 → 默认图标
 * - biz 前缀但找不到 → 默认图标
 * - 已含其他前缀（mdi:、lucide:） → 原样返回
 * - 无前缀 → 自动补 biz: 前缀，找不到则用默认
 * @param icon 后端返回的图标名称
 */
export function resolveNodeIcon(icon?: null | string): string {
  if (!icon || !icon.trim()) {
    return DEFAULT_NODE_ICON;
  }
  const trimmed = icon.trim();

  // 已含前缀
  if (trimmed.includes(':')) {
    // biz 前缀：检查是否存在
    if (trimmed.startsWith(BIZ_PREFIX) && !isValidBizIcon(trimmed)) {
      return DEFAULT_NODE_ICON;
    }
    return trimmed;
  }

  // 无前缀，自动补 biz:
  const fullIcon = BIZ_PREFIX + trimmed;
  if (!isValidBizIcon(fullIcon)) {
    return DEFAULT_NODE_ICON;
  }
  return fullIcon;
}
