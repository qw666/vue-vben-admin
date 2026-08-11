/**
 * ContainerNodeAccessor: 统一封装容器节点（Switch/If/ForEach/Parallel/Subflow）
 * 的 task 字段访问逻辑。
 *
 * 解决的问题：容器字段遍历逻辑散落在 5+ 个文件中，新增容器类型时需要
 * 同时修改多处硬编码的字段列表。此文件作为唯一入口，所有容器相关操作
 * 走这一个 API。
 *
 * 字段类型说明：
 * - 数组字段（connectionType: 'list'/'single'）：如 tasks, then, else, defaults, errors, finally
 *   config[field] = TaskItem[]
 * - 对象字段（connectionType: 'cases'）：如 cases
 *   config[field] = Record<string, TaskItem[]>
 */

import { forEachTaskField, findTaskField } from './taskFieldUtils';
import { flowControlNodeRegistry } from './types';
import { getFlowControlConfig } from '../config/workflow-node-config';
import type { Workflow } from '#/types/workflow';

// ============== 类型定义 ==============

export interface TaskItem {
  type: string;
  nodeId: string;
  label: string;
  [key: string]: any;
}

export interface ChildLocation {
  field: string;
  caseKey?: string; // 仅对象字段（cases）有
  item: TaskItem;
}

// ============== 读取操作 ==============

/**
 * 获取容器 config 中所有子节点的 ID（不含嵌套 chain nodes）。
 * 遍历所有 taskFields，收集 nodeId。
 */
export function getAllChildIds(
  config: Record<string, any>,
  taskFields: string[],
): string[] {
  const ids: string[] = [];
  taskFields.forEach((field) => {
    forEachTaskField(config?.[field], (item) => {
      if (item?.nodeId && !ids.includes(item.nodeId)) {
        ids.push(item.nodeId);
      }
    });
  });
  return ids;
}

/**
 * 获取子节点在容器 config 中的位置。
 * 返回 field + caseKey（如果是对象字段）+ item 本身。
 */
export function findChildLocation(
  config: Record<string, any>,
  taskFields: string[],
  childId: string,
): ChildLocation | null {
  for (const field of taskFields) {
    let found: ChildLocation | null = null;
    forEachTaskField(config?.[field], (item, caseKey) => {
      if (item?.nodeId === childId) {
        found = { field, caseKey, item: item as TaskItem };
      }
    });
    if (found) return found;
  }
  return null;
}

/**
 * 获取所有子节点的位置信息（用于批量操作）。
 */
export function getAllChildLocations(
  config: Record<string, any>,
  taskFields: string[],
): ChildLocation[] {
  const locations: ChildLocation[] = [];
  taskFields.forEach((field) => {
    forEachTaskField(config?.[field], (item, caseKey) => {
      if (item?.nodeId) {
        locations.push({ field, caseKey, item: item as TaskItem });
      }
    });
  });
  return locations;
}

/**
 * 获取容器分支信息（用于 VarPicker 上游变量检测）。
 * 每个数组字段的元素是独立分支，对象字段的每个 caseKey 是独立分支。
 */
export function getContainerBranches(
  config: Record<string, any>,
  taskFields: string[],
  edges?: Array<{ source: string; target: string }>,
): Array<{ branchKey: string; nodeIds: string[] }> {
  const branches: Array<{ branchKey: string; nodeIds: string[] }> = [];

  for (const field of taskFields) {
    const value = config?.[field];
    if (!value) continue;

    if (Array.isArray(value)) {
      // 数组字段：每个元素是独立分支
      for (const item of value) {
        if (item?.nodeId) {
          branches.push({ branchKey: `${field}.${item.nodeId}`, nodeIds: [item.nodeId] });
        }
      }
    } else if (typeof value === 'object') {
      // 对象字段（如 cases）：每个 caseKey 是独立分支
      for (const [caseKey, items] of Object.entries(value)) {
        if (Array.isArray(items)) {
          const nodeIds = items.filter((t: any) => t?.nodeId).map((t: any) => t.nodeId);
          if (nodeIds.length > 0) {
            branches.push({ branchKey: `${field}.${caseKey}`, nodeIds });
          }
        }
      }
    }
  }

  // 扩展链式后代节点
  if (edges && edges.length > 0) {
    for (const branch of branches) {
      const expanded = new Set<string>(branch.nodeIds);
      const queue = [...branch.nodeIds];
      while (queue.length > 0) {
        const id = queue.shift()!;
        for (const edge of edges) {
          if (edge.source === id && !expanded.has(edge.target)) {
            expanded.add(edge.target);
            queue.push(edge.target);
          }
        }
      }
      branch.nodeIds = Array.from(expanded);
    }
  }

  return branches;
}

