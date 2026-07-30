import type { FlowControlNodeStrategy } from './types';
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
    nodeName: 'Python代码',
    icon: 'mdi:language-python',
    description: 'Python代码执行节点',
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

  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },

  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },
};

flowControlNodeRegistry.register(CodeNodeStrategy);
