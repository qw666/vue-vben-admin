import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';

export const SequentialNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Sequential',
  config: {
    nodeType: 'idp_core_flow_Sequential',
    nodeName: '顺序执行',
    icon: 'mdi:format-list-ordered',
    description: '顺序分支',
    group: 'hidden',
    transparentContainer: true,
    taskFields: ['tasks'],
    ports: {
      input: 1,
      output: [
        {
          field: 'tasks',
          label: 'Tasks',
          color: '#3b82f6',
          connectionType: 'list',
          connectionMode: 'sequential',
        },
        {
          field: 'next',
          label: 'Next',
          color: '#8b5cf6',
          connectionType: 'single',
          connectionMode: 'sequential',
        },
      ],
    },
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    return {
      tasks: savedConfig.tasks || [],
      next: Array.isArray(savedConfig.next) ? [...savedConfig.next] : [],
    };
  },
  serializeConfig(config: Record<string, any>): Record<string, any> {
    return { ...config };
  },
  deserializeConfig(config: Record<string, any>): Record<string, any> {
    return {
      ...config,
      tasks: Array.isArray(config.tasks) ? [...config.tasks] : [],
      next: Array.isArray(config.next) ? [...config.next] : [],
    };
  },
};

flowControlNodeRegistry.register(SequentialNodeStrategy);
