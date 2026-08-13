import type { SchemaNode } from './useSchemaParser';
import { internalResolveRef } from './useSchemaParser';

export interface TriggerRenderedField {
  type: string;
  props: {
    key: string;
    label: string;
    tooltip: string;
    required: boolean;
    dynamic: boolean;
    fieldType?: string;
    modelValue?: any;
    'onUpdate:modelValue'?: (val: any) => void;
    [key: string]: any;
  };
}

function createFieldProps(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void
): TriggerRenderedField['props'] {
  return {
    key: fieldKey,
    label: fieldSchema.title || fieldKey,
    tooltip: fieldSchema.description || '',
    required: isRequired,
    dynamic: fieldSchema.$dynamic === true,
    fieldType: fieldSchema.type,
    modelValue: value,
    'onUpdate:modelValue': onUpdate,
  };
}

/**
 * 触发器专用的 string 字段解析
 * 支持：enum、$secret、format(date-time/time/date)、$dynamic
 */
function resolveTriggerStringField(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void
): TriggerRenderedField {
  if (fieldSchema.enum) {
    return {
      type: 'EnumSelect',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        options: fieldSchema.enum,
        placeholder: fieldSchema.description || '请选择',
      },
    };
  }
  // $secret 字段渲染为密码组件，但 username 除外（明文显示）
  if (fieldSchema.$secret === true && fieldKey !== 'username') {
    return {
      type: 'Password',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        placeholder: fieldSchema.description || '请输入',
      },
    };
  }
  if (fieldSchema.format === 'date-time') {
    return {
      type: 'DateTimePicker',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        placeholder: fieldSchema.description || '选择日期时间',
      },
    };
  }
  if (fieldSchema.format === 'time') {
    return {
      type: 'TimePicker',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        placeholder: fieldSchema.description || '选择时间',
      },
    };
  }
  if (fieldSchema.format === 'date') {
    return {
      type: 'DatePicker',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        placeholder: fieldSchema.description || '选择日期',
      },
    };
  }
  if (fieldSchema.format === 'duration') {
    return {
      type: 'Duration',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        placeholder: fieldSchema.description || '设置时长',
      },
    };
  }
  if (fieldSchema.$dynamic === true) {
    return {
      type: 'VarPicker',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        placeholder: fieldSchema.description || '点击选择变量',
        allowExpression: true,
      },
    };
  }
  return {
    type: 'Input',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
      placeholder: fieldSchema.description || '请输入',
    },
  };
}

/**
 * 触发器专用的 array 字段解析
 * 支持：$ref、type=object、anyOf(conditions数组)、enum(多选)
 */
function resolveTriggerArrayField(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void,
  defs: Record<string, SchemaNode>
): TriggerRenderedField {
  const itemsSchema = fieldSchema.items;

  // $ref 引用
  if (itemsSchema && itemsSchema.$ref) {
    const refSchema = internalResolveRef(itemsSchema.$ref, defs);
    if (refSchema && refSchema.properties) {
      return {
        type: 'ArrayTable',
        props: {
          ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
          itemsSchema: refSchema,
          minItems: fieldSchema.minItems,
        },
      };
    }
  }

  // 对象类型数组
  if (itemsSchema && itemsSchema.type === 'object') {
    return {
      type: 'ArrayTable',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
        itemsSchema,
        minItems: fieldSchema.minItems,
      },
    };
  }

  // anyOf 数组（触发器专用：处理 conditions 数组，支持 Or 条件）
  if (itemsSchema && itemsSchema.anyOf) {
    const resolvedAnyOf = itemsSchema.anyOf.map((opt: SchemaNode) => {
      if (opt.$ref) {
        return internalResolveRef(opt.$ref, defs) || opt;
      }
      return opt;
    });
    return {
      type: 'AnyOfArray',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
        itemsSchema: { ...itemsSchema, anyOf: resolvedAnyOf },
        minItems: fieldSchema.minItems,
      },
    };
  }

  // enum 数组（触发器专用：多选）
  if (itemsSchema && itemsSchema.enum) {
    return {
      type: 'MultiSelect',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
        options: itemsSchema.enum,
        minItems: fieldSchema.minItems,
      },
    };
  }

  // 默认：字符串数组
  return {
    type: 'StringArray',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
      minItems: fieldSchema.minItems,
    },
  };
}

/**
 * 触发器专用的 numeric 字段解析
 */
function resolveTriggerNumericField(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void
): TriggerRenderedField {
  return {
    type: 'InputNumber',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
      min: fieldSchema.minimum,
    },
  };
}

/**
 * 触发器专用的 boolean 字段解析
 */
function resolveTriggerBooleanField(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void
): TriggerRenderedField {
  return {
    type: 'Switch',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
      checked: value,
      onChange: onUpdate,
    },
  };
}

const TRIGGER_TYPE_RESOLVERS: Record<string, (
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void,
  defs: Record<string, SchemaNode>
) => TriggerRenderedField> = {
  string: resolveTriggerStringField,
  number: resolveTriggerNumericField,
  integer: resolveTriggerNumericField,
  boolean: resolveTriggerBooleanField,
  array: resolveTriggerArrayField,
};

/**
 * 触发器专用的字段渲染入口函数
 * 与 renderFormField 完全解耦，包含触发器专属的 format、$secret、anyOf 逻辑
 */
export function renderTriggerField(
  properties: Record<string, SchemaNode>,
  fieldKey: string,
  isRequired: boolean,
  defs: Record<string, SchemaNode> = {},
  value: any = undefined,
  onUpdate: (val: any) => void = () => {}
): TriggerRenderedField {
  const fieldSchema = properties[fieldKey];
  if (!fieldSchema) {
    return {
      type: 'Input',
      props: {
        key: fieldKey,
        label: fieldKey,
        tooltip: '',
        required: isRequired,
        dynamic: false,
        modelValue: undefined,
        'onUpdate:modelValue': () => {},
        placeholder: '未知字段',
      },
    };
  }

  if (fieldSchema.type) {
    const resolver = TRIGGER_TYPE_RESOLVERS[fieldSchema.type];
    if (resolver) {
      return resolver(fieldKey, fieldSchema, isRequired, value, onUpdate, defs);
    }
  }

  // 默认：Input
  return {
    type: 'Input',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
      placeholder: fieldSchema.description || '请输入',
    },
  };
}

/**
 * 触发器专用的子字段提取函数
 * 用于提取 anyOf 选项的子字段
 */
export function extractTriggerSubFields(schema: SchemaNode, defs: Record<string, SchemaNode>): TriggerRenderedField[] {
  if (!schema.properties) return [];
  const mergedDefs = { ...defs, ...(schema.$defs || {}) };
  return Object.keys(schema.properties)
    .filter(key => key !== '$schema')
    .map(subKey => {
      const subIsRequired = (schema.required || []).includes(subKey);
      const subValue: any = undefined;
      const subOnUpdate = () => {};
      return renderTriggerField(schema.properties!, subKey, subIsRequired, mergedDefs, subValue, subOnUpdate);
    });
}
