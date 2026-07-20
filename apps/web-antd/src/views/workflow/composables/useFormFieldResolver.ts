import { getFlowControlTaskFields } from '../config/workflow-node-config';
import type { SchemaNode } from './useSchemaParser';
import { internalResolveRef, internalIsTaskRef } from './useSchemaParser';

export interface RenderedField {
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

export interface AnyOfOption {
  value: number;
  label: string;
  schema?: SchemaNode;
  subFields?: RenderedField[];
}

function createFieldProps(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void
): RenderedField['props'] {
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

function resolveStringField(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void
): RenderedField {
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
  return {
    type: 'Input',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
      placeholder: fieldSchema.description || '请输入',
    },
  };
}

function resolveNumericField(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void
): RenderedField {
  return {
    type: 'InputNumber',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
      min: fieldSchema.minimum,
    },
  };
}

function resolveBooleanField(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void
): RenderedField {
  return {
    type: 'Switch',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
      checked: value,
      onChange: onUpdate,
    },
  };
}

function resolveArrayField(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void,
  defs: Record<string, SchemaNode>,
  selectedNodeType: string
): RenderedField {
  const itemsSchema = fieldSchema.items;

  if (itemsSchema && internalIsTaskRef(itemsSchema)) {
    const taskFields = getFlowControlTaskFields(selectedNodeType);
    if (taskFields.includes(fieldKey)) {
      return {
        type: 'ConnectionStatus',
        props: {
          ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
          itemsSchema,
          minItems: fieldSchema.minItems,
        },
      };
    } else {
      return {
        type: 'NodeArray',
        props: {
          ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
          itemsSchema,
          minItems: fieldSchema.minItems,
        },
      };
    }
  }

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

  if (itemsSchema && itemsSchema.type === 'string') {
    return {
      type: 'StringArray',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
        minItems: fieldSchema.minItems,
      },
    };
  }

  if (itemsSchema && (itemsSchema.type === 'integer' || itemsSchema.type === 'number')) {
    return {
      type: 'NumberArray',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
        minItems: fieldSchema.minItems,
      },
    };
  }

  return {
    type: 'Textarea',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, typeof value === 'string' ? value : JSON.stringify(value, null, 2), onUpdate),
      placeholder: fieldSchema.minItems && fieldSchema.minItems > 0 ? `至少${fieldSchema.minItems}项，JSON数组格式` : fieldSchema.description || '请输入JSON数组',
      rows: 4,
    },
  };
}

function resolveObjectField(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void
): RenderedField {
  const additionalProps = fieldSchema.additionalProperties;
  if (additionalProps && additionalProps.type === 'array') {
    const itemsSchema = additionalProps.items;
    if (itemsSchema && internalIsTaskRef(itemsSchema)) {
      return {
        type: 'SwitchCases',
        props: {
          ...createFieldProps(fieldKey, fieldSchema, isRequired, value || {}, onUpdate),
          additionalProps,
        },
      };
    }
  }

  return {
    type: 'ObjectInput',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
      placeholder: '请添加键值对',
    },
  };
}

function extractSubFields(schema: SchemaNode, defs: Record<string, SchemaNode>): RenderedField[] {
  if (!schema.properties) return [];
  const mergedDefs = { ...defs, ...(schema.$defs || {}) };
  return Object.keys(schema.properties)
    .filter(key => key !== '$schema')
    .map(subKey => {
      const subIsRequired = (schema.required || []).includes(subKey);
      const subValue: any = undefined;
      const subOnUpdate = () => {};
      return renderFormField(schema.properties!, subKey, subIsRequired, mergedDefs, subValue, subOnUpdate, '');
    });
}

function resolveAnyOfField(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void,
  defs: Record<string, SchemaNode>
): RenderedField {
  const options: AnyOfOption[] = fieldSchema.anyOf!.map((opt: SchemaNode, index: number) => {
    if (opt.$ref) {
      const refSchema = internalResolveRef(opt.$ref, defs);
      const refTitle = refSchema?.title || opt.title || '未命名';
      return {
        value: index,
        label: refTitle,
        schema: refSchema,
        subFields: refSchema ? extractSubFields(refSchema, { ...defs, ...(refSchema.$defs || {}) }) : [],
      };
    }
    return {
      value: index,
      label: opt.title || (opt.const !== undefined ? opt.const.toString() : opt.type || `选项 ${index + 1}`),
      schema: opt,
      subFields: extractSubFields(opt, defs),
    };
  });

  return {
    type: 'AnyOfRadio',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
      options,
    },
  };
}

