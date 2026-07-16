import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';

export const SubflowNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Subflow',
  config: {
    nodeType: 'idp_core_flow_Subflow',
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
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    return {
      tasks: savedConfig.tasks || [],
    };
  },
  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },
  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'ConnectionStatus',
        props: { key: 'tasks', label: 'Tasks', required: false, description: '子流程任务列表', tooltip: '', dynamic: false },
      },
    ];
  },
};

flowControlNodeRegistry.register(SubflowNodeStrategy);
