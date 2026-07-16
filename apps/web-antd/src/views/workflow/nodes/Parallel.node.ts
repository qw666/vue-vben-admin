import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';

export const ParallelNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Parallel',
  config: {
    nodeType: 'idp_core_flow_Parallel',
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
        props: { key: 'tasks', label: 'Tasks', required: false, description: '并行执行的任务列表', tooltip: '', dynamic: false },
      },
    ];
  },
};

flowControlNodeRegistry.register(ParallelNodeStrategy);