/**
 * 查找子节点是否在容器的某个分支中。
 * 用于判断"当前节点在容器的哪个分支内"。
 */
export function findBranchOfChild(
  config: Record<string, any>,
  taskFields: string[],
  childId: string,
  edges?: Array<{ source: string; target: string }>,
): { branchKey: string; nodeIds: string[] } | null {
  const branches = getContainerBranches(config, taskFields, edges);
  return branches.find((b) => b.nodeIds.includes(childId)) || null;
}

// ============== 写入操作（直接 mutate config） ==============

/**
 * 在容器 config 中添加子节点引用。
 * @returns 如果添加成功返回 true，如果节点已存在返回 false
 */
export function addChildToConfig(
  config: Record<string, any> | undefined,
  taskFields: string[],
  fieldKey: string,
  childItem: TaskItem,
): boolean {
  if (!config) return false;
  if (!taskFields.includes(fieldKey)) return false;

  const currentValue = config[fieldKey];

  if (Array.isArray(currentValue)) {
    // 数组字段
    const existing = currentValue.find((item: any) => item.nodeId === childItem.nodeId);
    if (existing) return false;
    currentValue.push(childItem);
    return true;
  }

  if (typeof currentValue === 'object' && currentValue !== null) {
    // 对象字段（如 cases）：推送到所有 caseKey 的数组中
    let added = false;
    for (const caseKey of Object.keys(currentValue)) {
      const caseItems = currentValue[caseKey];
      if (Array.isArray(caseItems)) {
        const existing = caseItems.find((item: any) => item.nodeId === childItem.nodeId);
        if (existing) return false;
        caseItems.push(childItem);
        added = true;
      }
    }
    return added;
  }

  // 字段不存在或为 null/undefined，初始化为数组
  config[fieldKey] = [childItem];
  return true;
}

/**
 * 从容器 config 中移除子节点引用。
 * 只修改实际包含该子节点的字段，不会清空其他字段。
 */
export function removeChildFromConfig(
  config: Record<string, any> | undefined,
  taskFields: string[],
  childId: string,
): void {
  taskFields.forEach((field) => {
    const currentValue = config?.[field];
    if (!currentValue) return;

    if (Array.isArray(currentValue)) {
      const filtered = currentValue.filter((item: any) => item?.nodeId !== childId);
      if (filtered.length !== currentValue.length) {
        config[field] = filtered;
      }
    } else if (typeof currentValue === 'object' && currentValue !== null) {
      let changed = false;
      for (const caseKey of Object.keys(currentValue)) {
        const caseItems = currentValue[caseKey];
        if (Array.isArray(caseItems)) {
          const filtered = caseItems.filter((item: any) => item?.nodeId !== childId);
          if (filtered.length !== caseItems.length) {
            currentValue[caseKey] = filtered;
            changed = true;
          }
        }
      }
      if (changed) {
        config[field] = currentValue;
      }
    }
  });
}

/**
 * 更新容器 config 中指定子节点的属性。
 */
export function updateChildInConfig(
  config: Record<string, any> | undefined,
  taskFields: string[],
  childId: string,
  updater: (item: TaskItem) => void,
): void {
  taskFields.forEach((field) => {
    const item = findTaskField(config?.[field], (it: any) => it.nodeId === childId);
    if (item) {
      updater(item as TaskItem);
    }
  });
}

/**
 * 重写容器 config 中所有 nodeId 引用（用于节点 ID 重命名）。
 */
export function rewriteNodeIdsInConfig(
  config: Record<string, any> | undefined,
  taskFields: string[],
  oldId: string,
  newId: string,
): void {
  taskFields.forEach((field) => {
    const value = config?.[field];
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach((item: any) => {
        if (item && item.nodeId === oldId) item.nodeId = newId;
      });
    } else if (typeof value === 'object') {
      for (const caseKey of Object.keys(value)) {
        const arr = value[caseKey];
        if (Array.isArray(arr)) {
          arr.forEach((item: any) => {
            if (item && item.nodeId === oldId) item.nodeId = newId;
          });
        }
      }
    }
  });
}

/**
 * 遍历容器 config 中的所有子节点引用。
 * 统一 forEachTaskField + 过滤 excludeFields 的逻辑。
 */
export function forEachChild(
  config: Record<string, any>,
  taskFields: string[],
  excludeFields: string[],
  callback: (item: TaskItem, field: string, caseKey?: string) => void,
): void {
  taskFields.forEach((field) => {
    if (excludeFields.includes(field)) return;
    forEachTaskField(config?.[field], (item, caseKey) => {
      if (item?.nodeId) {
        callback(item as TaskItem, field, caseKey);
      }
    });
  });
}

