import type { FlowControlNodeStrategy, NodeOutputDef } from './types';
import { flowControlNodeRegistry } from './types';

/**
 * OutputValues（输出变量）节点策略
 *
 * 完全由前端维护，不依赖后端元数据：
 * - 基本信息（nodeName/icon/description/ports）由前端策略维护
 * - 配置面板由前端 ObjectInputField 字段渲染（键值对编辑）
 * - 输出变量动态生成，根据 config.values 键值对
 *
 * 数据格式说明：
 * - 前端编辑格式（nodeConfigForm.values）: [{ key: 'var1', value: '{{ expr }}' }]
 * - 后端存储格式（Kestra values）: { values: { var1: '{{ expr }}' } }
 * - deserializeConfig 负责后端 → 前端转换
 * - serializeConfig 负责前端 → 后端转换
 */
export const OutputValuesNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_output_OutputValues',
  config: {
    nodeType: 'idp_core_output_OutputValues',
    nodeName: '输出变量',
    icon: 'mdi:export',
    description: '输出流程变量',
    group: 'tools',
    ports: {
      input: 1,
      output: [
        { field: 'output', label: 'Next', color: '#10b981', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: [],
  },

  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const deserialized = this.deserializeConfig?.(savedConfig) || savedConfig;
    return {
      values: Array.isArray(deserialized.values) ? deserialized.values : [],
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    if (Array.isArray(config.values)) {
      // 前端数组格式 → 后端对象格式
      const values: Record<string, any> = {};
      for (const item of config.values) {
        if (item && item.key && item.value !== undefined && item.value !== null && item.value !== '') {
          values[item.key] = item.value;
        }
      }
      if (Object.keys(values).length > 0) {
        result.values = values;
      }
    } else if (config.values && typeof config.values === 'object' && !Array.isArray(config.values)) {
      // 兼容：如果 values 已经是对象格式，直接使用
      const values: Record<string, any> = {};
      for (const [k, v] of Object.entries(config.values)) {
        if (k && v !== undefined && v !== null && v !== '') {
          values[k] = v;
        }
      }
      if (Object.keys(values).length > 0) {
        result.values = values;
      }
    }
    return result;
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    // 后端对象格式 → 前端数组格式
    const rawValues = config.values;
    let values: Array<{ key: string; value: string }> = [];

    if (Array.isArray(rawValues)) {
      // 已经是数组格式（向前兼容）
      values = rawValues
        .filter((item: any) => item && item.key)
        .map((item: any) => ({ key: String(item.key), value: String(item.value ?? '') }));
    } else if (rawValues && typeof rawValues === 'object') {
      // 后端 Kestra 对象格式
      values = Object.entries(rawValues).map(([key, value]) => ({
        key,
        value: String(value ?? ''),
      }));
    }

    return { values };
  },

  handleConnection(): void {
  },

  /**
   * 根据 config.values 键值对动态生成输出变量声明。
   * 访问格式: {{ outputs.nodeId.values.keyName }}
   */
  getOutputs(config: Record<string, any>): NodeOutputDef[] {
    const values = config?.values;
    if (!Array.isArray(values)) return [];
    const result: NodeOutputDef[] = [];
    for (const item of values) {
      const key = typeof item === 'string' ? item : (item?.key || '');
      if (!key) continue;
      result.push({ key: `values.${key}`, label: key, type: 'any' });
    }
    return result;
  },

  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [
      {
        type: 'ObjectInput',
        props: {
          key: 'values',
          label: '输出变量',
          required: false,
          description: '定义该节点输出的变量，可在下游节点通过 {{ outputs.节点ID.values.变量名 }} 引用',
          tooltip: '点击添加按钮创建输出变量，变量值支持手写表达式或通过 / 选择上游变量',
          placeholder: '暂无输出变量，点击"添加"按钮创建',
          dynamic: true,
        },
      },
    ];
  },

  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },
};

flowControlNodeRegistry.register(OutputValuesNodeStrategy);
