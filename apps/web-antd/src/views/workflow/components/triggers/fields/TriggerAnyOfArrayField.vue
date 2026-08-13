<script lang="ts" setup>
import { computed, inject, ref, watch } from 'vue';

import { Button, Select, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import { renderTriggerField } from '../../../composables/useTriggerFieldResolver';
import { initTriggerFieldValue, internalResolveRef } from '../../../composables/useSchemaParser';
import type { TriggerFieldContext } from '../../../composables/useTriggerFieldContext';
import type { SchemaNode } from '../../../composables/useSchemaParser';

import TriggerFieldRenderer from './TriggerFieldRenderer.vue';

const props = defineProps<{
  field: any;
  pathPrefix?: string;
}>();

const context = inject<TriggerFieldContext>('triggerFieldContext')!;

const basePath = computed(() => props.pathPrefix || '');
const fieldKey = computed(() => {
  const key = props.field.props?.key || props.field.key;
  // 如果 key 已经包含路径分隔符，说明已经是完整路径，直接使用
  if (key.includes('.')) {
    return key;
  }
  // 否则拼接 basePath
  return basePath.value ? `${basePath.value}.${key}` : key;
});
const itemsSchema = computed<SchemaNode | null>(() => props.field.props?.itemsSchema || null);
const defs = computed(() => context.defs || {});

const items = computed(() => context.getValue(fieldKey.value) || []);

interface AnyOfOption {
  value: string;
  label: string;
  schema: SchemaNode;
  typeField: string;
}

function extractTypeValue(schema: SchemaNode): { typeField: string; typeValue: string } | null {
  if (!schema.properties) return null;
  const typeProp = schema.properties['type'];
  if (!typeProp) return null;
  if (typeProp.enum && typeProp.enum.length > 0) {
    return { typeField: 'type', typeValue: typeProp.enum[0] };
  }
  return { typeField: 'type', typeValue: 'type' };
}

// 嵌套场景下禁止 Or 嵌套 Or：过滤掉 Or 类型的选项
const anyOfOptions = computed<AnyOfOption[]>(() => {
  if (!itemsSchema.value?.anyOf) return [];
  
  const isNested = !!props.pathPrefix;
  
  return itemsSchema.value.anyOf
    .map((opt: SchemaNode, idx: number) => {
      // 解析 $ref 获取完整 schema
      const resolvedSchema = opt.$ref 
        ? internalResolveRef(opt.$ref, defs.value) || opt 
        : opt;
      
      const typeInfo = extractTypeValue(resolvedSchema);
      const typeField = typeInfo?.typeField || 'type';
      const typeValue = typeInfo?.typeValue || `option_${idx}`;
      return {
        value: typeValue,
        label: resolvedSchema.title || opt.title || `选项 ${idx + 1}`,
        schema: resolvedSchema,
        typeField,
      };
    })
    .filter((opt: AnyOfOption) => {
      if (isNested && opt.schema?.properties) {
        const hasConditionsArray = Object.entries(opt.schema.properties).some(
          ([key, schema]) => key === 'conditions' && schema.type === 'array'
        );
        if (hasConditionsArray) return false;
      }
      return true;
    });
});

const expandedItems = ref<Set<number>>(new Set());

function getCurrentType(index: number): string {
  const item = items.value[index];
  if (!item) return '';
  return item.type || '';
}

function getCurrentOption(index: number): AnyOfOption | null {
  const type = getCurrentType(index);
  return anyOfOptions.value.find((o) => o.value === type) || null;
}

function getSubFieldsForItem(index: number): any[] {
  const option = getCurrentOption(index);
  if (!option?.schema?.properties) return [];
  const subFields: any[] = [];
  const typeField = option.typeField;

  for (const [key, schema] of Object.entries(option.schema.properties)) {
    if (key === typeField) continue;
    const fullPath = `${fieldKey.value}.${index}.${key}`;
    const rendered = renderTriggerField(
      option.schema.properties,
      key,
      !!schema.$required,
      defs.value,
      context.getValue(fullPath),
      (val: any) => {
        context.setValue(fullPath, val);
      },
    );
    // 存储完整路径，供字段组件使用
    rendered.props.key = fullPath;
    rendered.props.label = schema.title || key;
    subFields.push(rendered);
  }
  return subFields;
}

function addItem(): void {
  if (!itemsSchema.value) return;
  
  const firstOption = anyOfOptions.value[0];
  if (!firstOption) return;

  const newItem: Record<string, any> = {};
  newItem[firstOption.typeField] = firstOption.value;
  if (firstOption.schema.properties) {
    for (const [key, schema] of Object.entries(firstOption.schema.properties)) {
      if (key !== firstOption.typeField) {
        if (schema.type === 'array') continue;
        newItem[key] = initTriggerFieldValue(schema);
      }
    }
  }

  const arr = context.getValue(fieldKey.value) || [];
  arr.push(newItem);
  context.setValue(fieldKey.value, arr);
  
  expandedItems.value.add(arr.length - 1);
}

function removeItem(index: number): void {
  context.removeArrayItem(fieldKey.value, index);
  const newSet = new Set<number>();
  expandedItems.value.forEach(i => {
    if (i < index) newSet.add(i);
    else if (i > index) newSet.add(i - 1);
  });
  expandedItems.value = newSet;
}

function switchType(index: number, newType: string): void {
  const option = anyOfOptions.value.find((o) => o.value === newType);
  if (!option) return;

  const newItem: Record<string, any> = {};
  newItem[option.typeField] = option.value;
  if (option.schema.properties) {
    for (const [key, schema] of Object.entries(option.schema.properties)) {
      if (key !== option.typeField) {
        if (schema.type === 'array') continue;
        newItem[key] = initTriggerFieldValue(schema);
      }
    }
  }

  const arr = [...items.value];
  arr[index] = newItem;
  context.setValue(fieldKey.value, arr);
}

function toggleExpand(index: number): void {
  const newSet = new Set(expandedItems.value);
  if (newSet.has(index)) newSet.delete(index);
  else newSet.add(index);
  expandedItems.value = newSet;
}

watch(items, () => {}, { deep: true });
</script>

<template>
  <div class="trigger-field">
    <div v-if="field.props?.label && !pathPrefix" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
      <label style="font-size: 13px; font-weight: 500; color: #374151;">
        {{ field.props.label }}
        <span v-if="field.props.required" style="color: #ef4444; margin-left: 4px;">*</span>
      </label>
      <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; pointer-events: none;" />
      </Tooltip>
    </div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
      <span v-if="!pathPrefix" style="font-size: 12px; color: #6b7280;">{{ field.props.label }} ({{ items?.length || 0 }})</span>
      <span v-else style="font-size: 12px; color: #6b7280;">子条件 ({{ items?.length || 0 }})</span>
      <Button type="text" size="small" @click="addItem">
        <IconifyIcon icon="mdi:plus" :size="14" /> 添加条件
      </Button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <div
        v-for="(_, index) in (items || [])"
        :key="fieldKey + '-anyof-' + index"
        style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px;"
      >
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <IconifyIcon
              :icon="expandedItems.has(index) ? 'mdi:chevron-down' : 'mdi:chevron-right'"
              :size="14"
              style="color: #9ca3af; cursor: pointer;"
              @click="toggleExpand(index)"
            />
            <span style="font-size: 12px; font-weight: 500; color: #4b5563;">条件 {{ index + 1 }}</span>
            <Select
              :value="getCurrentType(index)"
              @update:value="(val: string) => switchType(index, val)"
              style="max-width: 200px;"
              size="small"
            >
              <Select.Option
                v-for="opt in anyOfOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </Select.Option>
            </Select>
          </div>
          <Button type="text" size="small" @click="removeItem(index)" danger>
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
        <div v-if="expandedItems.has(index)" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f3f4f6;">
          <div v-if="getCurrentOption(index)?.schema?.properties" style="display: flex; flex-direction: column; gap: 8px;">
            <template v-for="subField in getSubFieldsForItem(index)" :key="subField.props.key">
              <TriggerAnyOfArrayField
                v-if="subField.type === 'AnyOfArray'"
                :field="subField"
                :path-prefix="`${fieldKey}.${index}`"
              />
              <TriggerFieldRenderer v-else :field="subField" />
            </template>
          </div>
        </div>
      </div>
      <div v-if="!items?.length" style="padding: 8px 0; text-align: center; color: #9ca3af; font-size: 12px;">
        暂无条件，点击上方按钮添加
      </div>
    </div>
    <div v-if="field.props?.description && !pathPrefix" style="margin-top: 4px; font-size: 12px; color: #9ca3af;">
      {{ field.props.description }}
    </div>
  </div>
</template>
