import '../nodes';
import { flowControlNodeRegistry } from '../nodes/types';
import type { FlowControlNodeConfig } from '../nodes/types';

export interface WorkflowNodePort {
  field: string;
  label: string;
  color: string;
  dynamic?: boolean;
  excludeFromBounds?: boolean;
}

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

export function isFlowControlNode(nodeType: string): boolean {
  return flowControlNodeRegistry.isFlowControlNode(nodeType);
}

export function getFlowControlConfig(nodeType: string): FlowControlNodeConfig | undefined {
  return flowControlNodeRegistry.getConfig(nodeType);
}

export function getFlowControlTaskFields(nodeType: string): string[] {
  return flowControlNodeRegistry.getTaskFields(nodeType);
}

export function getFlowControlNodes(): { type: string; nodeName: string; icon: string; description: string }[] {
  return flowControlNodeRegistry.getFlowControlNodes();
}

export { flowControlNodeRegistry };
