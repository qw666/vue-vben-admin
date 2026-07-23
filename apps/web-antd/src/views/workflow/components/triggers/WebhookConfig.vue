<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  InputNumber,
  Select,
  Switch,
  Tooltip,
} from 'ant-design-vue';

const props = defineProps<{
  trigger: any;
}>();

const emit = defineEmits<{
  (e: 'updateField', key: string, value: any): void;
}>();

const responseContentTypeOptions = [
  { value: 'application/json', label: 'application/json' },
  { value: 'text/plain', label: 'text/plain' },
];

const stopAfterOptions = [
  { value: 'CREATED', label: 'CREATED' },
  { value: 'SUBMITTED', label: 'SUBMITTED' },
  { value: 'RUNNING', label: 'RUNNING' },
  { value: 'PAUSED', label: 'PAUSED' },
  { value: 'RESTARTED', label: 'RESTARTED' },
  { value: 'KILLING', label: 'KILLING' },
  { value: 'SUCCESS', label: 'SUCCESS' },
  { value: 'WARNING', label: 'WARNING' },
  { value: 'FAILED', label: 'FAILED' },
  { value: 'KILLED', label: 'KILLED' },
  { value: 'CANCELLED', label: 'CANCELLED' },
  { value: 'QUEUED', label: 'QUEUED' },
  { value: 'RETRYING', label: 'RETRYING' },
  { value: 'RETRIED', label: 'RETRIED' },
  { value: 'SKIPPED', label: 'SKIPPED' },
  { value: 'BREAKPOINT', label: 'BREAKPOINT' },
  { value: 'RESUBMITTED', label: 'RESUBMITTED' },
];

const fieldLabels: Record<string, { label: string; tooltip: string }> = {
  key: {
    label: '密钥',
    tooltip: '唯一密钥，将作为 URL 的一部分。密钥用于生成 webhook URL，请确保密钥安全，它是保护您端点免受恶意攻击的唯一安全机制。',
  },
  allowConcurrent: {
    label: '允许并发',
    tooltip: '指定是否允许触发器在前一次运行仍在进行时启动新的执行，默认 false。',
  },
  wait: {
    label: '等待完成',
    tooltip: '等待流程执行完成。如果设置为 true，webhook 调用将等待流程完成并返回流程输出作为响应。如果设置为 false，webhook 调用将在执行创建后立即返回。',
  },
  returnOutputs: {
    label: '返回输出',
    tooltip: '将流程的输出作为 webhook 调用的响应返回。需要 wait 设置为 true，默认 false。',
  },
  responseCode: {
    label: '响应状态码',
    tooltip: '自定义响应状态码。如果设置，webhook 响应将使用此状态码而不是默认的 200。需要 wait 和 returnOutputs 都为 true。',
  },
  responseContentType: {
    label: '响应内容类型',
    tooltip: '自定义响应内容类型。如果设置，webhook 响应将使用此内容类型而不是默认的 application/json。需要 wait 和 returnOutputs 都为 true。',
  },
  stopAfter: {
    label: '停止状态',
    tooltip: '触发器应停止（禁用）的执行状态列表。',
  },
};

function generateRandomKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function updateField(key: string, value: any): void {
  emit('updateField', key, value);
}
</script>

<template>
  <div style="margin-top: 4px;">
    <div style="padding: 12px; background: #f9fafb; border-radius: 4px;">
      <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 12px;">
        Webhook 配置
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="display: flex; align-items: center; width: 80px;">
            <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.key.label }}</span>
            <span style="color: #ef4444; margin-left: 2px;">*</span>
            <Tooltip :title="fieldLabels.key.tooltip">
              <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
            </Tooltip>
          </div>
          <Input
            :value="props.trigger.key"
            @input="(e: any) => updateField('key', e.target.value)"
            placeholder="Webhook 密钥"
            style="flex: 1"
            size="small"
          />
          <Button
            type="text"
            size="small"
            @click="updateField('key', generateRandomKey())"
          >
            生成
          </Button>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="display: flex; align-items: center; width: 80px;">
            <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.allowConcurrent.label }}</span>
            <Tooltip :title="fieldLabels.allowConcurrent.tooltip">
              <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
            </Tooltip>
          </div>
          <Switch
            :checked="props.trigger.allowConcurrent"
            @change="(val: any) => updateField('allowConcurrent', val)"
            size="small"
          />
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="display: flex; align-items: center; width: 80px;">
            <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.wait.label }}</span>
            <Tooltip :title="fieldLabels.wait.tooltip">
              <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
            </Tooltip>
          </div>
          <Switch
            :checked="props.trigger.wait"
            @change="(val: any) => updateField('wait', val)"
            size="small"
          />
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="display: flex; align-items: center; width: 80px;">
            <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.returnOutputs.label }}</span>
            <Tooltip :title="fieldLabels.returnOutputs.tooltip">
              <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
            </Tooltip>
          </div>
          <Switch
            :checked="props.trigger.returnOutputs"
            @change="(val: any) => updateField('returnOutputs', val)"
            size="small"
          />
        </div>
        <div v-if="props.trigger.wait && props.trigger.returnOutputs" style="display: flex; gap: 8px; align-items: center;">
          <div style="display: flex; align-items: center; width: 80px;">
            <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.responseCode.label }}</span>
            <Tooltip :title="fieldLabels.responseCode.tooltip">
              <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
            </Tooltip>
          </div>
          <InputNumber
            :value="props.trigger.responseCode"
            @change="(val: any) => updateField('responseCode', val)"
            style="flex: 1"
            size="small"
          />
        </div>
        <div v-if="props.trigger.wait && props.trigger.returnOutputs" style="display: flex; gap: 8px; align-items: center;">
          <div style="display: flex; align-items: center; width: 80px;">
            <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.responseContentType.label }}</span>
            <Tooltip :title="fieldLabels.responseContentType.tooltip">
              <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
            </Tooltip>
          </div>
          <Select
            :value="props.trigger.responseContentType"
            @change="(val: SelectValue) => updateField('responseContentType', val)"
            style="flex: 1"
            size="small"
          >
            <Select.Option
              v-for="opt in responseContentTypeOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </Select.Option>
          </Select>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="display: flex; align-items: center; width: 80px;">
            <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.stopAfter.label }}</span>
            <Tooltip :title="fieldLabels.stopAfter.tooltip">
              <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
            </Tooltip>
          </div>
          <Select
            :value="props.trigger.stopAfter"
            @change="(val: any) => updateField('stopAfter', val)"
            mode="multiple"
            style="flex: 1"
            size="small"
          >
            <Select.Option
              v-for="opt in stopAfterOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </Select.Option>
          </Select>
        </div>
      </div>
    </div>
  </div>
</template>