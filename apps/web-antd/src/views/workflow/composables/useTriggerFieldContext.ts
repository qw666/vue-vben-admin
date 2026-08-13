import type { SchemaNode } from './useSchemaParser';

export interface TriggerFieldContext {
  defs: Record<string, SchemaNode>;
  getValue(path: string): any;
  setValue(path: string, value: any): void;
  getArrayLength(path: string): number;
  getArrayItem(path: string, index: number): any;
  addArrayItem(path: string, itemsSchema: SchemaNode): void;
  removeArrayItem(path: string, index: number): void;
  updateArrayItemValue(path: string, index: number, itemKey: string, value: any): void;
  getNestedObject(path: string): Record<string, any>;
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      current = current[Number(part)];
    } else {
      current = current[part];
    }
  }
  return current;
}

function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const parts = path.split('.');
  let current: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const nextPart = parts[i + 1]!;
    if (current == null) return;
    if (Array.isArray(current)) {
      const idx = Number(part);
      if (current[idx] == null) {
        current[idx] = isNaN(Number(nextPart)) ? {} : [];
      }
      current = current[idx];
    } else {
      if (current[part] == null) {
        current[part] = isNaN(Number(nextPart)) ? {} : [];
      }
      current = current[part];
    }
  }
  const lastPart = parts[parts.length - 1]!;
  if (Array.isArray(current)) {
    current[Number(lastPart)] = value;
  } else {
    current[lastPart] = value;
  }
}

function ensureArray(obj: Record<string, any>, path: string): any[] {
  let current: any = obj;
  const parts = path.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const nextPart = parts[i + 1]!;
    if (current == null) return [];
    if (Array.isArray(current)) {
      const idx = Number(part);
      if (current[idx] == null) {
        current[idx] = isNaN(Number(nextPart)) ? {} : [];
      }
      current = current[idx];
    } else {
      if (current[part] == null) {
        current[part] = isNaN(Number(nextPart)) ? {} : [];
      }
      current = current[part];
    }
  }
  const lastPart = parts[parts.length - 1]!;
  if (current[lastPart] == null) {
    current[lastPart] = [];
  }
  return current[lastPart];
}

function getTopKey(path: string): string {
  return path.split('.')[0]!;
}

export function createTriggerFieldContext(
  getTrigger: () => Record<string, any>,
  emit: (key: string, value: any) => void,
  getDefs: () => Record<string, SchemaNode>,
): TriggerFieldContext {
  function emitValue(path: string, _nestedValue: any): void {
    const trigger = getTrigger();
    const topKey = getTopKey(path);
    const topValue = getNestedValue(trigger, topKey);
    emit(topKey, topValue);
  }

  return {
    get defs() {
      return getDefs();
    },
    getValue(path: string): any {
      return getNestedValue(getTrigger(), path);
    },
    setValue(path: string, value: any): void {
      const trigger = getTrigger();
      setNestedValue(trigger, path, value);
      emitValue(path, value);
    },
    getArrayLength(path: string): number {
      const arr = getNestedValue(getTrigger(), path);
      return Array.isArray(arr) ? arr.length : 0;
    },
    getArrayItem(path: string, index: number): any {
      const arr = getNestedValue(getTrigger(), path);
      return Array.isArray(arr) ? arr[index] : undefined;
    },
    addArrayItem(path: string, itemsSchema: SchemaNode): void {
      const trigger = getTrigger();
      const arr = ensureArray(trigger, path);
      const newItem: Record<string, any> = {};

      if (itemsSchema.anyOf) {
        const firstOption = itemsSchema.anyOf[0];
        if (firstOption?.properties) {
          const typeField = 'type';
          const typeProp = firstOption.properties[typeField];
          if (typeProp?.enum && typeProp.enum.length > 0) {
            newItem[typeField] = typeProp.enum[0];
          }
          for (const [key, schema] of Object.entries(firstOption.properties)) {
            if (key !== typeField) {
              if (schema.type === 'array') continue;
              newItem[key] = initDefaultValue(schema);
            }
          }
        }
      } else if (itemsSchema.properties) {
        for (const [key, schema] of Object.entries(itemsSchema.properties)) {
          newItem[key] = initDefaultValue(schema);
        }
      }

      arr.push(newItem);
      emitValue(path, arr);
    },
    removeArrayItem(path: string, index: number): void {
      const trigger = getTrigger();
      const arr = getNestedValue(trigger, path);
      if (Array.isArray(arr)) {
        arr.splice(index, 1);
        emitValue(path, arr);
      }
    },
    updateArrayItemValue(path: string, index: number, itemKey: string, value: any): void {
      const trigger = getTrigger();
      const itemPath = `${path}.${index}.${itemKey}`;
      setNestedValue(trigger, itemPath, value);
      emitValue(path, getNestedValue(trigger, path));
    },
    getNestedObject(path: string): Record<string, any> {
      const trigger = getTrigger();
      const existing = getNestedValue(trigger, path);
      if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        return existing;
      }
      const newObj = {};
      setNestedValue(trigger, path, newObj);
      emitValue(path, newObj);
      return newObj;
    },
  };
}

function initDefaultValue(schema: SchemaNode): any {
  if (schema.default !== undefined) return schema.default;
  if (schema.type) {
    switch (schema.type) {
      case 'boolean': return false;
      case 'object': return {};
      case 'array': return [];
      case 'string': return '';
      case 'number':
      case 'integer': return undefined;
    }
  }
  if (schema.anyOf) return null;
  return undefined;
}
