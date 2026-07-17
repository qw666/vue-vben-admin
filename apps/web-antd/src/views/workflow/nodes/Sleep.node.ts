import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';

export const SleepNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Sleep',
  config: {
    nodeType: 'idp_core_flow_Sleep',
    nodeName: 'Sleep',
    icon: 'mdi:sleep',
    description: '睡眠等待',
    ports: {
      input: 1,
      output: [
        { field: '_next', label: 'Next', color: '#22c55e' },
      ],
    },
    taskFields: [],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    return {
      duration: savedConfig.duration || '',
    };
  },
  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'Duration',
        props: { key: 'duration', label: '时长', required: true, description: '暂停执行的时间', tooltip: 'ISO 8601 格式的时间长度（例如，PT5S 表示5秒）。用于退避、调步或演示计时。' },
      },
    ];
  },
  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },
};

flowControlNodeRegistry.register(SleepNodeStrategy);
