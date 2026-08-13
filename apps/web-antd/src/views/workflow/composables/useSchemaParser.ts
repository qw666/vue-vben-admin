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
  $secret?: boolean;
  $group?: string;
  format?: string;
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
      return {};
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

/**
 * 触发器专用的表单字段值初始化函数
 * 与 initFormFieldValue 的区别：
 * - type 检查优先于 anyOf 检查
 * - 这是因为触发器的 anyOf 通常用于数组字段的子项类型选择
 *   （如 Or 条件的 conditions 字段: { type: 'array', items: { anyOf: [...] } }）
 *   此时应该根据 type 返回空数组，而不是根据 anyOf 返回 null
 */
export function initTriggerFieldValue(schema: SchemaNode, defs: Record<string, SchemaNode> = {}): any {
  if (schema.$ref) {
    const refSchema = internalResolveRef(schema.$ref, defs);
    if (refSchema) {
      return initTriggerFieldValue(refSchema, { ...defs, ...(refSchema.$defs || {}) });
    }
    return {};
  }

  // 触发器专用：type 检查优先于 anyOf 检查
  if (schema.type) {
    // 如果有 default 值，优先使用 default
    if (schema.default !== undefined) {
      return schema.default;
    }
    switch (schema.type) {
      case 'boolean':
        return false;
      case 'object':
        return {};
      case 'array':
        return [];
      case 'string':
        return '';
      case 'number':
      case 'integer':
        return undefined;
    }
  }

  // 只有当 schema 没有明确类型时，才检查 anyOf
  if (schema.anyOf) {
    return null;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  return undefined;
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
