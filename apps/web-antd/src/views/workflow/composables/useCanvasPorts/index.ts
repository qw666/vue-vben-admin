import { useWorkflowStore } from '#/store/workflow';
import type { WorkflowNode } from '#/types/workflow';
import { getFlowControlConfig } from '../../config/workflow-node-config';
import type { NodePort, GroupBounds } from '../../types/workflow';

import { resolveInputPortConfig, resolveOutputPorts, needsGroupBounds } from './portConfig';
import {
  calculateInputPosition,
  calculateBottomOutputPosition,
  calculateNextOutputPosition,
  calculateRightOutputPosition,
  calculateDefaultOutputPosition,
} from './portPosition';
import { calculateGroupBounds } from './groupBounds';
import { calculateBezierPath, getConnectionColor as getColor } from './connectionPath';

export type { ResolvedInputPort, ResolvedOutputPort, ResolvedOutputPorts } from './portConfig';
export type { PositionInput } from './portPosition';

/**
 * 获取节点的所有端口
 *
 * 核心设计：
 * 1. 数据驱动：输入端口完全由 ports.input 配置决定，不再依赖 isFlowControlContainer 判断
 * 2. 与输出端口逻辑一致：统一由配置控制端口显示/隐藏
 *
 * @param nodeId 节点ID
 * @param nodeType 节点类型
 * @returns 端口数组
 */
export function getNodePorts(nodeId: string, nodeType: string): NodePort[] {
  const node = useWorkflowStore().currentWorkflow?.nodes.find((n) => n.id === nodeId) as
    | WorkflowNode
    | undefined;
  if (!node) return [];

  const ports: NodePort[] = [];
  const config = getFlowControlConfig(nodeType);

  // 数据驱动：完全由 ports.input 决定是否显示输入端口
  const inputConfig = resolveInputPortConfig(config);
  if (inputConfig.visible) {
    const groupBounds = needsGroupBounds(config) ? calculateGroupBounds(nodeId) : null;
    const position = calculateInputPosition({
      nodePosition: node.position,
      groupBounds,
    });

    ports.push({
      id: `${nodeId}-input`,
      nodeId,
      type: 'input',
      label: '输入',
      position,
      color: '#64748b',
    });
  }

  // 输出端口处理
  const { bottomOutputs, rightOutputs, nextOutput } = resolveOutputPorts(config, node);

  // 底部输出端口
  if (bottomOutputs.length === 1) {
    const out = bottomOutputs[0]!;
    const position = calculateBottomOutputPosition({
      nodePosition: node.position,
      portIndex: 0,
      portTotal: 1,
    });
    ports.push({
      id: out.id,
      nodeId,
      type: 'output',
      label: out.label,
      portGroup: out.portGroup,
      position,
      color: out.color,
    });
  } else if (bottomOutputs.length > 1) {
    bottomOutputs.forEach((out, i) => {
      const position = calculateBottomOutputPosition({
        nodePosition: node.position,
        portIndex: i,
        portTotal: bottomOutputs.length,
      });
      ports.push({
        id: out.id,
        nodeId,
        type: 'output',
        label: out.label,
        portGroup: out.portGroup,
        position,
        color: out.color,
      });
    });
  }

  // next 输出端口
  if (nextOutput) {
    const groupBounds = needsGroupBounds(config) ? calculateGroupBounds(nodeId) : null;
    const position = calculateNextOutputPosition({
      nodePosition: node.position,
      groupBounds,
    });
    ports.push({
      id: nextOutput.id,
      nodeId,
      type: 'output',
      label: nextOutput.label,
      portGroup: nextOutput.portGroup,
      position,
      color: nextOutput.color,
    });
  }

  // 右侧输出端口（errors/finally）
  if (rightOutputs.length > 0) {
    const groupBounds = needsGroupBounds(config) ? calculateGroupBounds(nodeId) : null;
    rightOutputs.forEach((out, i) => {
      const position = calculateRightOutputPosition({
        nodePosition: node.position,
        groupBounds,
        portIndex: i,
        portTotal: rightOutputs.length,
      });
      ports.push({
        id: out.id,
        nodeId,
        type: 'output',
        label: out.label,
        portGroup: out.portGroup,
        position,
        color: out.color,
      });
    });
  }

  // 无配置时的降级方案（仅当 output 字段不存在时）
  if (!config.ports?.output) {
    const position = calculateDefaultOutputPosition(node.position);
    ports.push({
      id: `${nodeId}-output`,
      nodeId,
      type: 'output',
      label: '输出',
      position,
      color: '#3b82f6',
    });
  }

  return ports;
}

