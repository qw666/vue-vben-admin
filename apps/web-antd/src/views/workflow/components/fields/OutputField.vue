<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  Select,
  Tooltip,
} from 'ant-design-vue';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'addArrayItem', fieldKey: string, itemsSchema: any): void;
  (e: 'removeArrayItem', fieldKey: string, index: number): void;
  (e: 'updateArrayItemValue', fieldKey: string, index: number, itemKey: string, value: any): void;
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const outputTypes = [
  { value: 'ARRAY', label: 'ARRAY' },
  { value: 'BOOLEAN', label: 'BOOLEAN' },
  { value: 'FLOAT', label: 'FLOAT' },
  { value: 'INT', label: 'INT' },
  { value: 'STRING', label: 'STRING' },
  { value: 'JSON', label: 'JSON' },
];

const fieldLabels: Record<string, { label: string; tooltip: string }> = {
  id: {
    label: '标识',
    tooltip: '输出属性的名称，必须在流程中唯一。',
  },
  type: {
    label: '类型',
    tooltip: '输出值的数据类型，决定了值的格式和验证规则。',
  },
  value: {
    label: '值',
    tooltip: '输出值，可以使用表达式如 "{{ outputs.mytask.value }}" 引用其他节点的输出。',
  },
};

function addOutputItem() {
  const itemsSchema = {
    type: 'object',
    properties: {
      id: { type: 'string', title: '输出ID', description: '输出属性的名称', $required: true },
      type: { type: 'string', title: '输出类型', description: '输出值的类型', enum: ['ARRAY', 'BOOLEAN', 'FLOAT', 'INT', 'STRING', 'JSON'], default: 'STRING', $required: true },
      value: { type: 'string', title: '输出值', description: '输出值', $required: true },
    },
  };
  emit('addArrayItem', fieldKey.value, itemsSchema);
}

function updateField(index: number, key: string, value: any) {
  emit('updateArrayItemValue', fieldKey.value, index, key, value);
}

function removeField(index: number) {
  emit('removeArrayItem', fieldKey.value, index);
}
</script>

<template>
  <div class="field-renderer">
    <div
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
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
          <span class="help-icon-wrapper">
            <IconifyIcon
              icon="mdi:help-circle"
              :size="14"
              style="color: #6b7280; pointer-events: none"
            />
          </span>
        </Tooltip>
      </div>
    </div>
    <div style="padding: 12px; background: #f9fafb; border-radius: 8px;">
      <div
        style="
          display: flex;
          align-items: center;
          justify-content: flex-end;
          margin-bottom: 10px;
        "
      >
        <Button type="text" size="small" @click="addOutputItem">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加输出字段
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div
          v-for="(item, index) in nodeConfigForm[fieldKey] || []"
          :key="`${fieldKey }-output-${ index}`"
          style="
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 12px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
          "
        >
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-size: 12px; font-weight: 500; color: #6b7280;">字段 {{ (index as number) + 1 }}</span>
            <Button
              type="text"
              size="small"
              @click="removeField(index as number)"
              danger
            >
              <IconifyIcon icon="mdi:close" :size="12" />
            </Button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="display: flex; align-items: center; width: 80px;">
                <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.id.label }}</span>
                <Tooltip :title="fieldLabels.id.tooltip">
                  <span class="help-icon-wrapper">
                    <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; cursor: pointer; margin-left: 4px; pointer-events: none;" />
                  </span>
                </Tooltip>
              </div>
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
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="display: flex; align-items: center; width: 80px;">
                <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.type.label }}</span>
                <Tooltip :title="fieldLabels.type.tooltip">
                  <span class="help-icon-wrapper">
                    <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; cursor: pointer; margin-left: 4px; pointer-events: none;" />
                  </span>
                </Tooltip>
              </div>
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
                  v-for="t in outputTypes"
                  :key="t.value"
                  :value="t.value"
                  >
{{ t.label }}
</Select.Option>
              </Select>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="display: flex; align-items: center; width: 80px;">
                <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.value.label }}</span>
                <Tooltip :title="fieldLabels.value.tooltip">
                  <span class="help-icon-wrapper">
                    <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; cursor: pointer; margin-left: 4px; pointer-events: none;" />
                  </span>
                </Tooltip>
              </div>
              <Input
                :value="item.value"
                @input="
                  (e: any) =>
                    updateField(index as number, 'value', e.target.value)
                "
                placeholder="例如: {{ outputs.mytask.value }}"
                style="flex: 1"
                size="small"
              />
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
          点击上方按钮添加流程输出字段
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help-icon-wrapper {
  display: inline-flex;
  align-items: center;
}
</style>
