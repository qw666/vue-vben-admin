<script lang="ts" setup>
import { computed, inject } from 'vue';

import { TimePicker, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import dayjs from 'dayjs';

import type { TriggerFieldContext } from '../../../composables/useTriggerFieldContext';

const props = defineProps<{
  field: any;
}>();

const context = inject<TriggerFieldContext>('triggerFieldContext')!;

const fieldKey = computed(() => props.field.props?.key || props.field.key);
const rawValue = computed(() => context.getValue(fieldKey.value));

// 解析 "HH:mm:ss+08:00" 或 "HH:mm:ssZ" 格式的时间字符串
function parseTimeValue(value: string): dayjs.Dayjs | null {
  if (!value || value === '') return null;
  
  // 尝试直接解析
  const parsed = dayjs(value);
  if (parsed.isValid()) return parsed;
  
  // 如果直接解析失败，尝试用自定义格式解析 "HH:mm:ssZ" 或 "HH:mm:ss+HH:mm"
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$/);
  if (match) {
    const [, h, m, s, tz] = match;
    const tzOffset = tz === 'Z' ? '+00:00' : tz;
    return dayjs(`${h}:${m}:${s}${tzOffset}`, 'HH:mm:ssZ');
  }
  
  return null;
}

const displayValue = computed(() => {
  const v = rawValue.value;
  if (!v) return null;
  return parseTimeValue(v);
});

function onTimeChange(time: any): void {
  if (time) {
    context.setValue(fieldKey.value, time.format('HH:mm:ssZ'));
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
    <TimePicker
      :value="displayValue"
      format="HH:mm:ss"
      :placeholder="field.props.placeholder || '选择时间'"
      style="width: 100%;"
      @change="onTimeChange"
    />
    <div v-if="field.props?.description" style="margin-top: 4px; font-size: 12px; color: #9ca3af;">
      {{ field.props.description }}
    </div>
  </div>
</template>
