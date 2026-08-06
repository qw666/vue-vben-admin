import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';

export const StartNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Start',
  config: {
    nodeType: 'idp_core_flow_Start',
    nodeName: '开始',
    icon: 'mdi:play-circle',
    description: '流程开始节点',
    ports: {
      input: 0,
      output: [
        { field: 'next', label: 'Next', color: '#22c55e', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: [],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const deserialized = this.deserializeConfig?.(savedConfig) || savedConfig;
    return {
      next: deserialized.next || [],
      inputs: deserialized.inputs || [],
      triggers: deserialized.triggers || [],
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    return { ...config };
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    return {
      ...config,
      next: Array.isArray(config.next) ? [...config.next] : [],
      inputs: Array.isArray(config.inputs) ? [...config.inputs] : [],
      triggers: Array.isArray(config.triggers) ? [...config.triggers] : [],
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

    const sourceHandle = conn.sourceHandle.replace(`${conn.source}-output-`, '');
    const targetField = sourceHandle;

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

    store.updateNode(conn.source, { data: { ...sourceNode.data } });
  },

  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },

  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'Inputs',
        props: {
          key: 'inputs',
          label: '输入',
          required: false,
          description: '流程输入参数，手动触发时用户需要填写的字段',
          tooltip: '配置流程的输入参数，支持 STRING、INT、FLOAT、BOOLEAN、ARRAY、JSON 类型',
          dynamic: false,
        },
      },
      {
        type: 'Triggers',
        props: {
          key: 'triggers',
          label: '触发器',
          required: false,
          description: '流程触发器，支持自动触发流程执行',
          tooltip: '配置自动触发流程的触发器，如 Webhook、Schedule 等',
          dynamic: false,
        },
      },
    ];
  },

  saveConfig(config: Record<string, any>, store: any): void {
    if (!store.currentWorkflow) return;
    const processedInputs = (config.inputs || [])
      .filter((input: any) => input.id && input.type)
      .map((input: any) => {
        const result: Record<string, any> = {
          id: input.id,
          type: input.type,
        };

        if (input.displayName) {
          result.displayName = input.displayName;
        }

        if (input.required) {
          result.required = true;
        }

        // ARRAY 类型必须包含 itemType
        if (input.type === 'ARRAY' && input.itemType) {
          result.itemType = input.itemType;
        }

        // 所有类型都支持默认值保存
        if (input.defaults !== undefined && input.defaults !== null) {
          // 对 STRING 类型，空字符串不保存
          if (input.type === 'STRING' && input.defaults === '') {
            // 跳过
          } else {
            result.defaults = input.defaults;
          }
        }

        return result;
      });
    store.currentWorkflow.inputs = processedInputs;
    store.currentWorkflow.triggers = config.triggers || [];
  },
};

flowControlNodeRegistry.register(StartNodeStrategy);
