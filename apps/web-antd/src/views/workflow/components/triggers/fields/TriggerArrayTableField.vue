<script lang="ts" setup>
import { computed, inject } from 'vue';

import { Button, InputNumber, Select, Switch, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import VarPicker from '../../fields/VarPicker.vue';
import type { TriggerFieldContext } from '../../../composables/useTriggerFieldContext';

const props = defineProps<{
  field: any;
}>();

const context = inject<TriggerFieldContext>('triggerFieldContext')!;

const fieldKey = computed(() => props.field.props?.key || props.field.key);
const itemsSchema = computed(() => props.field.props?.itemsSchema);
const minItems = computed(() => props.field.props?.minItems);

const items = computed(() => {
  return context.getValue(fieldKey.value) || [];
});

function addItem(): void {
  if (itemsSchema.value) {
    context.addArrayItem(fieldKey.value, itemsSchema.value);
  }
}

function removeItem(index: number): void {
  context.removeArrayItem(fieldKey.value, index);
}

function updateItemValue(index: number, propKey: string, value: any): void {
  context.updateArrayItemValue(fieldKey.value, index, propKey, value);
}
</script>

<template>
  <div class="trigger-field">
    <div v-if="field.props?.label" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
      <label style="font-size: 13px; font-weight: 500; color: #374151;">
        {{ field.props.label }}
        <span v-if="field.props.required" style="color: #ef4444; margin-left: 4px;">*</span>
      </label>
      <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; pointer-events: none;" />
      </Tooltip>
    </div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
      <span style="font-size: 12px; color: #6b7280;">{{ field.props.label }} ({{ items?.length || 0 }})</span>
      <Button type="text" size="small" @click="addItem">
        <IconifyIcon icon="mdi:plus" :size="14" /> 添加
      </Button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <div v-for="(_, index) in (items || [])" :key="fieldKey + '-array-' + index" style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 12px; font-weight: 500; color: #4b5563;">第 {{ index + 1 }} 项</span>
          <Button type="text" size="small" @click="removeItem(index)" danger>
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div v-for="(prop, propKey) in (itemsSchema?.properties || {})" :key="propKey">
            <label style="font-size: 12px; color: #6b7280;">
              {{ prop.title || propKey }}
              <span v-if="prop.$required" style="color: #ef4444; margin-left: 4px;">*</span>
            </label>
            <VarPicker
              v-if="prop.type === 'string'"
              :value="context.getValue(fieldKey + '.' + index + '.' + propKey)"
              @update:value="(val: string) => updateItemValue(index, propKey as string, val)"
              :placeholder="prop.description || '输入 / 选择变量'"
              style="width: 100%;"
            />
            <InputNumber
              v-else-if="prop.type === 'number' || prop.type === 'integer'"
              :value="context.getValue(fieldKey + '.' + index + '.' + propKey)"
              @update:value="(val: any) => updateItemValue(index, propKey as string, val)"
              :min="prop.minimum"
              :max="prop.maximum"
              style="width: 100%;"
            />
            <Select
              v-else-if="prop.enum"
              :value="context.getValue(fieldKey + '.' + index + '.' + propKey)"
              @update:value="(val: any) => updateItemValue(index, propKey as string, val)"
              style="width: 100%;"
            >
              <Select.Option
                v-for="opt in prop.enum"
                :key="opt"
                :value="opt"
              >
                {{ opt }}
              </Select.Option>
            </Select>
            <Switch
              v-else-if="prop.type === 'boolean'"
              :checked="context.getValue(fieldKey + '.' + index + '.' + propKey)"
              @update:checked="(val: any) => updateItemValue(index, propKey as string, val)"
            />
          </div>
        </div>
      </div>
    </div>
    <div v-if="field.props?.description" style="margin-top: 4px; font-size: 12px; color: #9ca3af;">
      {{ field.props.description }}
    </div>
  </div>
</template>
