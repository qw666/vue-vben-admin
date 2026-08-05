import type {
  FlowControlNodeConfig,
  FlowControlNodeStrategy,
  SchemaNodeMeta,
  WorkflowNodePort,
} from './types';
import type { SchemaNode } from '../composables/useSchemaParser';
import {
  internalResolveRef,
  initFormFieldValue,
  serializeFieldValue,
} from '../composables/useSchemaParser';
import { renderFormField } from '../composables/useFormFieldResolver';

/**
 * SchemaNodeStrategy: 将后端 Schema 节点适配为 FlowControlNodeStrategy 接口。
 * 所有后端动态节点（通过 formSchema 驱动的节点）都使用此适配器。
 */
export class SchemaNodeStrategy implements FlowControlNodeStrategy {
  nodeType: string;
  config: FlowControlNodeConfig;
  private meta: SchemaNodeMeta;

  constructor(meta: SchemaNodeMeta) {
    this.meta = meta;
    this.nodeType = meta.nodeType;
    this.config = {
      nodeType: meta.nodeType,
      nodeName: meta.nodeName,
      icon: meta.icon,
      description: meta.description,
      ports: {
        input: 1,
        output: [
          {
            field: 'output',
            label: 'Next',
            color: '#10b981',
            connectionType: 'single',
            connectionMode: 'sequential',
          } as WorkflowNodePort,
        ],
      },
      taskFields: meta.taskFields || [],
    };
  }

  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const { formProperties = {}, formDefs = {} } = this.meta;
    const config: Record<string, any> = {};

    Object.keys(formProperties).forEach(key => {
      if (key !== '$schema') {
        const prop = formProperties[key];
        if (!prop) return;
        if (savedConfig[key] !== undefined) {
          if (prop.anyOf) {
            this.initAnyOfField(config, key, prop, savedConfig[key]);
          } else if (prop.type === 'object') {
            const savedValue = savedConfig[key];
            if (prop.additionalProperties && prop.additionalProperties.type === 'array') {
              config[key] = savedValue || {};
            } else {
              config[key] = Array.isArray(savedValue)
                ? savedValue
                : Object.entries(savedValue || {}).map(([k, v]) => ({ key: k, value: v }));
            }
          } else {
            config[key] = savedConfig[key];
          }
        } else {
          config[key] = initFormFieldValue(prop, formDefs);
        }
      }
    });

    return config;
  }

  private initAnyOfField(
    config: Record<string, any>,
    key: string,
    prop: SchemaNode,
    savedValue: any,
  ): void {
    const anyOf = prop.anyOf!;
    let selectedIndex = 0;

    for (let i = 0; i < anyOf.length; i++) {
      const option = anyOf[i];
      if (!option) continue;
      if (option.const !== undefined && option.const === savedValue) {
        selectedIndex = i;
        break;
      }
      if (option.default !== undefined && option.default === savedValue) {
        selectedIndex = i;
        break;
      }
      // 数组类型需要特殊处理：typeof [] === 'object'，不能直接用 typeof 判断
      if (option.type === 'array' && Array.isArray(savedValue)) {
        selectedIndex = i;
        break;
      }
      if (option.type && option.type !== 'array' && option.type === typeof savedValue) {
        selectedIndex = i;
        break;
      }
      if (option.$ref) {
        const refSchema = internalResolveRef(option.$ref, this.meta.formDefs);
        if (refSchema && refSchema.type === 'object' && typeof savedValue === 'object' && !Array.isArray(savedValue)) {
          selectedIndex = i;
          break;
        }
      }
    }

    config[key] = selectedIndex;

    const selectedOption = anyOf[selectedIndex];
    const hasSubFields =
      selectedOption?.properties && Object.keys(selectedOption.properties).length > 0;

    if (hasSubFields && typeof savedValue === 'object' && savedValue !== null) {
      config[key + '_values'] = savedValue;
    } else {
      config[key + '_value'] = savedValue;
    }
  }

  getRequiredFields(formValues: Record<string, any> = {}): { type: string; props: Record<string, any> }[] {
    try {
      return this.getFields(formValues, true);
    } catch (e: any) {
      console.error('[SchemaNodeStrategy] getRequiredFields error:', e?.message || e, this.nodeType);
      return [];
    }
  }

  getOptionalFields(formValues: Record<string, any> = {}): { type: string; props: Record<string, any> }[] {
    try {
      return this.getFields(formValues, false);
    } catch (e: any) {
      console.error('[SchemaNodeStrategy] getOptionalFields error:', e?.message || e, this.nodeType);
      return [];
    }
  }

  private getFields(
    formValues: Record<string, any>,
    isRequired: boolean,
  ): { type: string; props: Record<string, any> }[] {
    const { formProperties = {}, formRequired = [], formDefs = {} } = this.meta;
    const fields: { type: string; props: Record<string, any> }[] = [];

    Object.keys(formProperties).forEach(key => {
      if (key === '$schema') return;
      const prop = formProperties[key];
      if (!prop) return;

      const propIsRequired = prop.$required === true || formRequired.includes(key);
      if (isRequired !== propIsRequired) return;

      const value = formValues[key];
      const onUpdate = (val: any) => {
        formValues[key] = val;
      };

      const field = renderFormField(
        formProperties,
        key,
        propIsRequired,
        formDefs,
        value,
        onUpdate,
        this.nodeType,
      );
      if (field) {
        fields.push(field);
      }
    });

    return fields;
  }

  serializeConfig(config: Record<string, any>): Record<string, any> {
    const { formProperties = {}, formDefs = {} } = this.meta;
    const result: Record<string, any> = {};

    try {
      Object.keys(formProperties).forEach(key => {
        if (key === '$schema') return;
        const schema = formProperties[key];
        if (!schema) return;

        if (schema.anyOf) {
          const selectedIndex = config[key];
          const subValues = config[key + '_values'];
          const directValue = config[key + '_value'];

          // 幂等性处理：如果 config[key] 已经是序列化后的值（不是索引）
          // 则直接使用该值，不需要再次通过 anyOf 索引查找
          if (typeof selectedIndex !== 'number' || selectedIndex >= schema.anyOf.length) {
            // config[key] 已经是最终值（如字符串 'm'），直接使用
            if (selectedIndex !== undefined && selectedIndex !== null) {
              result[key] = selectedIndex;
            }
            return;
          }

          if (selectedIndex !== undefined && selectedIndex !== null) {
            const selectedOption = schema.anyOf[selectedIndex];
            if (selectedOption) {
              const values = subValues || directValue;
              if (values !== undefined) {
                result[key] = serializeFieldValue(selectedOption, values, formDefs);
              }
            }
          }
        } else {
          result[key] = serializeFieldValue(schema, config[key], formDefs);
        }
      });
    } catch (e: any) {
      console.error('[SchemaNodeStrategy] serializeConfig error:', e?.message || e, this.nodeType);
    }

    return result;
  }

  validateConfig(config: Record<string, any>): string | null {
    const { formProperties = {}, formRequired = [] } = this.meta;

    for (const key of formRequired) {
      const value = config[key];
      if (value === undefined || value === null || value === '') {
        const schema = formProperties[key];
        const label = schema?.title || key;
        return `请填写必填项：${label}`;
      }
    }

    return null;
  }

  getOutputs(): { key: string; label?: string }[] {
    return this.meta.outputKeys || [];
  }

  getNodeDescription(): { title?: string; description?: string } {
    return {
      title: this.meta.nodeName,
      description: this.meta.description,
    };
  }
}

