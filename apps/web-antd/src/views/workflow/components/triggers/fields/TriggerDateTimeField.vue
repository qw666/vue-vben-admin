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

const fieldKey = computed(() => {
  const key = props.field.props?.key || props.field.key;
  return key;
});
const rawValue = computed(() => context.getValue(fieldKey.value));

// 解析 ISO 8601 格式的日期时间字符串
function parseDateTimeValue(value: string): dayjs.Dayjs | null {
  if (!value || value === '') return null;
  
  // 尝试直接解析 dayjs 应该能处理 ISO 8601
  const parsed = dayjs(value);
  if (parsed.isValid()) return parsed;
  
  // 如果直接解析失败，尝试处理 "YYYY-MM-DDTHH:mm:ss.SSSZ" 格式
  // 例如: "2026-08-12T07:57:06.000Z" 或 "2026-08-12T07:57:06+08:00"
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/);
  if (isoMatch) {
    const [, datetime, , tz] = isoMatch;
    const tzOffset = tz === 'Z' ? '+00:00' : tz;
    return dayjs(`${datetime}${tzOffset}`, 'YYYY-MM-DDTHH:mm:ssZ');
  }
  
  return null;
}

const displayValue = computed(() => {
  const v = rawValue.value;
  if (!v) return null;
  return parseDateTimeValue(v);
});

function onDateChange(dates: any): void {
  if (dates) {
    context.setValue(fieldKey.value, dates.toISOString());
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
      show-time
      show-time:format="HH:mm:ss"
      format="YYYY-MM-DD HH:mm:ss"
      :placeholder="field.props.placeholder || '选择日期时间'"
      style="width: 100%;"
      @change="onDateChange"
    />
    <div v-if="field.props?.description" style="margin-top: 4px; font-size: 12px; color: #9ca3af;">
      {{ field.props.description }}
    </div>
  </div>
</template>
