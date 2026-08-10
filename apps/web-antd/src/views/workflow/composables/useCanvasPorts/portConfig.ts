import type { FlowControlNodeConfig, WorkflowNodePort } from '../../nodes/nodeTypes';
import type { WorkflowNode } from '#/types/workflow';

export interface ResolvedInputPort {
  visible: boolean;
  count: number;
}

export interface ResolvedOutputPort {
  id: string;
  field: string;
  label: string;
  color: string;
  portGroup: string;
  position: 'bottom' | 'right';
}

export interface ResolvedOutputPorts {
  bottomOutputs: ResolvedOutputPort[];
  rightOutputs: ResolvedOutputPort[];
  nextOutput: ResolvedOutputPort | null;
}

/**
 * 解析输入端口配置 - 数据驱动
 * 完全由 ports.input 配置决定，不再依赖 isFlowControlContainer 判断
 */
export function resolveInputPortConfig(config: FlowControlNodeConfig): ResolvedInputPort {
  const inputCount = config.ports?.input ?? 0;
  return {
    visible: inputCount > 0,
    count: inputCount,
  };
}

/**
 * 判断节点是否需要计算分组边界
 */
export function needsGroupBounds(config: FlowControlNodeConfig): boolean {
  return !!(config.taskFields && config.taskFields.length > 0);
}

/**
 * 解析输出端口配置
 * 处理 dynamic / errors / finally / next 等特殊端口
 */
export function resolveOutputPorts(
  config: FlowControlNodeConfig,
  node: WorkflowNode,
): ResolvedOutputPorts {
  const bottomOutputs: ResolvedOutputPort[] = [];
  const rightOutputs: ResolvedOutputPort[] = [];

  const outputDefs = config.ports?.output ?? [];
  const nextDef = outputDefs.find((out: WorkflowNodePort) => out.field === 'next');

  outputDefs.forEach((out: WorkflowNodePort) => {
    if (out.dynamic) {
      const cases = node.data.config?.[out.field];
      const caseCount =
        typeof cases === 'object' && cases !== null && !Array.isArray(cases)
          ? Object.keys(cases).length
          : 0;
      bottomOutputs.push({
        id: `${node.id}-output-${out.field}-add`,
        field: `${out.field}-add`,
        label: caseCount > 0 ? `${out.label}(${caseCount})` : '+',
        color: out.color,
        portGroup: out.field,
        position: 'bottom',
      });
    } else {
      if (out.field === 'errors' || out.field === 'finally') {
        rightOutputs.push({
          id: `${node.id}-output-${out.field}`,
          field: out.field,
          label: out.label,
          color: out.field === 'errors' ? '#ef4444' : '#22c55e',
          portGroup: out.field,
          position: 'right',
        });
      } else if (out.field !== 'next') {
        bottomOutputs.push({
          id: `${node.id}-output-${out.field}`,
          field: out.field,
          label: out.label,
          color: out.color,
          portGroup: out.field,
          position: 'bottom',
        });
      }
    }
  });

  let nextOutput: ResolvedOutputPort | null = null;
  if (nextDef) {
    nextOutput = {
      id: `${node.id}-output-${nextDef.field}`,
      field: nextDef.field,
      label: nextDef.label,
      color: nextDef.color,
      portGroup: nextDef.field,
      position: 'bottom',
    };
  }

  return { bottomOutputs, rightOutputs, nextOutput };
}
