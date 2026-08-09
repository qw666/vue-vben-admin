import type {
  FlowControlNodeConfig,
  FlowControlNodeStrategy,
  NodeOutputDef,
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
import { evalCondition } from '../utils/conditionEval';

/** 分组优先级：数值越小越靠前 */
const GROUP_PRIORITY: Record<string, number> = {
  main: 1,
  connection: 2,
  execution: 3,
  source: 4,
  destination: 5,
  advanced: 6,
  default: 99,
};

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
      group: 'tools',
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
            // 存储实际值到主字段，选项索引由 AnyOfRadioField 组件内部管理
            config[key] = savedConfig[key];
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

    // 1. 按 $group 分组收集字段
    const groupMap = new Map<string, { type: string; props: Record<string, any> }[]>();
    const groupOrder = new Map<string, number>(); // 记录分组出现顺序

    Object.keys(formProperties).forEach((key) => {
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
      if (!field) return;

      const group = prop.$group || 'default';
      if (!groupMap.has(group)) {
        groupMap.set(group, []);
        groupOrder.set(group, groupOrder.size);
      }
      groupMap.get(group)!.push(field);
    });

    // 2. 按分组优先级排序
    const sortedGroups = Array.from(groupMap.entries()).sort(([groupA], [groupB]) => {
      const priorityA = GROUP_PRIORITY[groupA] ?? 99;
      const priorityB = GROUP_PRIORITY[groupB] ?? 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      // 同优先级保持原始出现顺序
      return (groupOrder.get(groupA) ?? 0) - (groupOrder.get(groupB) ?? 0);
    });

    // 3. 扁平化输出
    return sortedGroups.flatMap(([, fields]) => fields);
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
          // 选项索引由 AnyOfRadioField 组件内部管理，这里根据值的类型自动推断
          const value = config[key];
          const selectedIndex = this.inferAnyOfIndex(schema.anyOf, value);

          if (selectedIndex !== undefined && selectedIndex !== null && typeof selectedIndex === 'number') {
            const selectedOption = schema.anyOf[selectedIndex];
            if (selectedOption && value !== undefined) {
              result[key] = serializeFieldValue(selectedOption, value, formDefs);
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

  /**
   * 根据值的类型推断 anyOf 选项索引
   */
  private inferAnyOfIndex(anyOf: any[], value: any): number {
    if (value === undefined || value === null) return 0;

    for (let i = 0; i < anyOf.length; i++) {
      const option = anyOf[i];
      if (!option) continue;

      if (option.type === 'array' && Array.isArray(value)) {
        return i;
      }
      if (option.type && option.type !== 'array' && option.type === typeof value) {
        return i;
      }
      if (option.$ref) {
        const refSchema = internalResolveRef(option.$ref, this.meta.formDefs);
        if (refSchema && refSchema.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
          return i;
        }
      }
    }

    return 0;
  }

  validateConfig(config: Record<string, any>): string | null {
    const { formProperties = {}, formRequired = [] } = this.meta;

    for (const key of formRequired) {
      const schema = formProperties[key];
      // 直接检查主字段的值（不再依赖 _index）
      const value = config[key];
      if (value === undefined || value === null || value === '') {
        const label = schema?.title || key;
        return `请填写必填项：${label}`;
      }
    }

    return null;
  }

  getOutputs(config: Record<string, any>): NodeOutputDef[] {
    // 优先使用带 condition 的 outputs 字段（支持条件过滤）
    if (this.meta.outputs && this.meta.outputs.length > 0) {
      return this.meta.outputs
        .filter((o) => o?.key && evalCondition(o.condition, config || {}))
        .map((o) => ({
          key: o.key,
          label: o.label || o.key,
          type: (o.type as NodeOutputDef['type']) || 'any',
        }));
    }
    // 向后兼容：使用 outputKeys（无条件过滤）
    return (this.meta.outputKeys || []).map((o) => ({
      key: o.key,
      label: o.label || o.key,
      type: 'any' as const,
    }));
  }

  getNodeDescription(): { title?: string; description?: string } {
    return {
      title: this.meta.nodeName,
      description: this.meta.description,
    };
  }
}

