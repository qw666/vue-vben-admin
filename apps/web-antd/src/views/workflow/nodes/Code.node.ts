import type { FlowControlNodeStrategy, NodeOutputDef } from './types';
import { flowControlNodeRegistry } from './types';

const DEFAULT_SOURCE_CODE = `def main(inputs):
    # 通过 inputs["参数key"] 获取上游传入的数据
    # 业务逻辑编写位置

    # return 字典作为节点输出，传递给下游节点
    return {

    }`;

export const CodeNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_scripts_python_Script',
  config: {
    nodeType: 'idp_scripts_python_Script',
    nodeName: '代码执行',
    icon: 'mdi:code-braces',
    description: 'Python代码执行节点',
    group: 'tools',
    category: 'code',
    ports: {
      input: 1,
      output: [
        { field: 'output', label: 'Next', color: '#f59e0b', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: [],
  },

  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    return {
      inputParams: savedConfig.inputParams || [],
      sourceCode: savedConfig.sourceCode || DEFAULT_SOURCE_CODE,
      outputKeys: savedConfig.outputKeys || [],
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    if (config.sourceCode) {
      result.sourceCode = config.sourceCode;
    }

    if (config.inputParams && Array.isArray(config.inputParams) && config.inputParams.length > 0) {
      result.inputParams = config.inputParams.map((item: any) => ({
        key: item.key,
        expression: item.expression || '',
        defaultValue: item.defaultValue || '',
      }));
    }

    if (config.outputKeys && Array.isArray(config.outputKeys) && config.outputKeys.length > 0) {
      result.outputKeys = config.outputKeys.map((item: any) => {
        if (typeof item === 'string') {
          return { key: item, remark: '' };
        }
        return { key: item.key || '', remark: item.remark || '' };
      });
    }

    return result;
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    return {
      inputParams: (config.inputParams || []).map((item: any) => ({
        key: item.key || '',
        expression: item.expression || '',
        defaultValue: item.defaultValue || '',
      })),
      sourceCode: config.sourceCode || DEFAULT_SOURCE_CODE,
      outputKeys: (config.outputKeys || []).map((item: any) => {
        if (typeof item === 'string') {
          return { key: item, remark: '' };
        }
        return { key: item.key || '', remark: item.remark || '' };
      }),
    };
  },

  handleConnection(): void {
  },

  getOutputs(config: Record<string, any>): NodeOutputDef[] {
    const keys = config?.outputKeys;
    if (!Array.isArray(keys)) return [];
    const result: NodeOutputDef[] = [];
    for (const item of keys) {
      const key = typeof item === 'string' ? item : (item?.key || '');
      if (!key) continue;
      // Kestra Python Script 输出变量存储在 vars 对象下
      // 访问格式: {{ outputs.nodeId.vars.keyName }}
      result.push({ key: `vars.${key}`, label: key, type: 'any' });
    }
    return result;
  },

  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },

  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },

  /**
   * 声明专用配置组件
   * 注意：实际组件注册在 nodes/index.ts 中通过 nodeConfigComponentRegistry.register 完成
   * 这里返回 null 表示没有内置组件，配置组件由外部注册表管理
   */
  getConfigComponent(): null {
    return null;
  },

  /**
   * 保存前校验（基础校验，复杂语法校验保留在 CodeConfig 组件内部）
   * 检查代码是否为空，main(inputs) 函数是否存在
   */
  validateBeforeSave(config: Record<string, any>): string | null {
    const code = config.sourceCode || '';
    if (!code.trim()) {
      return '代码不能为空';
    }
    if (!/def\s+main\s*\(\s*inputs\s*\)/.test(code)) {
      return '代码中未找到 main(inputs) 函数';
    }
    return null;
  },
};

flowControlNodeRegistry.register(CodeNodeStrategy);
