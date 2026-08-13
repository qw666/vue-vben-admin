<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select';

import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  InputNumber,
  Select,
  Switch,
  Tag,
  Tooltip,
  message,
} from 'ant-design-vue';

import VarPicker from './VarPicker.vue';

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

const itemTypeOptions = [
  { value: 'STRING', label: 'STRING' },
  { value: 'INT', label: 'INT' },
  { value: 'FLOAT', label: 'FLOAT' },
  { value: 'BOOLEAN', label: 'BOOLEAN' },
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
  itemType: {
    label: '元素类型',
    tooltip: '数组元素的数据类型，ARRAY 类型必填。',
  },
  required: {
    label: '必填',
    tooltip: '是否必填字段，必填字段必须提供值才能启动流程。',
  },
  defaults: {
    label: '默认值',
    tooltip: '字段默认值，当运行时未提供值时使用。',
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
  if (type === 'ARRAY') return 'array';
  return 'input';
}

function formatDefaultValue(item: any): any {
  const controlType = getControlType(item.type);
  const value = item.defaults;

  if (value === undefined || value === null || value === '') {
    if (controlType === 'switch') return false;
    if (controlType === 'number') return undefined;
    if (controlType === 'array') return [];
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
    case 'array': {
      if (Array.isArray(value)) return value;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    default: {
      return value;
    }
  }
}

// ARRAY 相关辅助函数
function addArrayItemValue(index: number) {
  const item = props.nodeConfigForm[fieldKey.value]?.[index];
  if (!item) return;
  const currentDefaults = item.defaults;
  let arr: any[] = [];
  if (Array.isArray(currentDefaults)) {
    arr = [...currentDefaults];
  } else if (typeof currentDefaults === 'string' && currentDefaults.trim()) {
    try {
      const parsed = JSON.parse(currentDefaults);
      arr = Array.isArray(parsed) ? [...parsed] : [currentDefaults];
    } catch {
      arr = [currentDefaults];
    }
  }
  arr.push('');
  updateField(index, 'defaults', arr);
}

function updateArrayItemValue(index: number, itemIndex: number, value: any) {
  const item = props.nodeConfigForm[fieldKey.value]?.[index];
  if (!item) return;
  let arr: any[] = [];
  if (Array.isArray(item.defaults)) {
    arr = [...item.defaults];
  } else if (typeof item.defaults === 'string' && item.defaults.trim()) {
    try {
      const parsed = JSON.parse(item.defaults);
      arr = Array.isArray(parsed) ? [...parsed] : [item.defaults];
    } catch {
      arr = [item.defaults];
    }
  }
  arr[itemIndex] = value;
  updateField(index, 'defaults', arr);
}

function removeArrayItemValue(index: number, itemIndex: number) {
  const item = props.nodeConfigForm[fieldKey.value]?.[index];
  if (!item) return;
  let arr: any[] = [];
  if (Array.isArray(item.defaults)) {
    arr = [...item.defaults];
  } else if (typeof item.defaults === 'string' && item.defaults.trim()) {
    try {
      const parsed = JSON.parse(item.defaults);
      arr = Array.isArray(parsed) ? [...parsed] : [item.defaults];
    } catch {
      arr = [item.defaults];
    }
  }
  arr.splice(itemIndex, 1);
  updateField(index, 'defaults', arr);
}

function getArrayItems(item: any): any[] {
  if (Array.isArray(item.defaults)) return item.defaults;
  if (typeof item.defaults === 'string' && item.defaults.trim()) {
    try {
      const parsed = JSON.parse(item.defaults);
      return Array.isArray(parsed) ? parsed : [item.defaults];
    } catch {
      return [item.defaults];
    }
  }
  return [];
}

function getArrayItemInputType(item: any): string {
  return item.itemType || 'STRING';
}

// JSON 校验
function validateJson(value: string): boolean {
  if (!value || !value.trim()) return true;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function getJsonValidationStatus(value: string): '' | 'error' | 'success' {
  if (!value || !value.trim()) return '';
  return validateJson(value) ? 'success' : 'error';
}

function getJsonValidationTip(value: string): string {
  if (!value || !value.trim()) return '';
  return validateJson(value) ? 'JSON 格式正确' : 'JSON 格式不正确';
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
        <Button type="text" size="small" @click="addInputsItem">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加输入字段
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div
          v-for="(item, index) in nodeConfigForm[fieldKey] || []"
          :key="`${fieldKey}-inputs-${index}`"
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
            <Tag v-if="item.type" :color="item.type === 'ARRAY' ? 'purple' : item.type === 'JSON' ? 'cyan' : item.type === 'BOOLEAN' ? 'green' : item.type === 'INT' || item.type === 'FLOAT' ? 'blue' : 'default'" style="margin: 0;">
              {{ item.type }}
            </Tag>
            <div style="flex: 1"></div>
            <Switch
              v-model:checked="item.required"
              @change="
                (val: any) => updateField(index as number, 'required', val)
              "
              checked-children="必填"
              un-checked-children="选填"
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
            <!-- ID -->
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
              />
            </div>

            <!-- Display Name -->
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="display: flex; align-items: center; width: 80px;">
                <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.displayName.label }}</span>
                <Tooltip :title="fieldLabels.displayName.tooltip">
                  <span class="help-icon-wrapper">
                    <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; cursor: pointer; margin-left: 4px; pointer-events: none;" />
                  </span>
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
              />
            </div>

            <!-- Type -->
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
                  (val: SelectValue) => {
                    updateField(index as number, 'type', val);
                    // 切换类型时重置默认值
                    updateField(index as number, 'defaults', val === 'BOOLEAN' ? false : val === 'ARRAY' ? [] : '');
                    // ARRAY 类型默认设置 itemType 为 STRING
                    if (val === 'ARRAY') {
                      updateField(index as number, 'itemType', 'STRING');
                    } else {
                      updateField(index as number, 'itemType', undefined);
                    }
                  }
                "
                style="flex: 1"
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

            <!-- ARRAY: itemType 选择器 -->
            <div v-if="item.type === 'ARRAY'" style="display: flex; gap: 8px; align-items: center;">
              <div style="display: flex; align-items: center; width: 80px;">
                <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.itemType.label }}</span>
                <Tooltip :title="fieldLabels.itemType.tooltip">
                  <span class="help-icon-wrapper">
                    <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; cursor: pointer; margin-left: 4px; pointer-events: none;" />
                  </span>
                </Tooltip>
              </div>
              <Select
                :value="item.itemType || 'STRING'"
                @change="
                  (val: SelectValue) => {
                    updateField(index as number, 'itemType', val);
                    // 切换子类型时重置默认值，避免类型不匹配
                    updateField(index as number, 'defaults', []);
                  }
                "
                style="flex: 1"
              >
                <Select.Option
                  v-for="t in itemTypeOptions"
                  :key="t.value"
                  :value="t.value"
                >
                  {{ t.label }}
                </Select.Option>
              </Select>
            </div>

            <!-- Default Value -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; gap: 8px; align-items: center;">
                <div style="display: flex; align-items: center; width: 80px;">
                  <span style="font-size: 12px; color: #6b7280;">{{ fieldLabels.defaults.label }}</span>
                  <Tooltip :title="fieldLabels.defaults.tooltip">
                    <span class="help-icon-wrapper">
                      <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; cursor: pointer; margin-left: 4px; pointer-events: none;" />
                    </span>
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
                    :step="item.type === 'FLOAT' ? 0.1 : 1"
                  />
                </template>
                <template v-else-if="getControlType(item.type) === 'json'">
                  <Input.TextArea
                    :value="item.defaults"
                    @input="
                      (e: any) =>
                        updateField(index as number, 'defaults', e.target.value)
                    "
                    placeholder='输入 JSON，如 {"key": "value"}'
                    style="flex: 1; min-height: 80px"
                    :status="getJsonValidationStatus(item.defaults)"
                    :auto-size="{ minRows: 2, maxRows: 4 }"
                  />
                </template>
                <template v-else-if="getControlType(item.type) === 'array'">
                  <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                    <div 
                      v-for="(arrItem, arrIndex) in getArrayItems(item)" 
                      :key="`arr-${index}-${arrIndex}`"
                      style="display: flex; gap: 4px; align-items: center;"
                    >
                      <Input
                        v-if="getArrayItemInputType(item) === 'STRING'"
                        :value="arrItem"
                        @input="(e: any) => updateArrayItemValue(index as number, arrIndex, e.target.value)"
                        :placeholder="`元素 ${arrIndex + 1}`"
                        style="flex: 1"
                      />
                      <InputNumber
                        v-else-if="getArrayItemInputType(item) === 'INT' || getArrayItemInputType(item) === 'FLOAT'"
                        :value="arrItem"
                        @change="(val: any) => updateArrayItemValue(index as number, arrIndex, val)"
                        :step="getArrayItemInputType(item) === 'FLOAT' ? 0.1 : 1"
                        placeholder="数值"
                        style="flex: 1"
                      />
                      <Switch
                        v-else-if="getArrayItemInputType(item) === 'BOOLEAN'"
                        :checked="!!arrItem"
                        @change="(val: any) => updateArrayItemValue(index as number, arrIndex, val)"
                        checked-children="true"
                        un-checked-children="false"
                      />
                      <Button
                        type="text"
                        size="small"
                        danger
                        @click="removeArrayItemValue(index as number, arrIndex)"
                        style="min-width: 28px;"
                      >
                        <IconifyIcon icon="mdi:close" :size="12" />
                      </Button>
                    </div>
                    <Button 
                      type="dashed" 
                      size="small" 
                      @click="addArrayItemValue(index as number)"
                    >
                      <IconifyIcon icon="mdi:plus" :size="12" /> 添加元素
                    </Button>
                  </div>
                </template>
                <template v-else>
                  <VarPicker
                    :value="item.defaults"
                    :placeholder="'默认值或选择变量'"
                    style="flex: 1"
                    @update:value="(val: string) => updateField(index as number, 'defaults', val)"
                  />
                </template>
              </div>
              <!-- JSON 校验提示 -->
              <div 
                v-if="getControlType(item.type) === 'json' && item.defaults && !validateJson(item.defaults)" 
                style="font-size: 12px; color: #ef4444; padding-left: 80px;"
              >
                <IconifyIcon icon="mdi:alert-circle" :size="12" style="margin-right: 4px; vertical-align: middle;" />
                JSON 格式不正确，请检查语法
              </div>
              <div 
                v-else-if="getControlType(item.type) === 'json' && item.defaults && validateJson(item.defaults) && item.defaults.trim()" 
                style="font-size: 12px; color: #10b981; padding-left: 80px;"
              >
                <IconifyIcon icon="mdi:check-circle" :size="12" style="margin-right: 4px; vertical-align: middle;" />
                {{ getJsonValidationTip(item.defaults) }}
              </div>
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
    <div
      v-if="field.props.description"
      style="margin-top: 4px; font-size: 12px; color: #9ca3af;"
    >
      {{ field.props.description }}
    </div>
  </div>
</template>

<style scoped>
.help-icon-wrapper {
  display: inline-flex;
  align-items: center;
}
</style>
