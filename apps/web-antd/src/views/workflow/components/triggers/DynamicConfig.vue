<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Input,
  InputNumber,
  Select,
  Switch,
  Tooltip,
} from 'ant-design-vue';

const props = defineProps<{
  trigger: any;
  schema?: any;
}>();

const emit = defineEmits<{
  (e: 'updateField', key: string, value: any): void;
}>();

const fieldLabels: Record<string, { label: string; tooltip: string }> = {
  key: {
    label: '密钥',
    tooltip: '唯一密钥，将作为 URL 的一部分。',
  },
  allowConcurrent: {
    label: '允许并发',
    tooltip: '指定是否允许触发器在前一次运行仍在进行时启动新的执行。',
  },
  wait: {
    label: '等待完成',
    tooltip: '等待流程执行完成。',
  },
  returnOutputs: {
    label: '返回输出',
    tooltip: '将流程的输出作为 webhook 调用的响应返回。',
  },
  responseCode: {
    label: '响应状态码',
    tooltip: '自定义响应状态码。',
  },
  responseContentType: {
    label: '响应内容类型',
    tooltip: '自定义响应内容类型。',
  },
  stopAfter: {
    label: '停止状态',
    tooltip: '触发器应停止（禁用）的执行状态列表。',
  },
};

function getFieldLabel(key: string): string {
  return fieldLabels[key]?.label || key;
}

function getFieldTooltip(key: string): string {
  return fieldLabels[key]?.tooltip || '';
}

function renderField(key: string, prop: any) {
  const value = props.trigger[key];
  const label = getFieldLabel(key);
  const tooltip = getFieldTooltip(key);

  if (prop.type === 'boolean') {
    return {
      type: 'switch',
      value,
      label,
      tooltip,
    };
  }

  if (prop.type === 'integer') {
    return {
      type: 'number',
      value,
      label,
      tooltip,
    };
  }

  if (prop.enum) {
    return {
      type: 'select',
      value,
      label,
      tooltip,
      options: prop.enum.map((e: any) => ({ value: e, label: e })),
      multiple: prop.type === 'array',
    };
  }

  if (prop.type === 'array') {
    return {
      type: 'select',
      value,
      label,
      tooltip,
      options: [],
      multiple: true,
    };
  }

  return {
    type: 'input',
    value,
    label,
    tooltip,
    placeholder: prop.description || '',
  };
}

const visibleFields = computed(() => {
  if (!props.schema) return [];
  return Object.entries(props.schema)
    .filter(([key]) => !['conditions', 'inputs', 'pluginDefaultsRef'].includes(key))
    .map(([key, prop]) => ({
      key,
      prop,
      ...renderField(key, prop),
    }));
});

function updateField(key: string, value: any): void {
  emit('updateField', key, value);
}
</script>

<template>
  <div style="margin-top: 4px;">
    <div v-if="visibleFields.length > 0" style="padding: 12px; background: #f9fafb; border-radius: 4px;">
      <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 12px;">
        触发器配置
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div
          v-for="field in visibleFields"
          :key="field.key"
          style="display: flex; gap: 8px; align-items: center;"
        >
          <div style="display: flex; align-items: center; width: 80px;">
            <span style="font-size: 12px; color: #6b7280;">{{ field.label }}</span>
            <span v-if="field.prop.$required || field.prop.required" style="color: #ef4444; margin-left: 2px;">*</span>
            <Tooltip v-if="field.tooltip" :title="field.tooltip">
              <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
            </Tooltip>
          </div>
          <Switch
            v-if="field.type === 'switch'"
            :checked="field.value"
            @change="(val: any) => updateField(field.key, val)"
            size="small"
          />
          <InputNumber
            v-else-if="field.type === 'number'"
            :value="field.value"
            @change="(val: any) => updateField(field.key, val)"
            style="flex: 1"
            size="small"
          />
          <Select
            v-else-if="field.type === 'select'"
            :value="field.value"
            @change="(val: SelectValue) => updateField(field.key, val)"
            :mode="field.multiple ? 'multiple' : undefined"
            style="flex: 1"
            size="small"
          >
            <Select.Option
              v-for="opt in field.options"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </Select.Option>
          </Select>
          <Input
            v-else
            :value="field.value"
            @input="(e: any) => updateField(field.key, e.target.value)"
            :placeholder="field.placeholder"
            style="flex: 1"
            size="small"
          />
        </div>
      </div>
    </div>
    <div v-else style="padding: 16px 0; font-size: 12px; color: #9ca3af; text-align: center;">
      暂无配置项
    </div>
  </div>
</template>