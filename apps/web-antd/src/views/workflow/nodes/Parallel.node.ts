import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';
import { getFlowControlConfig } from '../config/workflow-node-config';

export const ParallelNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Parallel',
  config: {
    nodeType: 'idp_core_flow_Parallel',
    nodeName: '并行执行',
    icon: 'mdi:split-vertical',
    description: '并行分支',
    group: 'flowControl',
    ports: {
      input: 1,
      output: [
        { field: 'tasks', label: 'Tasks', color: '#06b6d4', connectionType: 'list', connectionMode: 'parallel' },
        { field: 'next', label: 'Next', color: '#8b5cf6', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: ['tasks'],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const deserialized = this.deserializeConfig?.(savedConfig) || savedConfig;
    return {
      tasks: deserialized.tasks,
      concurrent: deserialized.concurrent,
      next: deserialized.next,
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    return { ...config };
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    return {
      ...config,
      tasks: Array.isArray(config.tasks) ? [...config.tasks] : [],
      concurrent: config.concurrent ?? 0,
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
        type: 'ConnectionStatus',
        props: {
          key: 'tasks',
          label: 'Tasks',
          required: true,
          description: '并行执行的任务列表（至少1个任务）',
          tooltip: '',
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
          key: 'concurrent',
          label: '并发数',
          required: false,
          description: '最大并发执行数量',
          tooltip:
            '任意时刻可以运行的并发并行任务数。如果值为0，则没有限制，所有任务将同时开始。',
          dynamic: false,
          connectionField: 'tasks',
        },
      },
    ];
  },
};

flowControlNodeRegistry.register(ParallelNodeStrategy);
