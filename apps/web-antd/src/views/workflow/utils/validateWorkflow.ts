import { flowControlNodeRegistry } from '../nodes/types';
import { getFlowControlConfig } from '../config/workflow-node-config';

import type { Workflow } from '#/types/workflow';

export interface ValidationError {
  message: string;
  nodeId?: string;
  nodeLabel?: string;
  edgeId?: string;
  type: 'warning' | 'error';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const START_NODE_TYPE = 'idp_core_flow_Start';
const END_NODE_TYPE = 'idp_core_flow_End';

export function getParentNodeFieldInfo(
  workflow: Workflow,
  nodeId: string,
): { parentId: string; field: string } | null {
  const edges = workflow.edges;

  // Collect all descendant node IDs starting from a direct child node
  const collectDescendants = (startId: string, visited: Set<string>): string[] => {
    const result: string[] = [];
    const downstreamEdges = edges.filter((e) => e.source === startId);
    for (const edge of downstreamEdges) {
      const targetNode = workflow.nodes.find((n) => n.id === edge.target);
      if (!targetNode) continue;
      if (targetNode.data.type === 'idp_core_flow_End') continue;
      if (flowControlNodeRegistry.isFlowControlContainer(targetNode.data.type)) continue;
      if (visited.has(targetNode.id)) continue;
      visited.add(targetNode.id);
      result.push(targetNode.id);
      result.push(...collectDescendants(targetNode.id, visited));
    }
    return result;
  };

  for (const node of workflow.nodes) {
    if (!flowControlNodeRegistry.isFlowControlContainer(node.data.type)) continue;

    const flowControlConfig = getFlowControlConfig(node.data.type);
    const taskFields = flowControlConfig.taskFields || [];

    for (const field of taskFields) {
      const configValue = node.data.config?.[field];
      let found = false;

      const checkItems = (items: any[]): boolean => {
        for (const item of items) {
          if (item.nodeId === nodeId) return true;
          if (item.nodeId) {
            const descendants = collectDescendants(item.nodeId, new Set<string>([item.nodeId]));
            if (descendants.includes(nodeId)) return true;
          }
        }
        return false;
      };

      if (Array.isArray(configValue)) {
        found = checkItems(configValue);
      } else if (typeof configValue === 'object' && configValue !== null) {
        for (const caseKey of Object.keys(configValue)) {
          const caseItems = configValue[caseKey];
          if (Array.isArray(caseItems) && checkItems(caseItems)) {
            found = true;
            break;
          }
        }
      }

      if (found) {
        return { parentId: node.id, field };
      }
    }
  }

  return null;
}

/**
 * 规则1: 画布只能1个开始、1个输出节点；开始无输入、输出无输出连线
 */
export function validateStartEndNodes(workflow: Workflow): ValidationError[] {
  const errors: ValidationError[] = [];

  const startNodes = workflow.nodes.filter(
    (n) => n.data.type === START_NODE_TYPE,
  );
  const endNodes = workflow.nodes.filter(
    (n) => n.data.type === END_NODE_TYPE,
  );

  if (startNodes.length === 0) {
    errors.push({ message: '流程缺少开始节点', type: 'error' });
  } else if (startNodes.length > 1) {
    errors.push({
      message: `流程只能有1个开始节点，当前有${startNodes.length}个`,
      type: 'error',
    });
  } else {
    const startNode = startNodes[0]!;
    const hasInput = workflow.edges.some((e) => e.target === startNode.id);
    if (hasInput) {
      errors.push({
        message: '开始节点不能有输入连线',
        nodeId: startNode.id,
        nodeLabel: startNode.data.label,
        type: 'error',
      });
    }
    const hasOutput = workflow.edges.some((e) => e.source === startNode.id);
    if (!hasOutput) {
      errors.push({
        message: '开始节点必须有输出连线',
        nodeId: startNode.id,
        nodeLabel: startNode.data.label,
        type: 'error',
      });
    }
  }

  if (endNodes.length === 0) {
    errors.push({ message: '流程缺少输出节点', type: 'error' });
  } else if (endNodes.length > 1) {
    errors.push({
      message: `流程只能有1个输出节点，当前有${endNodes.length}个`,
      type: 'error',
    });
  } else {
    const endNode = endNodes[0]!;
    const hasOutput = workflow.edges.some((e) => e.source === endNode.id);
    if (hasOutput) {
      errors.push({
        message: '输出节点不能有输出连线',
        nodeId: endNode.id,
        nodeLabel: endNode.data.label,
        type: 'error',
      });
    }
  }

  return errors;
}

/**
 * 规则2: 所有普通节点必须具备1输入连线、1输出连线
 * 容器内的普通节点可以没有输出，但必须有输入
 */
export function validateNodeConnections(workflow: Workflow): ValidationError[] {
  const errors: ValidationError[] = [];

  const normalNodes = workflow.nodes.filter(
    (n) =>
      n.data.type !== START_NODE_TYPE &&
      n.data.type !== END_NODE_TYPE &&
      !flowControlNodeRegistry.isFlowControlContainer(n.data.type),
  );

  for (const node of normalNodes) {
    const hasInput = workflow.edges.some((e) => e.target === node.id);
    const hasOutput = workflow.edges.some((e) => e.source === node.id);
    const parentInfo = getParentNodeFieldInfo(workflow, node.id);
    const isInsideContainer = parentInfo !== null;

    // 容器内节点：必须有输入，可以没有输出
    if (isInsideContainer) {
      if (!hasInput) {
        errors.push({
          message: `容器内节点「${node.data.label}」必须有输入连线`,
          nodeId: node.id,
          nodeLabel: node.data.label,
          type: 'error',
        });
      }
    } else {
      // 普通节点：必须有输入和输出
      if (!hasInput) {
        errors.push({
          message: `节点「${node.data.label}」缺少输入连线`,
          nodeId: node.id,
          nodeLabel: node.data.label,
          type: 'error',
        });
      }
      if (!hasOutput) {
        errors.push({
          message: `节点「${node.data.label}」缺少输出连线`,
          nodeId: node.id,
          nodeLabel: node.data.label,
          type: 'error',
        });
      }
    }
  }

  return errors;
}

/**
 * 规则3: 所有容器in锚点必须接入连线
 */
export function validateContainerInPorts(workflow: Workflow): ValidationError[] {
  const errors: ValidationError[] = [];

  const containerNodes = workflow.nodes.filter((n) =>
    flowControlNodeRegistry.isFlowControlContainer(n.data.type),
  );

  for (const container of containerNodes) {
    const config = getFlowControlConfig(container.data.type);
    const inputPorts = config.ports.input || 0;

    for (let i = 0; i < inputPorts; i++) {
      const handleId = `${container.id}-input-${i}`;
      const hasEdge = workflow.edges.some(
        (e) => e.targetHandle === handleId || e.target === container.id,
      );

      if (!hasEdge) {
        errors.push({
          message: `容器「${container.data.label}」的in锚点必须接入连线`,
          nodeId: container.id,
          nodeLabel: container.data.label,
          type: 'error',
        });
      }
    }
  }

  return errors;
}

/**
 * 规则4: 禁止悬空连线、节点自环
 */
export function validateEdgeIntegrity(workflow: Workflow): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(workflow.nodes.map((n) => n.id));

