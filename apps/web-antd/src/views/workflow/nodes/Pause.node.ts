import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';

export const PauseNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Pause',
  config: {
    nodeType: 'idp_core_flow_Pause',
    nodeName: '暂停节点',
    icon: 'mdi:pause',
    description: '暂停等待',
    ports: {
      input: 1,
      output: [],
    },
    taskFields: [],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    return {
      duration: savedConfig.duration || '',
      durationUnit: savedConfig.durationUnit || 'seconds',
    };
  },
  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'Input',
        props: { key: 'duration', label: '暂停时长', required: true, description: '暂停的时间长度', tooltip: '', dynamic: false },
      },
    ];
  },
  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'Select',
        props: { key: 'durationUnit', label: '时间单位', required: false, description: '暂停时长的单位', tooltip: '', dynamic: false, options: [
          { value: 'seconds', label: '秒' },
          { value: 'minutes', label: '分钟' },
          { value: 'hours', label: '小时' },
          { value: 'days', label: '天' },
        ]},
      },
    ];
  },
};

flowControlNodeRegistry.register(PauseNodeStrategy);
