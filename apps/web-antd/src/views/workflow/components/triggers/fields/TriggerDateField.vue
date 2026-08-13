<script lang="ts" setup>
import { computed, inject } from 'vue';

import { DatePicker, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import dayjs from 'dayjs';

import type { TriggerFieldContext } from '../../../composables/useTriggerFieldContext';

const props = defineProps<{
  field: any;
}>();

const context = inject<TriggerFieldContext>('triggerFieldContext')!;

const fieldKey = computed(() => props.field.props?.key || props.field.key);
const rawValue = computed(() => context.getValue(fieldKey.value));

const displayValue = computed(() => {
  const v = rawValue.value;
  if (!v) return null;
  const parsed = dayjs(v);
  return parsed.isValid() ? parsed : null;
});

function onDateChange(dates: any): void {
  if (dates) {
    context.setValue(fieldKey.value, dates.format('YYYY-MM-DD'));
  } else {
    context.setValue(fieldKey.value, '');
  }
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
    <DatePicker
      :value="displayValue"
      format="YYYY-MM-DD"
      :placeholder="field.props.placeholder || '选择日期'"
      style="width: 100%;"
      @change="onDateChange"
    />
    <div v-if="field.props?.description" style="margin-top: 4px; font-size: 12px; color: #9ca3af;">
      {{ field.props.description }}
    </div>
  </div>
</template>
