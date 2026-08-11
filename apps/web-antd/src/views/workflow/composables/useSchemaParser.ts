export interface SchemaNode {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  enum?: string[];
  anyOf?: SchemaNode[];
  $ref?: string;
  $defs?: Record<string, SchemaNode>;
  items?: SchemaNode;
  minItems?: number;
  minimum?: number;
  maximum?: number;
  step?: number;
  $dynamic?: boolean;
  $required?: boolean;
  const?: any;
  default?: any;
  additionalProperties?: SchemaNode;
}

export interface FormMeta {
  parsedSchema?: SchemaNode;
  formProperties: Record<string, SchemaNode>;
  formRequired: string[];
  formDefs: Record<string, SchemaNode>;
}

export function internalResolveRef(refPath: string, defs: Record<string, SchemaNode>): SchemaNode | undefined {
  const parts = refPath.split('/');
  const key = parts[parts.length - 1];
  return key ? defs[key] : undefined;
}

export function internalIsTaskRef(schema: SchemaNode): boolean {
  return schema.$ref?.endsWith('idp_core_models_tasks_Task') === true;
}

export function initFormFieldValue(schema: SchemaNode, defs: Record<string, SchemaNode> = {}): any {
  if (schema.$ref) {
    const refSchema = internalResolveRef(schema.$ref, defs);
    if (refSchema) {
      return initFormFieldValue(refSchema, { ...defs, ...(refSchema.$defs || {}) });
    }
    return {};
  }

  if (schema.anyOf) {
    return null;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  switch (schema.type) {
    case 'boolean':
      return false;
    case 'object':
      return [];
    case 'array':
      return [];
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return undefined;
    default:
      return undefined;
  }
}

export function serializeFieldValue(schema: SchemaNode, value: any, defs: Record<string, SchemaNode> = {}): any {
  if (schema.$ref) {
    const refSchema = internalResolveRef(schema.$ref, defs);
    if (refSchema) {
      return serializeFieldValue(refSchema, value, { ...defs, ...(refSchema.$defs || {}) });
    }
    return value;
  }

  if (schema.anyOf) {
    return value;
  }

  if (schema.type === 'object') {
    if (Array.isArray(value)) {
      const obj: Record<string, any> = {};
      value.forEach((item: any) => {
        if (item.key) {
          obj[item.key] = item.value;
        }
      });
      return obj;
    }
    if (typeof value === 'object' && value !== null) {
      const result: Record<string, any> = {};
      Object.keys(value).forEach(key => {
        if (schema.properties && schema.properties[key]) {
          result[key] = serializeFieldValue(schema.properties[key], value[key], defs);
        } else {
          result[key] = value[key];
        }
      });
      return result;
    }
  }

  if (schema.type === 'array' && value && Array.isArray(value)) {
    return value.map((item: any) => {
      if (schema.items) {
        return serializeFieldValue(schema.items, item, defs);
      }
      return item;
    });
  }

  return value;
}

/**
 * 根据值推断 anyOf 选项索引
 * @param options anyOf 选项数组
 * @param value 当前值
 * @returns 选项索引，未匹配返回 -1
 */
export function inferAnyOfOption(options: any[], value: any): number {
  if (value === undefined || value === null || value === '') return -1;

  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    if (!option || !option.schema) continue;

    const schema = option.schema;
    // 数组类型匹配
    if (schema.type === 'array' && Array.isArray(value)) {
      return i;
    }
    // 字符串类型匹配
    if (schema.type === 'string' && typeof value === 'string') {
      return i;
    }
    // 数字类型匹配
    if ((schema.type === 'number' || schema.type === 'integer') && typeof value === 'number') {
      return i;
    }
    // 布尔类型匹配
    if (schema.type === 'boolean' && typeof value === 'boolean') {
      return i;
    }
    // 对象类型匹配
    if (schema.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
      return i;
    }
  }

  return -1;
}