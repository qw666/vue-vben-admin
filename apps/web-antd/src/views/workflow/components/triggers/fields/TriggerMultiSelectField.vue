<script lang="ts" setup>
import { computed, inject } from 'vue';

import { Select, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import type { TriggerFieldContext } from '../../../composables/useTriggerFieldContext';

const props = defineProps<{
  field: any;
}>();

const context = inject<TriggerFieldContext>('triggerFieldContext')!;

const fieldKey = computed(() => props.field.props?.key || props.field.key);
const value = computed({
  get: () => context.getValue(fieldKey.value) || [],
  set: (val: any) => context.setValue(fieldKey.value, val),
});

const options = computed(() => props.field.props?.options || []);
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
    <Select
      :value="value"
      mode="multiple"
      :placeholder="field.props.placeholder || '请选择'"
      style="width: 100%;"
      @update:value="(val: any) => value = val"
    >
      <Select.Option
        v-for="opt in options"
        :key="opt"
        :value="opt"
      >
        {{ opt }}
      </Select.Option>
    </Select>
    <div v-if="field.props?.description" style="margin-top: 4px; font-size: 12px; color: #9ca3af;">
      {{ field.props.description }}
    </div>
  </div>
</template>