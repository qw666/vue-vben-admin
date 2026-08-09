<script lang="ts" setup>
import { computed } from 'vue';
import { Button, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import VarPicker from './VarPicker.vue';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const arrayValue = computed<any[]>(() => {
  const val = props.nodeConfigForm[fieldKey.value];
  return Array.isArray(val) ? val : [];
});

const arrayLength = computed(() => arrayValue.value.length);

const emit = defineEmits<{
  (e: 'addStringArrayItem', fieldKey: string): void;
  (e: 'removeArrayItem', fieldKey: string, index: number): void;
  (e: 'updateArrayItemValue', fieldKey: string, index: number, itemKey: string, value: any): void;
}>();
</script>

<template>
  <div class="field-renderer">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
      <label style="font-size: 14px; font-weight: 500; color: #374151;">
        {{ field.props.label }}
        <span v-if="field.props.required" style="color: #ef4444; margin-left: 4px;">*</span>
      </label>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span v-if="field.props.fieldType" style="font-size: 12px; padding: 2px 8px; background: #f3f4f6; color: #4b5563; border-radius: 4px;">{{ field.props.fieldType }}</span>
        <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
          <span class="help-icon-wrapper">
            <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; pointer-events: none;" />
          </span>
        </Tooltip>
      </div>
    </div>
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 12px; color: #6b7280;">{{ field.props.label }} ({{ arrayLength }})</span>
        <Button type="text" size="small" @click="emit('addStringArrayItem', fieldKey)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div v-for="(item, index) in arrayValue" :key="`${fieldKey}-item-${index}`" style="display: flex; align-items: center; gap: 8px;">
          <VarPicker
            :key="`${fieldKey}-${index}-${item}`"
            :value="item"
            @update:value="(val: string) => emit('updateArrayItemValue', fieldKey, index as number, '', val)"
            :placeholder="'输入 / 选择变量'"
            style="flex: 1;"
            size="small"
          />
          <Button type="text" size="small" @click="emit('removeArrayItem', fieldKey, index as number)" danger>
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
      </div>
    </div>
    <div
      v-if="field.props.description"
      style="margin-top: 4px; font-size: 12px; color: #9ca3af;"
    >
      {{ field.props.description }}
    </div>
  </div>
</template>

<style scoped>
.help-icon-wrapper {
  display: inline-flex;
  align-items: center;
}
</style>
