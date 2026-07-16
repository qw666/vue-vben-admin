import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';

export const ForEachNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_ForEach',
  config: {
    nodeType: 'idp_core_flow_ForEach',
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
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    return {
      value: savedConfig.value || '',
      do: savedConfig.do || [],
    };
  },
  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'Input',
        props: { key: 'value', label: '循环值', required: true, description: '要循环迭代的值', tooltip: '', dynamic: false },
      },
    ];
  },
  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'ConnectionStatus',
        props: { key: 'do', label: 'Do', required: false, description: '循环执行的任务列表', tooltip: '', dynamic: false },
      },
    ];
  },
};

flowControlNodeRegistry.register(ForEachNodeStrategy);
