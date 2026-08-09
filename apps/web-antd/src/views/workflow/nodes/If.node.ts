import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';
import { getFlowControlConfig } from '../config/workflow-node-config';

export const IfNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_If',
  config: {
    nodeType: 'idp_core_flow_If',
    nodeName: '条件判断',
    icon: 'mdi:checkbox-marked-circle',
    description: '条件分支',
    group: 'flowControl',
    category: 'flow',
    ports: {
      input: 1,
      output: [
        { field: 'then', label: 'IF', color: '#22c55e', connectionType: 'list', connectionMode: 'sequential' },
        { field: 'else', label: 'Else', color: '#ef4444', connectionType: 'list', connectionMode: 'sequential' },
        { field: 'errors', label: 'Errors', color: '#f59e0b', excludeFromBounds: true, connectionType: 'list', connectionMode: 'sequential' },
        { field: 'finally', label: 'Finally', color: '#64748b', excludeFromBounds: true, connectionType: 'list', connectionMode: 'sequential' },
        { field: 'next', label: 'Next', color: '#8b5cf6', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: ['then', 'else', 'errors', 'finally'],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const deserialized = this.deserializeConfig?.(savedConfig) || savedConfig;
    return {
      condition: deserialized.condition || '',
      then: deserialized.then || [],
      else: deserialized.else || [],
      errors: deserialized.errors || [],
      finally: deserialized.finally || [],
      next: deserialized.next || [],
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    return { ...config };
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {
      ...config,
      else: Array.isArray(config.else) ? [...config.else] : [],
      errors: Array.isArray(config.errors) ? [...config.errors] : [],
      finally: Array.isArray(config.finally) ? [...config.finally] : [],
      next: Array.isArray(config.next) ? [...config.next] : [],
    };
    const parts = ['t', 'h', 'e', 'n'];
    const key = parts.join('');
    result[key] = Array.isArray(config[key]) ? [...config[key]] : [];
    return result;
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
        type: 'VarPicker',
        props: {
          key: 'condition',
          label: '条件表达式',
          required: true,
          description: 'If判断条件，可填写任意能解析为布尔值的表达式',
          tooltip: '支持变量选择或手写表达式，输入 / 选择变量，如 {{ outputs.nodeA.code }} == 200',
          dynamic: true,
        },
      },
      {
        type: 'ConnectionStatus',
        props: {
          key: 'then',
          label: 'IF',
          required: true,
          description: '条件成立时执行的任务列表（至少1个任务）',
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
    ];
  },
};

flowControlNodeRegistry.register(IfNodeStrategy);