/**
 * 映射容器 config 中的所有子节点引用。
 * 与 forEachChild 类似，但收集返回值。
 */
export function mapChildren<T>(
  config: Record<string, any>,
  taskFields: string[],
  excludeFields: string[],
  callback: (item: TaskItem, field: string, caseKey?: string) => T | null | undefined,
): T[] {
  const results: T[] = [];
  taskFields.forEach((field) => {
    if (excludeFields.includes(field)) return;
    forEachTaskField(config?.[field], (item, caseKey) => {
      if (item?.nodeId) {
        const result = callback(item as TaskItem, field, caseKey);
        if (result !== null && result !== undefined) {
          results.push(result);
        }
      }
    });
  });
  return results;
}

// ============== 便捷方法 ==============

/**
 * 计算容器节点的排除字段列表。
 * 用于排除 next 字段和 excludeFromBounds 字段。
 */
export function getExcludeFields(
  taskFields: string[],
  ports?: Array<{ field: string; excludeFromBounds?: boolean }>,
): string[] {
  const exclude = ['next'];
  if (ports) {
    ports.forEach((port) => {
      if (port.excludeFromBounds) {
        exclude.push(port.field);
      }
    });
  }
  return exclude.filter((f) => taskFields.includes(f));
}

// ============== 祖先容器查找 ==============

/**
 * 查找节点的所有祖先容器ID（递归向上查找）
 * 用于：连接验证、权限检查等需要判断节点是否在任意容器内的场景
 *
 * @param workflow 工作流数据
 * @param nodeId 节点ID
 * @returns 所有祖先容器ID数组（从直接父容器到最外层）
 */
export function findAncestorContainerIds(
  workflow: Workflow,
  nodeId: string,
): string[] {
  const result: string[] = [];
  const nodes = workflow.nodes || [];

  // 构建快速查询索引：nodeId → 直接父容器ID
  const childToParentMap = new Map<string, string>();

  for (const node of nodes) {
    if (!flowControlNodeRegistry.isFlowControlContainer(node.data.type)) continue;

    const config = node.data.config || {};
    const flowControlConfig = getFlowControlConfig(node.data.type);
    const taskFields = flowControlConfig.taskFields || [];
    const excludeFields = getExcludeFields(taskFields, flowControlConfig.ports?.output);

    // 只遍历非排除字段（排除 next 等字段）
    const activeFields = taskFields.filter(f => !excludeFields.includes(f));

    // 遍历所有 activeFields，建立子节点→父容器的映射
    for (const field of activeFields) {
      forEachTaskField(config[field], (item) => {
        if (item?.nodeId) {
          childToParentMap.set(item.nodeId, node.id);
        }
      });
    }
  }

  // 递归向上查找所有祖先容器
  let currentId: string | undefined = nodeId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const parentId = childToParentMap.get(currentId);
    if (parentId) {
      result.push(parentId);
      currentId = parentId;
    } else {
      break;
    }
  }

  return result;
}

/**
 * 节点在容器中的位置信息
 */
export interface ContainerLocation {
  containerId: string;
  field: string; // 所在字段名（如 'tasks', 'cases', 'errors', 'finally'）
  caseKey?: string; // 仅对象字段（cases）有
}

/**
 * 查找节点在哪个容器的哪个字段下（递归向上查找）
 * 用于判断节点是否在特殊字段（如 finally、errors）下
 *
 * @param workflow 工作流数据
 * @param nodeId 节点ID
 * @returns 节点所在的容器位置信息数组（从直接父容器到最外层）
 */
export function findAncestorContainerLocations(
  workflow: Workflow,
  nodeId: string,
): ContainerLocation[] {
  const result: ContainerLocation[] = [];
  const nodes = workflow.nodes || [];

  // 构建快速查询索引：nodeId → 容器位置信息
  const childToLocationMap = new Map<string, ContainerLocation>();

  for (const node of nodes) {
    if (!flowControlNodeRegistry.isFlowControlContainer(node.data.type)) continue;

    const config = node.data.config || {};
    const flowControlConfig = getFlowControlConfig(node.data.type);
    const taskFields = flowControlConfig.taskFields || [];

    // 遍历所有 taskFields（包括 finally、errors 等特殊字段）
    for (const field of taskFields) {
      forEachTaskField(config[field], (item, caseKey) => {
        if (item?.nodeId) {
          childToLocationMap.set(item.nodeId, {
            containerId: node.id,
            field,
            caseKey,
          });
        }
      });
    }
  }

  // 递归向上查找所有祖先容器位置
  let currentId: string | undefined = nodeId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const location = childToLocationMap.get(currentId);
    if (location) {
      result.push(location);
      currentId = location.containerId;
    } else {
      break;
    }
  }

  return result;
}
