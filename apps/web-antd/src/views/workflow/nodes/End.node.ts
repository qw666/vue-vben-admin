import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';

export const EndNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_End',
  config: {
    nodeType: 'idp_core_flow_End',
    nodeName: '输出',
    icon: 'mdi:stop-circle',
    description: '流程输出节点',
    group: 'hidden',
    category: 'end',
    ports: {
      input: 1,
      output: [],
    },
    taskFields: [],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const deserialized = this.deserializeConfig?.(savedConfig) || savedConfig;
    return {
      outputs: deserialized.outputs || [],
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    return { ...config };
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    return {
      ...config,
      outputs: Array.isArray(config.outputs) ? [...config.outputs] : [],
    };
  },

  handleConnection(): void {
  },

  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },

  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'Output',
        props: {
          key: 'outputs',
          label: '流程输出',
          required: false,
          description: '流程输出，定义流程执行完成后产生的输出值',
          tooltip: '流程可以产生强类型输出。id 是输出属性的名称（必须唯一），value 是输出值，可以使用表达式如 "{{ outputs.mytask.value }}"。支持 ARRAY、BOOLEAN、FLOAT、INT、STRING、JSON 等类型。',
          dynamic: false,
        },
      },
    ];
  },

  saveConfig(config: Record<string, any>, store: any): void {
    if (!store.currentWorkflow) return;
    store.currentWorkflow.outputs = config.outputs || [];
  },
};

flowControlNodeRegistry.register(EndNodeStrategy);
