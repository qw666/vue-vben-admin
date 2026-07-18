import type { FlowControlNodeStrategy } from './types';

import { flowControlNodeRegistry } from './types';

export const SwitchNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Switch',
  config: {
    nodeType: 'idp_core_flow_Switch',
    nodeName: '分支路由',
    icon: 'mdi:hexagon',
    description: '多条件分支',
    ports: {
      input: 1,
      output: [
        { field: 'cases', label: 'Cases', color: '#3b82f6', dynamic: true },
        { field: 'defaults', label: 'Default', color: '#64748b' },
        { field: 'errors', label: 'Errors', color: '#f59e0b' },
        { field: 'finally', label: 'Finally', color: '#64748b' },
        { field: 'next', label: 'Next', color: '#8b5cf6' },
      ],
    },
    taskFields: ['cases', 'defaults', 'errors', 'finally'],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const casesValue = savedConfig.cases;
    return {
      value: savedConfig.value || '',
      cases:
        typeof casesValue === 'object' &&
        casesValue !== null &&
        !Array.isArray(casesValue)
          ? JSON.parse(JSON.stringify(casesValue))
          : {},
      defaults: Array.isArray(savedConfig.defaults)
        ? [...savedConfig.defaults]
        : [],
      errors: Array.isArray(savedConfig.errors) ? [...savedConfig.errors] : [],
      finally: Array.isArray(savedConfig.finally)
        ? [...savedConfig.finally]
        : [],
      next: Array.isArray(savedConfig.next) ? [...savedConfig.next] : [],
    };
  },
  getRequiredFields(): { props: Record<string, any>; type: string }[] {
    return [
      {
        type: 'Input',
        props: {
          key: 'value',
          label: '匹配值',
          required: true,
          description: '用于分支匹配判断的表达式/值',
          tooltip: '',
          dynamic: false,
        },
      },
    ];
  },
  getOptionalFields(): { props: Record<string, any>; type: string }[] {
    return [
      {
        type: 'SwitchCases',
        props: {
          key: 'cases',
          label: 'Cases',
          required: false,
          description: '匹配键与对应执行任务列表映射',
          tooltip: '',
          dynamic: false,
        },
      },
      {
        type: 'ConnectionStatus',
        props: {
          key: 'defaults',
          label: 'Default',
          required: false,
          description: '无任何case匹配时执行的默认任务列表',
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
          description: '当前分支任务出现异常时执行的任务列表',
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
          description: '所有分支执行完成后执行的收尾任务',
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
          description: '分支路由完成后继续执行的任务',
          tooltip: '',
          dynamic: false,
        },
      },
    ];
  },
};

flowControlNodeRegistry.register(SwitchNodeStrategy);
