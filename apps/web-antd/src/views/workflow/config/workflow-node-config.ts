import '../nodes';
import { flowControlNodeRegistry } from '../nodes/types';
import type { FlowControlNodeConfig, FrontendNodeGroup, WorkflowNodePort } from '../nodes/types';

export interface WorkflowNodeConfig {
  type: 'executor' | 'flow_control';
  nodeName: string;
  icon: string;
  description: string;
  ports: {
    input?: number;
    output?: WorkflowNodePort[];
  };
  taskFields?: string[];
}

export const WORKFLOW_NODE_CONFIG: Record<string, WorkflowNodeConfig> = (() => {
  const config: Record<string, WorkflowNodeConfig> = {};
  flowControlNodeRegistry.getAll().forEach(strategy => {
    const cfg = strategy.config;
    config[cfg.nodeType] = {
      type: 'flow_control',
      nodeName: cfg.nodeName,
      icon: cfg.icon,
      description: cfg.description,
      ports: cfg.ports,
      taskFields: cfg.taskFields,
    };
  });
  return config;
})();

/**
 * 判断节点是否是流控容器节点（有 taskFields）
 */
export function isFlowControlContainer(nodeType: string): boolean {
  return flowControlNodeRegistry.isFlowControlContainer(nodeType);
}

/**
 * @deprecated Use isFlowControlContainer() instead.
 * 保留为兼容层
 */
export function isFlowControlNode(nodeType: string): boolean {
  return flowControlNodeRegistry.isFlowControlContainer(nodeType);
}

export function getFlowControlConfig(nodeType: string): FlowControlNodeConfig {
  return flowControlNodeRegistry.getConfig(nodeType);
}

export function getFlowControlTaskFields(nodeType: string): string[] {
  return flowControlNodeRegistry.getTaskFields(nodeType);
}

export function getFlowControlNodes(): { type: string; nodeName: string; icon: string; description: string }[] {
  return flowControlNodeRegistry.getFlowControlNodes();
}

/**
 * 前端分组标识 → 显示名称
 * 注：前端 group 直接与后端 groupKey 对齐，无需映射
 */
const GROUP_LABEL_MAP: Record<FrontendNodeGroup, string> = {
  flowControl: '流程控制',
  tools: '工具',
  hidden: '',
};

/**
 * 获取前端可见节点（排除 hidden 分组）
 */
export function getVisibleFrontendNodes() {
  return flowControlNodeRegistry.getVisibleFrontendNodes();
}

/**
 * 获取前端分组对应的 groupKey（与后端对齐，直接返回分组名）
 */
export function getGroupKey(group: FrontendNodeGroup): string {
  return group;
}

/**
 * 获取前端分组的显示名称
 */
export function getGroupLabel(group: FrontendNodeGroup): string {
  return GROUP_LABEL_MAP[group] || group;
}

export { flowControlNodeRegistry };
