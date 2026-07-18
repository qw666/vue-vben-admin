import type { FlowControlNodeStrategy } from './types';

import { flowControlNodeRegistry } from './types';

export const IfNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_If',
  config: {
    nodeType: 'idp_core_flow_If',
    nodeName: '条件判断',
    icon: 'mdi:checkbox-marked-circle',
    description: '条件分支',
    ports: {
      input: 1,
      output: [
        { field: 'then', label: 'IF', color: '#22c55e' },
        { field: 'else', label: 'Else', color: '#ef4444' },
        { field: 'errors', label: 'Errors', color: '#f59e0b' },
        { field: 'finally', label: 'Finally', color: '#64748b' },
        { field: 'next', label: 'Next', color: '#8b5cf6' },
      ],
    },
    taskFields: ['then', 'else', 'errors', 'finally'],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    return {
      condition: savedConfig.condition || '',
      then: savedConfig.then || [],
      else: savedConfig.else || [],
      errors: savedConfig.errors || [],
      finally: savedConfig.finally || [],
      next: savedConfig.next || [],
    };
  },
  getRequiredFields(): { props: Record<string, any>; type: string }[] {
    return [
      {
        type: 'Input',
        props: {
          key: 'condition',
          label: '条件表达式',
          required: true,
          description: 'If判断条件，可填写任意能解析为布尔值的表达式',
          tooltip: '',
          dynamic: false,
        },
      },
    ];
  },
  getOptionalFields(): { props: Record<string, any>; type: string }[] {
    return [
      {
        type: 'ConnectionStatus',
        props: {
          key: 'then',
          label: 'IF',
          required: false,
          description: '条件成立时执行的任务列表',
          tooltip: '',
          dynamic: false,
        },
      },
      {
        type: 'ConnectionStatus',
        props: {
          key: 'else',
          label: 'Else',
          required: false,
          description: '条件不成立时执行的任务列表',
          tooltip: '',
          dynamic: false,
        },
      },
      {
        type: 'ConnectionStatus',
        props: {
          key: 'errors',
          label: 'Errors',
          required: false,
          description: '子任务执行出错时执行的任务列表',
          tooltip: '',
          dynamic: false,
        },
      },
      {
        type: 'ConnectionStatus',
        props: {
          key: 'finally',
          label: 'Finally',
          required: false,
          description: '分支全部执行完成后执行的收尾任务',
          tooltip: '',
          dynamic: false,
        },
      },
      {
        type: 'ConnectionStatus',
        props: {
          key: 'next',
          label: 'Next',
          required: false,
          description: '条件判断完成后继续执行的任务',
          tooltip: '',
          dynamic: false,
        },
      },
    ];
  },
};

flowControlNodeRegistry.register(IfNodeStrategy);
