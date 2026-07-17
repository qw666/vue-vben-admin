<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { InputNumber, Select, Tooltip, Button } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const unitOptions = [
  { value: 'seconds', label: '秒', isoChar: 'S', isoType: 'T' },
  { value: 'minutes', label: '分钟', isoChar: 'M', isoType: 'T' },
  { value: 'hours', label: '小时', isoChar: 'H', isoType: 'T' },
  { value: 'days', label: '天', isoChar: 'D', isoType: '' },
];

function parseIsoDuration(iso: string): { value: number; unit: string } {
  if (!iso) return { value: null as any, unit: 'minutes' };
  const regex = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
  const match = iso.match(regex);
  if (!match) return { value: null as any, unit: 'minutes' };

  const days = match[1] ? parseInt(match[1], 10) : 0;
  const hours = match[2] ? parseInt(match[2], 10) : 0;
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  const seconds = match[4] ? parseInt(match[4], 10) : 0;

  if (days > 0) return { value: days, unit: 'days' };
  if (hours > 0) return { value: hours, unit: 'hours' };
  if (minutes > 0) return { value: minutes, unit: 'minutes' };
  if (seconds > 0) return { value: seconds, unit: 'seconds' };
  return { value: null as any, unit: 'minutes' };
}

function toIsoDuration(value: number, unit: string): string {
  if (!value || value <= 0) return '';
  const unitOpt = unitOptions.find(u => u.value === unit);
  if (!unitOpt) return '';
  if (unitOpt.isoType) {
    return `PT${value}${unitOpt.isoChar}`;
  }
  return `P${value}${unitOpt.isoChar}`;
}

const parsed = computed(() => parseIsoDuration(props.nodeConfigForm[fieldKey.value] || ''));

const displayValue = ref<number | null>(parsed.value.value);
const displayUnit = ref<string>(parsed.value.unit);

watch(() => props.nodeConfigForm[fieldKey.value], (newVal) => {
  const p = parseIsoDuration(newVal || '');
  displayValue.value = p.value;
  displayUnit.value = p.unit;
}, { immediate: true });

function onValueChange(val: any) {
  displayValue.value = val;
  props.nodeConfigForm[fieldKey.value] = toIsoDuration(val || 0, displayUnit.value);
}

function onUnitChange(unit: string) {
  displayUnit.value = unit;
  props.nodeConfigForm[fieldKey.value] = toIsoDuration(displayValue.value || 0, unit);
}

function clearDuration() {
  displayValue.value = null;
  props.nodeConfigForm[fieldKey.value] = '';
}
</script>

<template>
  <div class="field-renderer">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
      <label style="font-size: 14px; font-weight: 500; color: #374151;">
        {{ field.props.label }}
        <span v-if="field.props.required" style="color: #ef4444; margin-left: 4px;">*</span>
      </label>
      <div style="display: flex; align-items: center; gap: 8px;">
        <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
          <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af;" />
        </Tooltip>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <InputNumber
        :value="displayValue"
        @change="onValueChange"
        :min="0"
        :placeholder="'输入数值'"
        style="flex: 1;"
        size="small"
      />
      <Select
        :value="displayUnit"
        @change="onUnitChange"
        style="width: 90px;"
        size="small"
      >
        <Select.Option v-for="u in unitOptions" :key="u.value" :value="u.value">{{ u.label }}</Select.Option>
      </Select>
      <Button
        v-if="displayValue"
        type="text"
        size="small"
        @click="clearDuration"
        style="flex-shrink: 0;"
      >
        <IconifyIcon icon="mdi:close" :size="14" />
      </Button>
    </div>
    <div v-if="field.props.description" style="font-size: 12px; color: #9ca3af; margin-top: 4px;">
      {{ field.props.description }}
    </div>
    <div v-if="nodeConfigForm[fieldKey]" style="font-size: 11px; color: #6b7280; margin-top: 2px; font-family: monospace;">
      ISO 8601: {{ nodeConfigForm[fieldKey] }}
    </div>
  </div>
</template>
