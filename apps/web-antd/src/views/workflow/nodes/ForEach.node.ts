import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';
import { getFlowControlConfig } from '../config/workflow-node-config';

export const ForEachNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_ForEach',
  config: {
    nodeType: 'idp_core_flow_ForEach',
    nodeName: '循环',
    icon: 'mdi:repeat',
    description: '循环执行',
    ports: {
      input: 1,
      output: [
        { field: 'tasks', label: 'Tasks', color: '#3b82f6', connectionType: 'list', connectionMode: 'sequential' },
        { field: 'next', label: 'Next', color: '#8b5cf6', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: ['tasks'],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const deserialized = this.deserializeConfig?.(savedConfig) || savedConfig;
    return {
      values: deserialized.values,
      concurrencyLimit: deserialized.concurrencyLimit ?? 1,
      tasks: deserialized.tasks,
      next: deserialized.next,
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    return {
      values: config.values,
      concurrencyLimit: config.concurrencyLimit,
      tasks: config.tasks,
    };
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    const value = config.value || config.values;
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
      ...config,
      values: valuesArray,
      tasks: config.do || config.tasks || [],
      next: Array.isArray(config.next) ? [...config.next] : [],
    };
  },

  handleConnection(params: {
    conn: any;
    isAdd: boolean;
    nodeConfigForm?: any;
    store?: any;
  }): void {
    const { conn, isAdd, nodeConfigForm, store } = params;
    const sourceNode = store.currentWorkflow?.nodes.find((n: any) => n.id === conn.source);
    if (!sourceNode) return;

    const flowControlConfig = getFlowControlConfig(sourceNode.data.type);
    if (!flowControlConfig) return;

    const sourceHandle = conn.sourceHandle.replace(`${conn.source}-output-`, '');
    let targetField = sourceHandle;
    let connectionType: 'single' | 'list' | 'cases' | undefined;

    if (flowControlConfig.ports.output) {
      const port = flowControlConfig.ports.output.find((p: any) =>
        sourceHandle === p.field || sourceHandle.startsWith(p.field + '-')
      );
      if (port) {
        connectionType = port.connectionType;
        targetField = port.field;
      }
    }

    const targetNode = store.currentWorkflow?.nodes.find((n: any) => n.id === conn.target);
    if (!targetNode) return;

    const taskItem = {
      type: targetNode.data.type,
      nodeId: targetNode.id,
      label: targetNode.data.label,
      ...targetNode.data.config,
    };

    if (!sourceNode.data.config) {
      sourceNode.data.config = {};
    }

    if (connectionType === 'list' || connectionType === 'single') {
      if (!Array.isArray(sourceNode.data.config[targetField])) {
        sourceNode.data.config[targetField] = [];
      }
      const configArray = sourceNode.data.config[targetField];

      if (isAdd) {
        const existing = configArray.find((item: any) => item.nodeId === conn.target);
        if (!existing) {
          configArray.push(taskItem);
        }
      } else {
        sourceNode.data.config[targetField] = configArray.filter(
          (item: any) => item.nodeId !== conn.target
        );
      }

      if (nodeConfigForm && sourceNode.data.config) {
        nodeConfigForm[targetField] = [...sourceNode.data.config[targetField]];
      }
    }

    store.updateNode(conn.source, { data: { ...sourceNode.data } });
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
      {
        type: 'ConnectionStatus',
        props: {
          key: 'tasks',
          label: 'Tasks',
          required: true,
          description: '循环执行的任务列表（至少1个任务）',
          tooltip:
            '每次迭代执行的子任务。子任务可通过 {{taskrun.value}} 访问当前迭代项。',
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
    ];
  },
};

flowControlNodeRegistry.register(ForEachNodeStrategy);
