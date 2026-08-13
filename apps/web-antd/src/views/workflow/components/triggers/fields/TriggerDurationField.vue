<script lang="ts" setup>
import { computed, inject, ref, watch } from 'vue';

import { Button, InputNumber, Select, Tooltip } from 'ant-design-vue';
import type { SelectValue } from 'ant-design-vue/es/select';
import { IconifyIcon } from '@vben/icons';

import type { TriggerFieldContext } from '../../../composables/useTriggerFieldContext';

const props = defineProps<{
  field: any;
}>();

const context = inject<TriggerFieldContext>('triggerFieldContext')!;

const fieldKey = computed(() => props.field.props?.key || props.field.key);

const unitOptions = [
  { value: 'seconds', label: '秒', isoChar: 'S', isoType: 'T' },
  { value: 'minutes', label: '分钟', isoChar: 'M', isoType: 'T' },
  { value: 'hours', label: '小时', isoChar: 'H', isoType: 'T' },
  { value: 'days', label: '天', isoChar: 'D', isoType: '' },
];

function parseIsoDuration(iso: string): { unit: string; value: number | null } {
  if (!iso) return { value: null, unit: 'minutes' };
  const regex = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
  const match = iso.match(regex);
  if (!match) return { value: null, unit: 'minutes' };

  const days = match[1] ? Number.parseInt(match[1], 10) : 0;
  const hours = match[2] ? Number.parseInt(match[2], 10) : 0;
  const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
  const seconds = match[4] ? Number.parseInt(match[4], 10) : 0;

  if (days > 0) return { value: days, unit: 'days' };
  if (hours > 0) return { value: hours, unit: 'hours' };
  if (minutes > 0) return { value: minutes, unit: 'minutes' };
  if (seconds > 0) return { value: seconds, unit: 'seconds' };
  return { value: null, unit: 'minutes' };
}

function toIsoDuration(value: number, unit: string): string {
  if (!value || value <= 0) return '';
  const unitOpt = unitOptions.find((u) => u.value === unit);
  if (!unitOpt) return '';
  if (unitOpt.isoType) {
    return `PT${value}${unitOpt.isoChar}`;
  }
  return `P${value}${unitOpt.isoChar}`;
}

const rawValue = computed(() => context.getValue(fieldKey.value));

const parsed = computed(() => parseIsoDuration(rawValue.value || ''));

const displayValue = ref<number | undefined>(parsed.value.value ?? undefined);
const displayUnit = ref<string>(parsed.value.unit);

watch(
  () => rawValue.value,
  (newVal) => {
    const p = parseIsoDuration(newVal || '');
    displayValue.value = p.value ?? undefined;
    displayUnit.value = p.unit;
  },
  { immediate: true },
);

function onValueChange(val: number | null) {
  displayValue.value = val ?? undefined;
  context.setValue(fieldKey.value, toIsoDuration(val || 0, displayUnit.value));
}

function onUnitChange(unit: SelectValue) {
  displayUnit.value = unit as string;
  context.setValue(fieldKey.value, toIsoDuration(displayValue.value || 0, unit as string));
}

</script>

<template>
  <div class="trigger-field">
    <div
      v-if="field.props?.label"
      style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;"
    >
      <label style="font-size: 13px; font-weight: 500; color: #374151;">
        {{ field.props.label }}
        <span v-if="field.props.required" style="color: #ef4444; margin-left: 4px;">*</span>
      </label>
      <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; pointer-events: none;" />
      </Tooltip>
    </div>
    <div style="display: flex; gap: 8px; align-items: center">
      <InputNumber
        :value="displayValue"
        @change="onValueChange"
        :min="0"
        :placeholder="field.props.placeholder || '输入数值'"
        style="flex: 1"
      />
      <Select
        :value="displayUnit"
        @change="onUnitChange"
        style="width: 90px"
      >
        <Select.Option
          v-for="u in unitOptions"
          :key="u.value"
          :value="u.value"
        >
          {{ u.label }}
        </Select.Option>
      </Select>
    </div>
    <div v-if="field.props?.description" style="margin-top: 4px; font-size: 12px; color: #9ca3af;">
      {{ field.props.description }}
    </div>
    <div
      v-if="rawValue"
      style="margin-top: 2px; font-family: monospace; font-size: 11px; color: #6b7280;"
    >
      ISO 8601: {{ rawValue }}
    </div>
  </div>
</template>
