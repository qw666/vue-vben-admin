<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Switch,
  Textarea,
  TimePicker,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'addOnResumeItem', fieldKey: string): void;
  (
    e: 'updateOnResumeField',
    fieldKey: string,
    index: number,
    key: string,
    value: any,
  ): void;
  (e: 'removeOnResumeItem', fieldKey: string, index: number): void;
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const inputTypes = [
  { value: 'STRING', label: 'STRING', defaultControl: 'input' },
  { value: 'INT', label: 'INT', defaultControl: 'number' },
  { value: 'LONG', label: 'LONG', defaultControl: 'number' },
  { value: 'FLOAT', label: 'FLOAT', defaultControl: 'number' },
  { value: 'DOUBLE', label: 'DOUBLE', defaultControl: 'number' },
  { value: 'BOOL', label: 'BOOL', defaultControl: 'switch' },
  { value: 'DATE', label: 'DATE', defaultControl: 'date' },
  { value: 'TIME', label: 'TIME', defaultControl: 'time' },
  { value: 'DATETIME', label: 'DATETIME', defaultControl: 'datetime' },
  { value: 'DURATION', label: 'DURATION', defaultControl: 'duration' },
  { value: 'ARRAY', label: 'ARRAY', defaultControl: 'input' },
  { value: 'JSON', label: 'JSON', defaultControl: 'json' },
  { value: 'URI', label: 'URI', defaultControl: 'input' },
];

const arrayPlaceholder = '["item1", "item2"]';

function addOnResumeItem() {
  emit('addOnResumeItem', fieldKey.value);
}

function updateField(index: number, key: string, value: any) {
  emit('updateOnResumeField', fieldKey.value, index, key, value);
}

function removeField(index: number) {
  emit('removeOnResumeItem', fieldKey.value, index);
}

function getControlType(type: string): string {
  const typeConfig = inputTypes.find((t) => t.value === type);
  return typeConfig?.defaultControl || 'input';
}

