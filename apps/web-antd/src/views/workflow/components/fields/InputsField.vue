<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  InputNumber,
  Select,
  Switch,
  Textarea,
  Tooltip,
} from 'ant-design-vue';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'addInputsItem', fieldKey: string): void;
  (
    e: 'updateInputsField',
    fieldKey: string,
    index: number,
    key: string,
    value: any,
  ): void;
  (e: 'removeInputsItem', fieldKey: string, index: number): void;
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const inputTypes = [
  { value: 'STRING', label: 'STRING' },
  { value: 'INT', label: 'INT' },
  { value: 'FLOAT', label: 'FLOAT' },
  { value: 'BOOLEAN', label: 'BOOLEAN' },
  { value: 'ARRAY', label: 'ARRAY' },
  { value: 'JSON', label: 'JSON' },
];

const fieldLabels: Record<string, { label: string; tooltip: string }> = {
  id: {
    label: '标识',
    tooltip: '字段唯一标识，用于在流程中引用该输入参数。',
  },
  displayName: {
    label: '显示名',
    tooltip: '字段显示名称，用于在用户界面中展示。',
  },
  type: {
    label: '类型',
    tooltip: '字段数据类型，决定了输入值的格式和验证规则。',
  },
  required: {
    label: '必填',
    tooltip: '是否必填字段，必填字段必须提供值才能启动流程。',
  },
  defaults: {
    label: '默认值',
    tooltip: '字段默认值，仅在必填字段时可用。',
  },
};

function addInputsItem() {
  emit('addInputsItem', fieldKey.value);
}

function updateField(index: number, key: string, value: any) {
  emit('updateInputsField', fieldKey.value, index, key, value);
}

function removeField(index: number) {
  emit('removeInputsItem', fieldKey.value, index);
}

function getControlType(type: string): string {
  if (['INT', 'FLOAT'].includes(type)) return 'number';
  if (type === 'BOOLEAN') return 'switch';
  if (type === 'JSON') return 'json';
  return 'input';
}

function formatDefaultValue(item: any): any {
  const controlType = getControlType(item.type);
  const value = item.defaults;

  if (!value && value !== 0 && value !== false) {
    if (controlType === 'switch') return false;
    return value;
  }

  switch (controlType) {
    case 'number': {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    case 'switch': {
      return !!value;
    }
    default: {
      return value;
    }
  }
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
          <IconifyIcon
            icon="mdi:help-circle"
            :size="14"
            style="color: #9ca3af"
          />
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
        <Button type="text" size="small" @click="addInputsItem">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加输入字段
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div
          v-for="(item, index) in nodeConfigForm[fieldKey] || []"
          :key="`${fieldKey }-inputs-${ index}`"
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
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="display: flex; align-items: center; width: 80px;">
                <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.id.label }}</span>
                <Tooltip :title="fieldLabels.id.tooltip">
                  <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
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
                <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.displayName.label }}</span>
                <Tooltip :title="fieldLabels.displayName.tooltip">
                  <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                </Tooltip>
              </div>
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
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="display: flex; align-items: center; width: 80px;">
                <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.type.label }}</span>
                <Tooltip :title="fieldLabels.type.tooltip">
                  <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
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
                  v-for="t in inputTypes"
                  :key="t.value"
                  :value="t.value"
                  >
{{ t.label }}
</Select.Option>
              </Select>
            </div>
            <div v-if="item.required" style="display: flex; gap: 8px; align-items: center;">
              <div style="display: flex; align-items: center; width: 80px;">
                <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.defaults.label }}</span>
                <Tooltip :title="fieldLabels.defaults.tooltip">
                  <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                </Tooltip>
              </div>
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
                  :step="item.type === 'FLOAT' ? 0.1 : 1"
                />
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
                  :placeholder="item.type === 'ARRAY' ? '[item1, item2]' : '默认值'"
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
          点击上方按钮添加输入字段
        </div>
      </div>
    </div>
  </div>
</template>
