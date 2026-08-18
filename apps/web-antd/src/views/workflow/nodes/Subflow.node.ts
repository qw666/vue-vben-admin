import type { FlowControlNodeStrategy, NodeOutputDef } from './types';
import { flowControlNodeRegistry } from './types';

export const SubflowNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Subflow',
  config: {
    nodeType: 'idp_core_flow_Subflow',
    nodeName: '子流程',
    icon: 'mdi:folder-open',
    description: '调用系统内另一个流程作为子流程执行',
    group: 'flowControl',
    category: 'tool',
    ports: {
      input: 1,
      output: [
        { field: 'next', label: 'Next', color: '#8b5cf6', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: [],
  },

  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    return {
      targetFlowId: savedConfig.targetFlowId || savedConfig.flowId || '',
      wait: savedConfig.wait ?? true,
      transmitFailed: savedConfig.transmitFailed ?? true,
      inputs: savedConfig.inputs || {},
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = { ...config };
    delete result.next;
    return result;
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    const result = { ...config };
    if (result.flowId && !result.targetFlowId) {
      result.targetFlowId = result.flowId;
      delete result.flowId;
    }
    delete result.namespace;
    delete result.next;
    return result;
  },

  getOutputs(config: Record<string, any>): NodeOutputDef[] {
    const outputs: NodeOutputDef[] = [
      { key: 'executionId', label: '执行ID', type: 'string' },
      { key: 'outputs', label: '子流程输出', type: 'object' },
    ];
    if (config.wait !== false) {
      outputs.push({ key: 'state', label: '状态', type: 'string' });
    }
    return outputs;
  },

  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },

  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },
};

flowControlNodeRegistry.register(SubflowNodeStrategy);
