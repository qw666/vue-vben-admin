import type { FlowControlNodeStrategy, NodeOutputDef } from './types';
import { flowControlNodeRegistry } from './types';

/**
 * OutputValues 节点策略
 * 
 * Kestra 规范：
 * - 配置：values 对象（键值对），每个键是输出变量名
 * - 输出访问：{{ outputs.nodeId.values.key }}
 * 
 * 示例：
 *   配置：{ values: { data: "hello", count: 42 } }
 *   输出：
 *     - {{ outputs.nodeId.values.data }}
 *     - {{ outputs.nodeId.values.count }}
 */
export const OutputValuesNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_output_OutputValues',
  config: {
    nodeType: 'idp_core_output_OutputValues',
    nodeName: '输出变量',
    icon: 'mdi:export',
    description: '输出流程变量',
    ports: {
      input: 1,
      output: [
        { field: 'output', label: 'Next', color: '#10b981', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: [],
  },

  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    // 先反序列化（将 values 对象转换为 outputs 数组）
    const deserialized = this.deserializeConfig?.(savedConfig) || savedConfig;
    return {
      outputs: deserialized.outputs || [],
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    // 将 outputs 数组转换为 values 对象（Kestra 格式）
    if (config.outputs && Array.isArray(config.outputs) && config.outputs.length > 0) {
      const values: Record<string, any> = {};
      for (const item of config.outputs) {
        if (item?.name) {
          values[item.name] = item.value || '';
        }
      }
      if (Object.keys(values).length > 0) {
        result.values = values;
      }
    }

    return result;
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    // 支持两种格式：
    // 1. 前端格式：{ outputs: [{ name: 'xxx', value: 'yyy' }] }
    // 2. Kestra 格式：{ values: { xxx: 'yyy' } }
    
    // 如果已经有 outputs 数组，直接使用
    if (Array.isArray(config.outputs) && config.outputs.length > 0) {
      return {
        outputs: config.outputs.map((item: any) => ({
          name: item.name || '',
          value: item.value || '',
        })),
      };
    }
    
    // 否则从 values 对象转换
    const values = config.values || {};
    const outputs: Array<{ name: string; value: string }> = [];
    
    if (values && typeof values === 'object') {
      for (const [name, value] of Object.entries(values)) {
        outputs.push({
          name,
          value: typeof value === 'string' ? value : JSON.stringify(value),
        });
      }
    }

    return {
      outputs,
    };
  },

  handleConnection(): void {
  },

  /**
   * 获取节点的输出变量声明
   * 
   * 根据 Kestra 规范，OutputValues 节点的输出以 "values" 为固定前缀：
   * {{ outputs.nodeId.values.key }}
   * 
   * 支持两种配置格式：
   * - 前端格式：{ outputs: [{ name: 'xxx', value: 'yyy' }] }
   * - Kestra 格式：{ values: { xxx: 'yyy' } }
   */
  getOutputs(config: Record<string, any>): NodeOutputDef[] {
    const result: NodeOutputDef[] = [];

    console.log('[OutputValues.getOutputs] config:', JSON.stringify(config));

    // 优先处理前端格式：outputs 数组
    const outputs = config?.outputs;
    if (Array.isArray(outputs)) {
      for (const item of outputs) {
        if (item?.name) {
          result.push({
            key: `values.${item.name}`,
            label: item.name,
            type: 'any',
          });
        }
      }
    }

    // 处理 Kestra 格式：values 对象
    const values = config?.values;
    if (values && typeof values === 'object' && !Array.isArray(values)) {
      for (const name of Object.keys(values)) {
        if (!result.some(r => r.key === `values.${name}`)) {
          result.push({
            key: `values.${name}`,
            label: name,
            type: 'any',
          });
        }
      }
    }

    console.log('[OutputValues.getOutputs] result:', JSON.stringify(result));
    return result;
  },

  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'ArrayTable',
        props: {
          key: 'outputs',
          label: '输出变量',
          description: '配置输出的变量列表，每个变量包含名称和值',
          itemsSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', title: '变量名', $required: true },
              value: { type: 'string', title: '变量值', $dynamic: true, $required: true },
            },
          },
        },
      },
    ];
  },

  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },
};

flowControlNodeRegistry.register(OutputValuesNodeStrategy);