  for (const edge of workflow.edges) {
    // 悬空连线：source 或 target 节点不存在
    if (!nodeIds.has(edge.source)) {
      errors.push({
        message: '存在悬空连线：源节点不存在',
        edgeId: edge.id,
        type: 'error',
      });
      continue;
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        message: '存在悬空连线：目标节点不存在',
        edgeId: edge.id,
        type: 'error',
      });
      continue;
    }

    // 节点自环
    if (edge.source === edge.target) {
      errors.push({
        message: '存在节点自环连线',
        edgeId: edge.id,
        type: 'error',
      });
      continue;
    }
  }

  return errors;
}

/**
 * 规则5: 所有层级不能存在完全孤立、无任何连线的游离节点
 */
export function validateNoIsolatedNodes(workflow: Workflow): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of workflow.nodes) {
    // 开始和输出节点除外
    if (node.data.type === START_NODE_TYPE || node.data.type === END_NODE_TYPE) {
      continue;
    }

    const hasInput = workflow.edges.some((e) => e.target === node.id);
    const hasOutput = workflow.edges.some((e) => e.source === node.id);
    const parentInfo = getParentNodeFieldInfo(workflow, node.id);
    const isInsideContainer = parentInfo !== null;

    // 容器内的节点不算孤立（通过容器的config关联）
    if (isInsideContainer) {
      continue;
    }

    if (!hasInput && !hasOutput) {
      errors.push({
        message: `节点「${node.data.label}」是孤立节点，无任何连线`,
        nodeId: node.id,
        nodeLabel: node.data.label,
        type: 'error',
      });
    }
  }

  return errors;
}

/**
 * 规则6: 画布必须存在路径：开始节点连通到输出节点
 */
export function validateConnectivity(workflow: Workflow): ValidationError[] {
  const errors: ValidationError[] = [];

  const startNode = workflow.nodes.find(
    (n) => n.data.type === START_NODE_TYPE,
  );
  const endNode = workflow.nodes.find(
    (n) => n.data.type === END_NODE_TYPE,
  );

  if (!startNode || !endNode) {
    return errors;
  }

  // 构建邻接表（从 source 到 target 的有向图）
  const adjacency = new Map<string, Set<string>>();
  for (const node of workflow.nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of workflow.edges) {
    if (adjacency.has(edge.source) && adjacency.has(edge.target)) {
      adjacency.get(edge.source)!.add(edge.target);
    }
  }

  // BFS 从开始节点搜索到输出节点的路径
  const visited = new Set<string>();
  const queue: string[] = [startNode.id];
  visited.add(startNode.id);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endNode.id) {
      return errors; // 找到路径
    }

    const neighbors = adjacency.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  // 同时检查容器内部的连通性
  // 对于容器节点，需要从容器的子节点中找到一条路径到输出节点
  // 这里简单处理：如果开始节点无法到达输出节点，检查容器分支

  errors.push({
    message: '开始节点无法连通到输出节点，缺少有效路径',
    type: 'error',
  });

  return errors;
}

export function validateAll(workflow: Workflow): ValidationResult {
  const errors: ValidationError[] = [];

  // 规则1: 开始/输出节点数量和连接
  errors.push(...validateStartEndNodes(workflow));

  if (errors.length === 0) {
    // 规则2: 普通节点连接校验
    errors.push(...validateNodeConnections(workflow));
  }

  // 规则3: 容器in锚点校验
  errors.push(...validateContainerInPorts(workflow));

  // 规则4: 连线合法性
  errors.push(...validateEdgeIntegrity(workflow));

  // 规则5: 孤立节点检查
  errors.push(...validateNoIsolatedNodes(workflow));

  if (errors.length === 0) {
    // 规则6: 连通性检查
    errors.push(...validateConnectivity(workflow));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((e) => e.message).join('\n');
}