function formatDefaultValue(item: any): any {
  const controlType = getControlType(item.type);
  const value = item.defaults;

  if (!value && value !== 0 && value !== false) {
    if (controlType === 'switch') return false;
    return value;
  }

  switch (controlType) {
    case 'array': {
      return Array.isArray(value) ? value : [];
    }
    case 'date': {
      return dayjs(value);
    }
    case 'datetime': {
      return dayjs(value);
    }
    case 'duration': {
      return parseDuration(value);
    }
    case 'number': {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    case 'switch': {
      return !!value;
    }
    case 'time': {
      return dayjs(value, 'HH:mm:ss');
    }
    default: {
      return value;
    }
  }
}

function parseDuration(iso: string): null | { unit: string; value: number; } {
  if (!iso) return null;
  const regex = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
  const match = iso.match(regex);
  if (!match) return null;

  const days = match[1] ? Number.parseInt(match[1], 10) : 0;
  const hours = match[2] ? Number.parseInt(match[2], 10) : 0;
  const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
  const seconds = match[4] ? Number.parseInt(match[4], 10) : 0;

  if (days > 0) return { value: days, unit: 'days' };
  if (hours > 0) return { value: hours, unit: 'hours' };
  if (minutes > 0) return { value: minutes, unit: 'minutes' };
  if (seconds > 0) return { value: seconds, unit: 'seconds' };
  return null;
}

function formatDuration(displayValue: number, displayUnit: string): string {
  if (!displayValue || displayValue <= 0) return '';
  const unitMap: Record<string, { char: string; prefix: string }> = {
    seconds: { char: 'S', prefix: 'T' },
    minutes: { char: 'M', prefix: 'T' },
    hours: { char: 'H', prefix: 'T' },
    days: { char: 'D', prefix: '' },
  };
  const unit = unitMap[displayUnit];
  if (!unit) return '';
  if (unit.prefix) {
    return `PT${displayValue}${unit.char}`;
  }
  return `P${displayValue}${unit.char}`;
}

function handleDurationChange(index: number, value: number, unit: string) {
  const duration = formatDuration(value, unit);
  emit('updateOnResumeField', fieldKey.value, index, 'defaults', duration);
}
</script>

<template>
  <div class="field-renderer">
    <div
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      "
    >
      <label style="font-size: 14px; font-weight: 500; color: #374151">
        {{ field.props.label }}
        <span
          v-if="field.props.required"
          style=" margin-left: 4px;color: #ef4444"
          >*</span>
      </label>
      <div style="display: flex; gap: 8px; align-items: center">
        <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
          <IconifyIcon
            icon="mdi:help-circle"
            :size="14"
            style="color: #9ca3af"
          />
        </Tooltip>
      </div>
    </div>
    <div style=" padding: 12px;background: #f9fafb; border-radius: 8px">
      <div
        style="
          display: flex;
          align-items: center;
          justify-content: flex-end;
          margin-bottom: 8px;
        "
      >
        <Button type="text" size="small" @click="addOnResumeItem">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加输入字段
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px">
        <div
          v-for="(item, index) in nodeConfigForm[fieldKey] || []"
          :key="`${fieldKey }-onresume-${ index}`"
          style="
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 8px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
          "
        >
          <div style="display: flex; gap: 8px; align-items: center">
            <span style="font-size: 12px; font-weight: 500; color: #6b7280">字段 {{ (index as number) + 1 }}</span>
            <Switch
              v-model:checked="item.required"
              @change="
                (val: any) => updateField(index as number, 'required', val)
              "
              checked-children="必填"
              un-checked-children="选填"
              size="small"
            />
            <Button
              type="text"
              size="small"
              @click="removeField(index as number)"
              danger
            >
              <IconifyIcon icon="mdi:close" :size="12" />
            </Button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px">
            <div style="display: flex; gap: 6px; align-items: center">
              <span style=" width: 40px;font-size: 11px; color: #9ca3af">id</span>
              <Input
                :value="item.id"
                @input="
                  (e: any) => updateField(index as number, 'id', e.target.value)
                "
                placeholder="字段标识"
                style="flex: 1"
                size="small"
              />
            </div>
            <div style="display: flex; gap: 6px; align-items: center">
              <span style=" width: 40px;font-size: 11px; color: #9ca3af">显示名</span>
              <Input
                :value="item.displayName"
                @input="
                  (e: any) =>
                    updateField(index as number, 'displayName', e.target.value)
                "
                placeholder="显示名称"
                style="flex: 1"
                size="small"
              />
            </div>
            <div style="display: flex; gap: 6px; align-items: center">
              <span style=" width: 40px;font-size: 11px; color: #9ca3af">类型</span>
              <Select
                :value="item.type"
                @change="
                  (val: SelectValue) =>
                    updateField(index as number, 'type', val)
                "
                style="flex: 1"
                size="small"
              >
                <Select.Option
                  v-for="t in inputTypes"
                  :key="t.value"
                  :value="t.value"
                  >
{{ t.label }}
</Select.Option>
              </Select>
            </div>
            <div style="display: flex; gap: 6px; align-items: center">
              <span style=" width: 40px;font-size: 11px; color: #9ca3af">值</span>
              <template v-if="getControlType(item.type) === 'switch'">
                <Switch
                  :checked="formatDefaultValue(item)"
                  @change="
                    (val: any) => updateField(index as number, 'defaults', val)
                  "
                  checked-children="是"
                  un-checked-children="否"
                  size="small"
                />
              </template>
              <template v-else-if="getControlType(item.type) === 'number'">
                <InputNumber
                  :value="formatDefaultValue(item)"
                  @change="
                    (val: any) => updateField(index as number, 'defaults', val)
                  "
                  placeholder="请输入数值"
                  style="flex: 1"
                  size="small"
                  :step="
                    item.type === 'FLOAT' || item.type === 'DOUBLE' ? 0.1 : 1
                  "
                />
              </template>
              <template v-else-if="getControlType(item.type) === 'date'">
                <DatePicker
                  :value="formatDefaultValue(item)"
                  @change="
                    (val: any) =>
                      updateField(
                        index as number,
                        'defaults',
                        val?.format('YYYY-MM-DD'),
                      )
                  "
                  style="flex: 1"
                  size="small"
                />
              </template>
              <template v-else-if="getControlType(item.type) === 'time'">
                <TimePicker
                  :value="formatDefaultValue(item)"
                  @change="
                    (val: any) =>
                      updateField(
                        index as number,
                        'defaults',
                        val?.format('HH:mm:ss'),
                      )
                  "
                  style="flex: 1"
                  size="small"
                  format="HH:mm:ss"
                />
              </template>
              <template v-else-if="getControlType(item.type) === 'datetime'">
                <DatePicker
                  :value="formatDefaultValue(item)"
                  @change="
                    (val: any) =>
                      updateField(
                        index as number,
                        'defaults',
                        val?.toISOString(),
                      )
                  "
                  style="flex: 1"
                  size="small"
                  show-time
                />
              </template>
              <template v-else-if="getControlType(item.type) === 'duration'">
                <div
                  style="display: flex; flex: 1; gap: 4px; align-items: center"
                >
                  <InputNumber
                    :value="parseDuration(item.defaults)?.value || undefined"
                    @change="
                      (val: any) =>
                        handleDurationChange(
                          index as number,
                          val,
                          parseDuration(item.defaults)?.unit || 'minutes',
                        )
                    "
                    :min="0"
                    placeholder="数值"
                    style="flex: 1"
                    size="small"
                  />
                  <Select
                    :value="parseDuration(item.defaults)?.unit || 'minutes'"
                    @change="
                      (val: SelectValue) =>
                        handleDurationChange(
                          index as number,
                          parseDuration(item.defaults)?.value || 0,
                          val as string,
                        )
                    "
                    style="width: 70px"
                    size="small"
                  >
                    <Select.Option value="seconds">秒</Select.Option>
                    <Select.Option value="minutes">分钟</Select.Option>
                    <Select.Option value="hours">小时</Select.Option>
                    <Select.Option value="days">天</Select.Option>
                  </Select>
                </div>
              </template>
              <template v-else-if="getControlType(item.type) === 'json'">
                <Textarea
                  :value="item.defaults"
                  @input="
                    (e: any) =>
                      updateField(index as number, 'defaults', e.target.value)
                  "
                  placeholder="输入 JSON"
                  style="flex: 1; min-height: 80px"
                  size="small"
                />
              </template>
              <template v-else>
                <Input
                  :value="item.defaults"
                  @input="
                    (e: any) =>
                      updateField(index as number, 'defaults', e.target.value)
                  "
                  :placeholder="
                    item.type === 'ARRAY' ? arrayPlaceholder : '默认值'
                  "
                  style="flex: 1"
                  size="small"
                />
              </template>
            </div>
          </div>
        </div>
        <div
          v-if="(nodeConfigForm[fieldKey] || []).length === 0"
          style="
            padding: 16px 0;
            font-size: 12px;
            color: #9ca3af;
            text-align: center;
          "
        >
          点击上方按钮添加恢复时需要填写的输入字段
        </div>
      </div>
    </div>
  </div>
</template>
