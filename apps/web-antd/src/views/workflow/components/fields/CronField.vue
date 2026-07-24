<script lang="ts" setup>
import { computed, ref, watch, onMounted } from 'vue';

import { Select } from 'ant-design-vue';

const props = defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

type ScheduleType = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'custom';

const scheduleType = ref<string>('day');
const hour = ref('0');
const minute = ref('0');
const dayOfMonth = ref('1');
const dayOfWeek = ref('1');
const isInternalUpdate = ref(false);

function parseCronExpression(expr: string) {
  const parts = expr.split(' ');
  
  if (parts.length === 6) {
    const [sec, min, hr, day, month, week] = parts;
    parseFiveParts([min, hr, day, month, week]);
  } else if (parts.length === 5) {
    parseFiveParts(parts);
  } else {
    scheduleType.value = 'custom';
  }
}

function parseFiveParts(parts: string[]) {
  const [min, hr, day, month, week] = parts;

  if (min === '*' && hr === '*' && day === '*' && month === '*' && (week === '*' || week === '?')) {
    scheduleType.value = 'minute';
  } else if (min === '0' && hr === '*' && day === '*' && month === '*' && (week === '*' || week === '?')) {
    scheduleType.value = 'hour';
  } else if (day === '*' && month === '*' && (week === '*' || week === '?')) {
    scheduleType.value = 'day';
    hour.value = String(hr || '0');
    minute.value = String(min || '0');
  } else if (day === '*' && (week !== '*' && week !== '?')) {
    scheduleType.value = 'week';
    hour.value = String(hr || '0');
    minute.value = String(min || '0');
    dayOfWeek.value = String(week || '1');
  } else if (week === '*' || week === '?') {
    scheduleType.value = 'month';
    hour.value = String(hr || '0');
    minute.value = String(min || '0');
    dayOfMonth.value = String(day || '1');
  } else {
    scheduleType.value = 'custom';
  }
}

onMounted(() => {
  if (props.modelValue) {
    parseCronExpression(props.modelValue);
  } else {
    emit('update:modelValue', '0 0 * * *');
  }
});

watch(
  () => props.modelValue,
  (val) => {
    if (val && !isInternalUpdate.value) {
      parseCronExpression(val);
    }
  },
);

function updateCronExpression() {
  isInternalUpdate.value = true;
  const newExpression = cronExpression.value;
  emit('update:modelValue', newExpression);
  setTimeout(() => {
    isInternalUpdate.value = false;
  }, 0);
}

const cronExpression = computed(() => {
  const h = parseInt(hour.value) || 0;
  const m = parseInt(minute.value) || 0;
  const dom = parseInt(dayOfMonth.value) || 1;
  const dow = parseInt(dayOfWeek.value) || 1;
  
  switch (scheduleType.value) {
    case 'minute':
      return '* * * * *';
    case 'hour':
      return '0 * * * *';
    case 'day':
      return `${m} ${h} * * *`;
    case 'week':
      return `${m} ${h} * * ${dow}`;
    case 'month':
      return `${m} ${h} ${dom} * *`;
    case 'custom':
      return props.modelValue || '* * * * *';
    default:
      return '* * * * *';
  }
});

watch(scheduleType, () => {
  if (scheduleType.value !== 'custom') {
    updateCronExpression();
  }
});

watch([hour, minute], () => {
  if (scheduleType.value !== 'custom') {
    updateCronExpression();
  }
});

watch(dayOfWeek, () => {
  if (scheduleType.value === 'week') {
    updateCronExpression();
  }
});

watch(dayOfMonth, () => {
  if (scheduleType.value === 'month') {
    updateCronExpression();
  }
});

const scheduleTypeOptions = [
  { value: 'minute', label: '每分钟执行' },
  { value: 'hour', label: '每小时执行' },
  { value: 'day', label: '每天执行' },
  { value: 'week', label: '每周执行' },
  { value: 'month', label: '每月执行' },
  { value: 'custom', label: '自定义表达式' },
];

const weekOptions = [
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
  { value: '7', label: '周日' },
];

function updateCustomValue(val: string) {
  emit('update:modelValue', val);
}

function clampHour(val: string) {
  const num = parseInt(val) || 0;
  hour.value = Math.max(0, Math.min(23, num)).toString();
}

function clampMinute(val: string) {
  const num = parseInt(val) || 0;
  minute.value = Math.max(0, Math.min(59, num)).toString();
}

function clampDayOfMonth(val: string) {
  const num = parseInt(val) || 1;
  dayOfMonth.value = Math.max(1, Math.min(31, num)).toString();
}

function handleScheduleTypeChange(val: string) {
  scheduleType.value = val;
  updateCronExpression();
}

function handleDayOfWeekChange(val: string) {
  dayOfWeek.value = val;
  updateCronExpression();
}
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; gap: 8px; align-items: center;">
      <span style="font-size: 12px; color: #6b7280; width: 80px;">执行周期</span>
      <Select
        :value="scheduleType"
        @change="handleScheduleTypeChange"
        style="flex: 1"
        size="small"
      >
        <Select.Option v-for="opt in scheduleTypeOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </Select.Option>
      </Select>
    </div>

    <div v-if="scheduleType === 'day' || scheduleType === 'week' || scheduleType === 'month'" style="display: flex; gap: 8px; align-items: center;">
      <span style="font-size: 12px; color: #6b7280; width: 80px;">执行时间</span>
      <input
        v-model="hour"
        @blur="clampHour(hour)"
        type="number"
        min="0"
        max="23"
        style="width: 80px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; text-align: center;"
      />
      <span style="font-size: 12px;">:</span>
      <input
        v-model="minute"
        @blur="clampMinute(minute)"
        type="number"
        min="0"
        max="59"
        style="width: 80px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; text-align: center;"
      />
    </div>

    <div v-if="scheduleType === 'week'" style="display: flex; gap: 8px; align-items: center;">
      <span style="font-size: 12px; color: #6b7280; width: 80px;">星期</span>
      <Select
        :value="dayOfWeek"
        @change="handleDayOfWeekChange"
        style="flex: 1"
        size="small"
      >
        <Select.Option v-for="opt in weekOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </Select.Option>
      </Select>
    </div>

    <div v-if="scheduleType === 'month'" style="display: flex; gap: 8px; align-items: center;">
      <span style="font-size: 12px; color: #6b7280; width: 80px;">日期</span>
      <input
        v-model="dayOfMonth"
        @blur="clampDayOfMonth(dayOfMonth)"
        type="number"
        min="1"
        max="31"
        style="width: 100px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; text-align: center;"
      />
      <span style="font-size: 12px; color: #9ca3af;">日</span>
    </div>

    <div v-if="scheduleType === 'custom'" style="display: flex; gap: 8px; align-items: center;">
      <span style="font-size: 12px; color: #6b7280; width: 80px;">表达式</span>
      <input
        :value="props.modelValue"
        @input="updateCustomValue(($event.target as HTMLInputElement).value)"
        style="flex: 1; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px;"
        placeholder="输入 5 位 Cron 表达式"
      />
    </div>

    <div style="display: flex; gap: 8px; align-items: center; padding-top: 8px; border-top: 1px dashed #e5e7eb;">
      <span style="font-size: 12px; color: #6b7280; width: 80px;">Cron 表达式</span>
      <code style="flex: 1; padding: 4px 8px; background: #f3f4f6; border-radius: 4px; font-size: 12px; font-family: monospace;">{{ cronExpression }}</code>
    </div>
  </div>
</template>
