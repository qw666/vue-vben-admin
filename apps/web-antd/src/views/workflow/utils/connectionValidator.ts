/**
 * 连接验证工具
 * 集中管理所有节点连接的业务规则
 *
 * 当前规则：
 * 1. 源节点不能连接自身
 * 2. 容器的分支端口（then/else/cases/errors/finally）不能直接连接结束节点
 * 3. 容器内节点不能直接连接结束节点
 * 4. finally/errors 字段下的节点及其下游节点不能连接结束节点
 *
 * 后续可扩展的规则：
 * - 节点类型间的连接限制
 * - 特定端口的连接数量限制
 * - 循环依赖检测
 */

import { flowControlNodeRegistry } from '../nodes/types';
import { findAncestorContainerIds, findAncestorContainerLocations } from '../nodes/containerNodeAccessor';
import { getFlowControlConfig } from '../config/workflow-node-config';
import type { Workflow } from '#/types/workflow';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * 判断节点是否是结束节点
 * End 节点（category: 'end'）
 */
function isEndNode(nodeType: string): boolean {
  const strategy = flowControlNodeRegistry.get(nodeType);
  return strategy?.config?.category === 'end';
}

/**
 * 获取容器节点的分支端口字段列表
 * 分支端口：除了 next 之外的所有 output 端口
 */
function getBranchPortFields(nodeType: string): string[] {
  const config = getFlowControlConfig(nodeType);
  if (!config?.ports?.output) return [];

  return config.ports.output
    .filter((port: any) => port.field !== 'next')
    .map((port: any) => port.field);
}

/**
 * 判断端口是否是分支端口（处理动态端口如 cases-CASE_1）
 * @param sourcePortId 源端口ID（如 Switch_xxx-output-cases-CASE_1）
 */
function isBranchPort(nodeType: string, sourcePortId: string): boolean {
  const config = getFlowControlConfig(nodeType);
  if (!config?.ports?.output) return false;

  // 从 sourcePortId 提取字段名
  // 格式：{nodeId}-output-{field} 或 {nodeId}-output-{field}-{caseKey}
  const portField = sourcePortId.replace(/-output-/, '-').split('-')[1];
  if (!portField) return false;

  const branchPorts = getBranchPortFields(nodeType);
  return branchPorts.includes(portField);
}

/**
 * 需要阻止连接结束节点的特殊字段
 */
const BLOCKED_FIELDS = ['finally', 'errors'];

/**
 * 判断节点是否在特殊字段下（finally/errors）
 * 或者是这些字段下节点的下游节点
 */
function isInBlockedFieldOrDescendant(
  workflow: Workflow,
  nodeId: string,
): boolean {
  // 1. 检查节点本身是否在特殊字段下
  const locations = findAncestorContainerLocations(workflow, nodeId);
  const isInBlockedField = locations.some((loc) => BLOCKED_FIELDS.includes(loc.field));
  if (isInBlockedField) return true;

  // 2. 检查节点的上游是否有在特殊字段下的节点
  const edges = workflow.edges || [];
  const visited = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // 查找当前节点的上游节点
    const upstreamEdges = edges.filter((e) => e.target === currentId);
    for (const edge of upstreamEdges) {
      // 检查上游节点是否在特殊字段下
      const upstreamLocations = findAncestorContainerLocations(workflow, edge.source);
      if (upstreamLocations.some((loc) => BLOCKED_FIELDS.includes(loc.field))) {
        return true;
      }
      // 继续向上游遍历
      if (!visited.has(edge.source)) {
        queue.push(edge.source);
      }
    }
  }

  return false;
}

/**
 * 集中连接验证函数
 * 所有连接规则在此定义，便于维护和扩展
 *
 * @param workflow 工作流数据
 * @param sourceNodeId 源节点ID（发起连接的节点）
 * @param targetNodeId 目标节点ID（接受连接的节点）
 * @param sourcePortId 源端口ID（可选，用于判断端口类型）
 * @returns 验证结果
 */
export function validateConnection(
  workflow: Workflow,
  sourceNodeId: string,
  targetNodeId: string,
  sourcePortId?: string,
): ValidationResult {
  // 获取节点
  const sourceNode = workflow.nodes.find((n: any) => n.id === sourceNodeId);
  const targetNode = workflow.nodes.find((n: any) => n.id === targetNodeId);

  if (!sourceNode || !targetNode) {
    return { valid: false, reason: '节点不存在' };
  }

  // 规则1: 源 ≠ 目标
  if (sourceNodeId === targetNodeId) {
    return { valid: false, reason: '不能连接自身' };
  }

  // 只有目标是结束节点时才需要进一步验证
  if (!isEndNode(targetNode.data.type)) {
    return { valid: true };
  }

  // 规则2: 容器的分支端口不能直接连接结束节点
  if (sourcePortId && flowControlNodeRegistry.isFlowControlContainer(sourceNode.data.type)) {
    if (isBranchPort(sourceNode.data.type, sourcePortId)) {
      return {
        valid: false,
        reason: '容器分支端口不能直接连接结束节点，请先添加子节点',
      };
    }
  }

  // 规则3: 容器内节点不能直接连接结束节点
  const ancestorContainers = findAncestorContainerIds(workflow, sourceNodeId);
  if (ancestorContainers.length > 0) {
    return {
      valid: false,
      reason: '容器内节点不能直接连接结束节点，请先连接回容器节点',
    };
  }

  // 规则4: finally/errors 字段下的节点及其下游节点不能连接结束节点
  if (isInBlockedFieldOrDescendant(workflow, sourceNodeId)) {
    return {
      valid: false,
      reason: 'finally/errors 分支下的节点不能直接连接结束节点',
    };
  }

  return { valid: true };
}
