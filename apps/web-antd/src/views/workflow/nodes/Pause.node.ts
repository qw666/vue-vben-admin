import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';
import { getFlowControlConfig } from '../config/workflow-node-config';

export const PauseNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Pause',
  config: {
    nodeType: 'idp_core_flow_Pause',
    nodeName: '暂停',
    icon: 'mdi:pause',
    description: '暂停等待',
    ports: {
      input: 1,
      output: [
        { field: 'next', label: 'Next', color: '#8b5cf6', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: [],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const deserialized = this.deserializeConfig?.(savedConfig) || savedConfig;
    return {
      pauseDuration: deserialized.pauseDuration || '',
      behavior: deserialized.behavior || 'RESUME',
      onResume: deserialized.onResume || [],
      next: deserialized.next || savedConfig.resume || [],
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    const result = { ...config };
    if (Array.isArray(result.onResume)) {
      result.onResume = result.onResume.map((item: any) => {
        const { itemType, required, ...rest } = item;
        return rest;
      });
    }
    return result;
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    const result = { ...config };
    if (Array.isArray(result.onResume)) {
      result.onResume = result.onResume.map((item: any) => {
        const { itemType, ...rest } = item;
        return {
          ...rest,
          required: rest.required !== undefined ? rest.required : true,
        };
      });
    }
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
  getRequiredFields(): { props: Record<string, any>; type: string; }[] {
    return [];
  },
  getOptionalFields(): { props: Record<string, any>; type: string; }[] {
    return [
      {
        type: 'InfoBox',
        props: {
          key: '_usage_guide',
          title: 'Pause 节点使用说明',
          icon: 'mdi:lightbulb-on',
          iconColor: '#d97706',
          background: '#fffbeb',
          borderColor: '#fcd34d',
          titleColor: '#92400e',
          steps: [
            '流程执行到此节点时会暂停，等待指定时长或手动恢复',
            '在「暂停时长」中设置等待时间；不设置则永久等待，直到手动恢复',
            '在「超时行为」中设置到达时长后的行为：继续/警告/失败/取消',
            '在「onResume」中添加恢复时需要用户填写的输入字段，后续任务可通过 {{outputs.pause_task_id.onResume.field_id}} 引用',
            '从节点底部的 Next 端口拖线，连接恢复后要执行的下游任务',
          ],
        },
      },
      {
        type: 'Duration',
        props: { key: 'pauseDuration', label: '暂停时长', required: false, description: '不设置则永久等待，直到手动恢复', tooltip: '暂停执行的时间长度。到达此时长后，将根据「超时行为」决定后续操作。' },
      },
      {
        type: 'EnumSelect',
        props: { key: 'behavior', label: '超时行为', required: false, description: '到达暂停时长后的行为', tooltip: '当暂停任务到达持续时间时执行的行为。默认值为 RESUME。在持续时间之前恢复的任务（例如从 UI）将不会使用此属性，而是始终成功。RESUME=继续执行，WARN=以 WARNING 状态结束并继续执行，FAIL=暂停任务失败，CANCEL=取消执行。', dynamic: false, options: [
          { value: 'RESUME', label: 'RESUME - 继续执行' },
          { value: 'WARN', label: 'WARN - 警告后继续' },
          { value: 'FAIL', label: 'FAIL - 执行失败' },
          { value: 'CANCEL', label: 'CANCEL - 取消执行' },
        ]},
      },
      {
        type: 'OnResume',
        props: { key: 'onResume', label: 'onResume', required: false, description: '恢复时需要填写的输入字段', tooltip: '在恢复执行前，用户需要填写的输入字段。支持 STRING、INT、LONG、FLOAT、DOUBLE、BOOL、DATE、TIME、DATETIME、DURATION、ARRAY、JSON、URI 等类型。这些输入可以在后续任务中通过 {{outputs.pause_task_id.onResume.field_id}} 访问。', dynamic: false },
      },
    ];
  },
};

flowControlNodeRegistry.register(PauseNodeStrategy);
