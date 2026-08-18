import type { Ref } from 'vue';
import type { WorkflowEdge, WorkflowNode } from '#/types/workflow';

import { computed } from 'vue';

import { UI_CONFIG } from '../../workflow/config/ui-config';
import { flowControlNodeRegistry } from '../../workflow/nodes/FlowControlNodeRegistry';
import { calculateBezierPath } from '../../workflow/composables/useCanvasPorts/connectionPath';

const NODE_WIDTH = UI_CONFIG.node.width;
const NODE_HEIGHT = UI_CONFIG.node.height;

/** 执行状态 → 边框颜色 */
const STATE_BORDER_COLOR: Record<string, string> = {
  SUCCESS: '#22c55e',
  FAILED: '#ef4444',
  RUNNING: '#3b82f6',
  CREATED: '#9ca3af',
  WARNING: '#f59e0b',
};

/** 执行状态 → 角标图标 */
const STATE_BADGE_ICON: Record<string, string> = {
  SUCCESS: 'mdi:check-circle',
  FAILED: 'mdi:alert-circle',
  RUNNING: 'mdi:progress-helper',
  CREATED: 'mdi:clock-outline',
  WARNING: 'mdi:alert',
};

/** 执行状态 → 角标背景色 */
const STATE_BADGE_COLOR: Record<string, string> = {
  SUCCESS: '#22c55e',
  FAILED: '#ef4444',
  RUNNING: '#3b82f6',
  CREATED: '#9ca3af',
  WARNING: '#f59e0b',
};

export interface GroupBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useExecutionCanvas(
  nodes: Ref<WorkflowNode[]>,
  edges: Ref<WorkflowEdge[]>,
) {
  /** 判断是否为容器节点 */
  function isContainerNode(node: WorkflowNode): boolean {
    return flowControlNodeRegistry.isFlowControlContainer(node?.data?.type);
  }

  /** 容器节点列表 */
  const containerNodes = computed(() =>
    nodes.value.filter((n) => isContainerNode(n)),
  );

  /** 计算连线路径（纯函数，不依赖 store） */
  function getConnectionPath(conn: WorkflowEdge): string {
    const sourceNode = nodes.value.find((n) => n.id === conn.source);
    const targetNode = nodes.value.find((n) => n.id === conn.target);
    if (!sourceNode || !targetNode) return '';

    // 从 sourceHandle 推断输出端口位置（底部或右侧）
    const isRightPort = conn.sourceHandle?.includes('-output-error') ||
      conn.sourceHandle?.includes('-output-right');
    const sourcePos = isRightPort
      ? { x: sourceNode.position.x + NODE_WIDTH, y: sourceNode.position.y + NODE_HEIGHT / 2 }
      : { x: sourceNode.position.x + NODE_WIDTH / 2, y: sourceNode.position.y + NODE_HEIGHT };

    const targetPos = {
      x: targetNode.position.x + NODE_WIDTH / 2,
      y: targetNode.position.y,
    };

    return calculateBezierPath(sourcePos, targetPos);
  }

  /** 计算容器节点分组边界（直接从 nodes 数组算，不依赖 store） */
  function getGroupBounds(nodeId: string): GroupBounds | null {
    const node = nodes.value.find((n) => n.id === nodeId);
    if (!node) return null;

    // 找到所有 parentId/config 中引用了该 nodeId 的子节点
    // 容器节点的子节点在 edges 中 source === nodeId
    const childIds = new Set<string>();
    for (const edge of edges.value) {
      if (edge.source === nodeId) {
        childIds.add(edge.target);
      }
    }

    // 递归找后代
    const allDescendantIds = new Set<string>();
    const queue = [...childIds];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (allDescendantIds.has(id)) continue;
      allDescendantIds.add(id);
      for (const edge of edges.value) {
        if (edge.source === id) {
          queue.push(edge.target);
        }
      }
    }

    const allNodes = [
      node,
      ...[...allDescendantIds]
        .map((id) => nodes.value.find((n) => n.id === id))
        .filter(Boolean),
    ].filter(Boolean) as WorkflowNode[];

    if (allNodes.length === 0) return null;

    let minX = node.position.x;
    let minY = node.position.y;
    let maxX = node.position.x + NODE_WIDTH;
    let maxY = node.position.y + NODE_HEIGHT;

    for (const n of allNodes) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
      maxY = Math.max(maxY, n.position.y + NODE_HEIGHT);
    }

    const padding = UI_CONFIG.group.padding;
    const bottomMargin = UI_CONFIG.group.bottomMargin;

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding + bottomMargin,
    };
  }

  /** 获取节点状态边框颜色 */
  function getStatusBorderColor(
    nodeId: string,
    taskStates?: Record<string, string>,
  ): string | undefined {
    const state = taskStates?.[nodeId];
    return state ? STATE_BORDER_COLOR[state] : undefined;
  }

  /** 获取节点状态角标图标 */
  function getStatusBadgeIcon(
    nodeId: string,
    taskStates?: Record<string, string>,
  ): string | undefined {
    const state = taskStates?.[nodeId];
    return state ? STATE_BADGE_ICON[state] : undefined;
  }

  /** 获取节点状态角标颜色 */
  function getStatusBadgeColor(
    nodeId: string,
    taskStates?: Record<string, string>,
  ): string | undefined {
    const state = taskStates?.[nodeId];
    return state ? STATE_BADGE_COLOR[state] : undefined;
  }

  /** 构建 taskId → state.current 映射 */
  function buildTaskStateMap(
    taskRunList: Array<{ taskId: string; state: { current: string } }>,
  ): Record<string, string> {
    const map: Record<string, string> = {};
    for (const task of taskRunList) {
      if (task.taskId && task.state?.current) {
        map[task.taskId] = task.state.current;
      }
    }
    return map;
  }

  return {
    containerNodes,
    isContainerNode,
    getConnectionPath,
    getGroupBounds,
    getStatusBorderColor,
    getStatusBadgeIcon,
    getStatusBadgeColor,
    buildTaskStateMap,
    NODE_WIDTH,
    NODE_HEIGHT,
  };
}
