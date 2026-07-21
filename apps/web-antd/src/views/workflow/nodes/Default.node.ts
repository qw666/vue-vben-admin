import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';

export const DefaultNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'default',
  config: {
    nodeType: 'default',
    nodeName: '默认节点',
    icon: 'mdi:circle',
    description: '基础执行节点',
    ports: {
      input: 1,
      output: [
        { field: 'output', label: 'Next', color: '#8b5cf6', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: [],
  },

  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    return savedConfig;
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    return config;
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    return config;
  },

  handleConnection(): void {
  },

  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },

  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },
};

flowControlNodeRegistry.register(DefaultNodeStrategy);