/**
 * 获取端口位置
 *
 * 复用 getNodePorts 的逻辑，消除重复代码
 *
 * @param nodeId 节点ID
 * @param portId 端口ID
 * @returns 端口位置
 */
export function getPortPosition(nodeId: string, portId: string): { x: number; y: number } {
  const node = useWorkflowStore().currentWorkflow?.nodes.find((n) => n.id === nodeId) as
    | WorkflowNode
    | undefined;
  if (!node) return { x: 0, y: 0 };

  const config = getFlowControlConfig(node.data.type);

  // 输入端口
  if (portId === `${nodeId}-input`) {
    const groupBounds = needsGroupBounds(config) ? calculateGroupBounds(nodeId) : null;
    return calculateInputPosition({
      nodePosition: node.position,
      groupBounds,
    });
  }

  // 默认输出端口（无配置）
  if (portId === `${nodeId}-output`) {
    return calculateDefaultOutputPosition(node.position);
  }

  // 配置化的输出端口
  if (config && config.ports.output && portId.startsWith(`${nodeId}-output-`)) {
    const field = portId.replace(`${nodeId}-output-`, '');
    const { bottomOutputs, rightOutputs, nextOutput } = resolveOutputPorts(config, node);

    // next 端口
    if (nextOutput && field === nextOutput.field) {
      const groupBounds = needsGroupBounds(config) ? calculateGroupBounds(nodeId) : null;
      return calculateNextOutputPosition({
        nodePosition: node.position,
        groupBounds,
      });
    }

    // bottom 端口
    let bottomIndex = bottomOutputs.findIndex((o) => o.field === field);
    if (bottomIndex < 0) {
      const dynamicField = config.ports.output.find((o) => o.dynamic && field.startsWith(o.field + '-'));
      if (dynamicField) {
        bottomIndex = bottomOutputs.findIndex((o) => o.field === `${dynamicField.field}-add`);
      }
    }
    if (bottomIndex >= 0) {
      if (bottomOutputs.length === 1) {
        return calculateBottomOutputPosition({
          nodePosition: node.position,
          portIndex: 0,
          portTotal: 1,
        });
      }
      return calculateBottomOutputPosition({
        nodePosition: node.position,
        portIndex: bottomIndex,
        portTotal: bottomOutputs.length,
      });
    }

    // right 端口
    const rightIndex = rightOutputs.findIndex((o) => o.field === field);
    if (rightIndex >= 0) {
      const groupBounds = needsGroupBounds(config) ? calculateGroupBounds(nodeId) : null;
      return calculateRightOutputPosition({
        nodePosition: node.position,
        groupBounds,
        portIndex: rightIndex,
        portTotal: rightOutputs.length,
      });
    }
  }

  // 降级方案
  return calculateDefaultOutputPosition(node.position);
}

/**
 * 获取分组边界
 */
export function getGroupBounds(nodeId: string, visited: Set<string> = new Set()): GroupBounds | null {
  return calculateGroupBounds(nodeId, visited);
}

/**
 * 计算连线路径
 */
export function getConnectionPath(
  sourceId: string,
  targetId: string,
  sourcePortId?: string,
  targetPortId?: string,
): string {
  let sourcePortPos: { x: number; y: number };
  let targetPortPos: { x: number; y: number };

  if (sourcePortId && targetPortId) {
    sourcePortPos = getPortPosition(sourceId, sourcePortId);
    targetPortPos = getPortPosition(targetId, targetPortId);
  } else {
    sourcePortPos = getPortPosition(sourceId, `${sourceId}-output`);
    targetPortPos = getPortPosition(targetId, `${targetId}-input`);
  }

  return calculateBezierPath(sourcePortPos, targetPortPos);
}

/**
 * 获取连线颜色
 */
export function getConnectionColor(conn: { source: string; sourceHandle: string }): string {
  return getColor(conn);
}
