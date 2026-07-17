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
        { field: 'next', label: 'Next', color: '#8b5cf6' },
      ],
    },
    taskFields: ['tasks', 'next'],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    return {
      tasks: savedConfig.tasks || [],
      concurrent: savedConfig.concurrent || 0,
      next: savedConfig.next || [],
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
      {
        type: 'Concurrent',
        props: { key: 'concurrent', label: '并发数', required: false, description: '最大并发执行数量', tooltip: '任意时刻可以运行的并发并行任务数。如果值为0，则没有限制，所有任务将同时开始。', dynamic: false, connectionField: 'tasks' },
      },
      {
        type: 'ConnectionStatus',
        props: { key: 'next', label: 'Next', required: false, description: '并行执行完成后继续执行的任务', tooltip: '', dynamic: false },
      },
    ];
  },
};

flowControlNodeRegistry.register(ParallelNodeStrategy);
