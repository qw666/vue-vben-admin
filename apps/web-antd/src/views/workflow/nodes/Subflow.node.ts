import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';
import { getFlowControlConfig } from '../config/workflow-node-config';

export const SubflowNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Subflow',
  config: {
    nodeType: 'idp_core_flow_Subflow',
    nodeName: '子流程',
    icon: 'mdi:folder-open',
    description: '子流程调用',
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
      flowId: savedConfig.flowId || '',
      namespace: savedConfig.namespace || '',
      wait: savedConfig.wait ?? true,
      transmitFailed: savedConfig.transmitFailed ?? true,
      inputs: savedConfig.inputs || {},
      next: savedConfig.next || [],
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    return { ...config };
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    return { ...config };
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
  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'VarPicker',
        props: {
          key: 'namespace',
          label: '命名空间',
          required: true,
          description: '目标子流程所在的命名空间',
          tooltip: '要调用的子流程的命名空间，输入 / 可选择变量',
          dynamic: true,
        },
      },
      {
        type: 'VarPicker',
        props: {
          key: 'flowId',
          label: '流程ID',
          required: true,
          description: '要调用的子流程ID',
          tooltip: '要调用的子流程的ID，输入 / 可选择变量',
          dynamic: true,
        },
      },
    ];
  },
  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'Switch',
        props: { key: 'wait', label: '等待完成', required: false, description: '是否等待子流程执行完成', tooltip: '默认 true。若设为 false，父流程不等待子流程完成即继续执行。', dynamic: false },
      },
      {
        type: 'Switch',
        props: { key: 'transmitFailed', label: '传递失败', required: false, description: '子流程失败时是否使父流程也失败', tooltip: '默认 true。仅当 wait=true 时生效。', dynamic: false },
      },
    ];
  },
};

flowControlNodeRegistry.register(SubflowNodeStrategy);
