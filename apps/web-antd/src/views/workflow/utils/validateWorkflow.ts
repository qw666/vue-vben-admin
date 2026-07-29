import { flowControlNodeRegistry } from '../nodes/types';
import { getFlowControlConfig } from '../config/workflow-node-config';

import type { Workflow } from '#/types/workflow';

export interface ValidationError {
  message: string;
  nodeId?: string;
  nodeLabel?: string;
  type: 'warning' | 'error';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const TERMINAL_FIELDS = ['errors', 'finally'];

export function getParentNodeFieldInfo(
  workflow: Workflow,
  nodeId: string,
): { parentId: string; field: string } | null {
  for (const node of workflow.nodes) {
    if (!flowControlNodeRegistry.isFlowControlNode(node.data.type)) continue;

    const flowControlConfig = getFlowControlConfig(node.data.type);
    const taskFields = flowControlConfig.taskFields || [];

    for (const field of taskFields) {
      const configValue = node.data.config?.[field];
      let found = false;

      if (Array.isArray(configValue)) {
        found = configValue.some((item: any) => item.nodeId === nodeId);
      } else if (typeof configValue === 'object' && configValue !== null) {
        for (const caseKey of Object.keys(configValue)) {
          const caseItems = configValue[caseKey];
          if (
            Array.isArray(caseItems) &&
            caseItems.some((item: any) => item.nodeId === nodeId)
          ) {
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

export function validateWorkflowName(name: string): ValidationError | null {
  if (!name || !name.trim()) {
    return {
      message: '请填写流程名称',
      type: 'error',
    };
  }
  return null;
}

export function validateStartNode(workflow: Workflow): ValidationError | null {
  const startNode = workflow.nodes.find(
    (n) => n.data.type === 'idp_core_flow_Start',
  );

  if (!startNode) {
    return {
      message: '流程缺少开始节点',
      type: 'error',
    };
  }

  const hasOutput = workflow.edges.some((e) => e.source === startNode.id);
  if (!hasOutput) {
    return {
      message: '开始节点必须连接到其他节点',
      type: 'error',
    };
  }

  return null;
}

export function validateEndNode(workflow: Workflow): ValidationError | null {
  const endNode = workflow.nodes.find(
    (n) => n.data.type === 'idp_core_flow_End',
  );

  if (!endNode) {
    return {
      message: '流程缺少输出节点',
      type: 'error',
    };
  }

  const hasOutput = workflow.edges.some((e) => e.source === endNode.id);
  if (hasOutput) {
    return {
      message: '输出节点不能连接到其他节点',
      type: 'error',
    };
  }

  const hasInput = workflow.edges.some((e) => e.target === endNode.id);
  if (!hasInput) {
    return {
      message: '输出节点必须有输入连接',
      type: 'error',
    };
  }

  return null;
}

export function validateMinNodes(workflow: Workflow): ValidationError | null {
  if (workflow.nodes.length <= 2) {
    return {
      message: '流程至少需要一个中间节点',
      type: 'error',
    };
  }
  return null;
}

export function validateNodeConnections(
  workflow: Workflow,
): ValidationError[] {
  const errors: ValidationError[] = [];

  const middleNodes = workflow.nodes.filter(
    (n) =>
      n.data.type !== 'idp_core_flow_Start' &&
      n.data.type !== 'idp_core_flow_End',
  );

  for (const node of middleNodes) {
    const hasInput = workflow.edges.some((e) => e.target === node.id);
    const hasOutput = workflow.edges.some((e) => e.source === node.id);
    const parentInfo = getParentNodeFieldInfo(workflow, node.id);
    const isInsideContainer = parentInfo !== null;
    const isTerminalBranch =
      parentInfo !== null && TERMINAL_FIELDS.includes(parentInfo.field);

    if (!hasInput && !hasOutput && !isInsideContainer) {
      errors.push({
        message: `节点「${node.data.label}」未连接任何节点`,
        nodeId: node.id,
        nodeLabel: node.data.label,
        type: 'error',
      });
      continue;
    }

    if (!hasInput && !isInsideContainer && !isTerminalBranch) {
      errors.push({
        message: `节点「${node.data.label}」缺少输入连接`,
        nodeId: node.id,
        nodeLabel: node.data.label,
        type: 'error',
      });
      continue;
    }

    if (!hasOutput && !isInsideContainer && !isTerminalBranch) {
      errors.push({
        message: `节点「${node.data.label}」缺少输出连接`,
        nodeId: node.id,
        nodeLabel: node.data.label,
        type: 'error',
      });
    }
  }

  return errors;
}

export function validateAll(
  workflow: Workflow,
  name: string,
): ValidationResult {
  const errors: ValidationError[] = [];

  const nameError = validateWorkflowName(name);
  if (nameError) errors.push(nameError);

  if (errors.length === 0) {
    const startError = validateStartNode(workflow);
    if (startError) errors.push(startError);

    const endError = validateEndNode(workflow);
    if (endError) errors.push(endError);

    const minNodesError = validateMinNodes(workflow);
    if (minNodesError) errors.push(minNodesError);

    if (errors.length === 0) {
      const connectionErrors = validateNodeConnections(workflow);
      errors.push(...connectionErrors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((e) => e.message).join('\n');
}
