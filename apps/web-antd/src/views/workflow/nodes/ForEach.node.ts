import type { FlowControlNodeStrategy } from './types';

import { flowControlNodeRegistry } from './types';

export const ForEachNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_ForEach',
  config: {
    nodeType: 'idp_core_flow_ForEach',
    nodeName: 'ForEach',
    icon: 'mdi:repeat',
    description: '循环执行',
    ports: {
      input: 1,
      output: [
        { field: 'tasks', label: 'Tasks', color: '#3b82f6' },
        { field: 'next', label: 'Next', color: '#8b5cf6' },
      ],
    },
    taskFields: ['tasks'],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const value = savedConfig.value || savedConfig.values;
    let valuesArray = [];
    if (Array.isArray(value)) {
      valuesArray = value;
    } else if (typeof value === 'string' && value.trim()) {
      try {
        valuesArray = JSON.parse(value);
      } catch {
        valuesArray = [value];
      }
    }
    return {
      values: valuesArray,
      concurrencyLimit: savedConfig.concurrencyLimit ?? 1,
      tasks: savedConfig.do || savedConfig.tasks || [],
      next: savedConfig.next || [],
    };
  },
  getRequiredFields(): { props: Record<string, any>; type: string }[] {
    return [
      {
        type: 'StringArray',
        props: {
          key: 'values',
          label: 'values',
          required: true,
          description: '要循环迭代的值列表',
          tooltip:
            '每个值会触发一次循环，子任务中可通过 {{taskrun.value}} 访问当前迭代值，通过 {{taskrun.iteration}} 访问索引。在嵌套循环中，可通过 {{parent.taskrun.value}} 访问父循环的值。',
          dynamic: false,
        },
      },
    ];
  },
  getOptionalFields(): { props: Record<string, any>; type: string }[] {
    return [
      {
        type: 'Concurrent',
        props: {
          key: 'concurrencyLimit',
          label: 'concurrencyLimit',
          required: false,
          description: '并发任务组数',
          tooltip:
            'values 数组中每个值对应的任务组并发执行数量。默认值为1。0=无限制，所有任务组同时并行执行；1=完全串行，每次只执行一个任务组；大于1时，最多允许指定数量的任务组并行执行。',
          dynamic: false,
          connectionField: 'tasks',
          maxLimited: false,
        },
      },
      {
        type: 'ConnectionStatus',
        props: {
          key: 'tasks',
          label: 'Tasks',
          required: false,
          description: '循环执行的任务列表',
          tooltip:
            '每次迭代执行的子任务。子任务可通过 {{taskrun.value}} 访问当前迭代项。',
          dynamic: false,
        },
      },
    ];
  },
};

flowControlNodeRegistry.register(ForEachNodeStrategy);