function resolveRefField(
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void,
  defs: Record<string, SchemaNode>
): RenderedField {
  if (internalIsTaskRef(fieldSchema)) {
    return {
      type: 'ConnectionStatus',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
        itemsSchema: fieldSchema,
        minItems: 0,
      },
    };
  }

  const refSchema = internalResolveRef(fieldSchema.$ref!, defs);
  if (refSchema) {
    if (refSchema.properties) {
      return {
        type: 'RefObject',
        props: {
          ...createFieldProps(fieldKey, fieldSchema, isRequired, value || {}, onUpdate),
          subFields: extractSubFields(refSchema, { ...defs, ...(refSchema.$defs || {}) }),
        },
      };
    }

    if (refSchema.type) {
      const mergedSchema: SchemaNode = {
        ...refSchema,
        title: fieldSchema.title || refSchema.title,
        description: fieldSchema.description || refSchema.description,
        $dynamic: fieldSchema.$dynamic,
        $required: fieldSchema.$required,
      };
      const tempProperties: Record<string, SchemaNode> = { [fieldKey]: mergedSchema };
      const tempValue: any = undefined;
      const tempOnUpdate = () => {};
      return renderFormField(tempProperties, fieldKey, isRequired, { ...defs, ...(refSchema.$defs || {}) }, tempValue, tempOnUpdate, '');
    }
  }

  return {
    type: 'Input',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
      placeholder: fieldSchema.description || `未解析的引用: ${fieldSchema.$ref}`,
    },
  };
}

const TYPE_RESOLVERS: Record<string, (
  fieldKey: string,
  fieldSchema: SchemaNode,
  isRequired: boolean,
  value: any,
  onUpdate: (val: any) => void,
  defs: Record<string, SchemaNode>,
  selectedNodeType: string
) => RenderedField> = {
  string: (fieldKey, fieldSchema, isRequired, value, onUpdate) => resolveStringField(fieldKey, fieldSchema, isRequired, value, onUpdate),
  number: (fieldKey, fieldSchema, isRequired, value, onUpdate) => resolveNumericField(fieldKey, fieldSchema, isRequired, value, onUpdate),
  integer: (fieldKey, fieldSchema, isRequired, value, onUpdate) => resolveNumericField(fieldKey, fieldSchema, isRequired, value, onUpdate),
  boolean: (fieldKey, fieldSchema, isRequired, value, onUpdate) => resolveBooleanField(fieldKey, fieldSchema, isRequired, value, onUpdate),
  array: resolveArrayField,
  object: (fieldKey, fieldSchema, isRequired, value, onUpdate) => resolveObjectField(fieldKey, fieldSchema, isRequired, value, onUpdate),
};

export function renderFormField(
  properties: Record<string, SchemaNode>,
  fieldKey: string,
  isRequired: boolean,
  defs: Record<string, SchemaNode> = {},
  value: any = undefined,
  onUpdate: (val: any) => void = () => {},
  selectedNodeType: string = ''
): RenderedField {
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

  if (fieldSchema.anyOf) {
    return resolveAnyOfField(fieldKey, fieldSchema, isRequired, value, onUpdate, defs);
  }

  if (fieldSchema.$ref) {
    return resolveRefField(fieldKey, fieldSchema, isRequired, value, onUpdate, defs);
  }

  if (fieldSchema.type) {
    const resolver = TYPE_RESOLVERS[fieldSchema.type];
    if (resolver) {
      return resolver(fieldKey, fieldSchema, isRequired, value, onUpdate, defs, selectedNodeType);
    }
  }

  return {
    type: 'Input',
    props: {
      ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
      placeholder: fieldSchema.description || '请输入',
    },
  };
}

export function extractSubFieldsForAnyOf(schema: SchemaNode, defs: Record<string, SchemaNode>): RenderedField[] {
  return extractSubFields(schema, defs);
}
