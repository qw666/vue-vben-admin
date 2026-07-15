export interface WorkflowNodePort {
  field: string;
  label: string;
  color: string;
  dynamic?: boolean;
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

export const WORKFLOW_NODE_CONFIG: Record<string, WorkflowNodeConfig> = {
  idp_core_flow_If: {
    type: 'flow_control',
    nodeName: '条件判断',
    icon: 'mdi:logic-condition',
    description: '条件分支',
    ports: {
      input: 1,
      output: [
        { field: 'then', label: 'Then', color: '#22c55e' },
        { field: 'else', label: 'Else', color: '#ef4444' },
        { field: 'errors', label: 'Errors', color: '#f59e0b' },
        { field: 'finally', label: 'Finally', color: '#64748b' },
      ],
    },
    taskFields: ['then', 'else', 'errors', 'finally'],
  },
  idp_core_flow_Switch: {
    type: 'flow_control',
    nodeName: '分支路由',
    icon: 'mdi:git-branch',
    description: '多条件分支',
    ports: {
      input: 1,
      output: [
        { field: 'cases', label: 'Cases', color: '#3b82f6', dynamic: true },
        { field: 'defaults', label: 'Default', color: '#64748b' },
        { field: 'errors', label: 'Errors', color: '#f59e0b' },
        { field: 'finally', label: 'Finally', color: '#64748b' },
      ],
    },
    taskFields: ['cases', 'defaults', 'errors', 'finally'],
  },
  idp_core_flow_ForEach: {
    type: 'flow_control',
    nodeName: '循环节点',
    icon: 'mdi:repeat',
    description: '循环执行',
    ports: {
      input: 1,
      output: [
        { field: 'do', label: 'Do', color: '#3b82f6' },
      ],
    },
    taskFields: ['do'],
  },
  idp_core_flow_Parallel: {
    type: 'flow_control',
    nodeName: '并行执行',
    icon: 'mdi:split-vertical',
    description: '并行分支',
    ports: {
      input: 1,
      output: [
        { field: 'tasks', label: 'Tasks', color: '#06b6d4' },
      ],
    },
    taskFields: ['tasks'],
  },
  idp_core_flow_Subflow: {
    type: 'flow_control',
    nodeName: '子流程',
    icon: 'mdi:folder-open',
    description: '子流程调用',
    ports: {
      input: 1,
      output: [
        { field: 'tasks', label: 'Tasks', color: '#8b5cf6' },
      ],
    },
    taskFields: ['tasks'],
  },
  idp_core_flow_Pause: {
    type: 'flow_control',
    nodeName: '暂停节点',
    icon: 'mdi:pause',
    description: '暂停等待',
    ports: {
      input: 1,
      output: [],
    },
    taskFields: [],
  },
};

export function isFlowControlNode(nodeType: string): boolean {
  return WORKFLOW_NODE_CONFIG[nodeType]?.type === 'flow_control';
}

export function getFlowControlConfig(nodeType: string): WorkflowNodeConfig | undefined {
  return WORKFLOW_NODE_CONFIG[nodeType];
}

export function getFlowControlTaskFields(nodeType: string): string[] {
  return WORKFLOW_NODE_CONFIG[nodeType]?.taskFields || [];
}

export function getFlowControlNodes(): { type: string; nodeName: string; icon: string; description: string }[] {
  return Object.entries(WORKFLOW_NODE_CONFIG).map(([type, config]) => ({
    type,
    nodeName: config.nodeName,
    icon: config.icon,
    description: config.description,
  }));
}