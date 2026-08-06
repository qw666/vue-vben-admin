<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  Input,
  InputNumber,
  Modal,
  Radio,
  Tag,
  Tooltip,
  message,
} from 'ant-design-vue';

import type { FlowInput } from '#/api';

interface Props {
  inputs: FlowInput[];
  visible: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'confirm', values: Record<string, any>): void;
}>();

const formValues = ref<Record<string, any>>({});
const arrayInputs = ref<Record<string, string>>({});
const jsonInputs = ref<Record<string, string>>({});
const validationErrors = ref<Record<string, string>>({});

function getDefaultByType(type: string): any {
  switch (type) {
    case 'BOOLEAN':
      return false;
    case 'INT':
    case 'FLOAT':
      return 0;
    case 'ARRAY':
      return [];
    case 'JSON':
      return {};
    default:
      return '';
  }
}

function initFormValues() {
  const values: Record<string, any> = {};
  const arrays: Record<string, string> = {};
  const jsons: Record<string, string> = {};

  props.inputs.forEach((input) => {
    const defaultVal = input.defaults ?? getDefaultByType(input.type);
    values[input.id] = defaultVal;

    if (input.type === 'ARRAY') {
      if (Array.isArray(defaultVal)) {
        arrays[input.id] = JSON.stringify(defaultVal);
      } else if (typeof defaultVal === 'string') {
        try {
          JSON.parse(defaultVal);
          arrays[input.id] = defaultVal;
        } catch {
          arrays[input.id] = '[]';
        }
      } else {
        arrays[input.id] = '[]';
      }
    } else if (input.type === 'JSON') {
      if (typeof defaultVal === 'object' && defaultVal !== null) {
        jsons[input.id] = JSON.stringify(defaultVal, null, 2);
      } else if (typeof defaultVal === 'string') {
        try {
          JSON.parse(defaultVal);
          jsons[input.id] = defaultVal;
        } catch {
          jsons[input.id] = '{}';
        }
      } else {
        jsons[input.id] = '{}';
      }
    }
  });

  formValues.value = values;
  arrayInputs.value = arrays;
  jsonInputs.value = jsons;
}

watch(
  () => props.inputs,
  () => {
    if (props.inputs.length > 0) {
      initFormValues();
    }
  },
  { immediate: true },
);

watch(
  () => props.visible,
  (val) => {
    if (val) {
      validationErrors.value = {};
      initFormValues();
    }
  },
);

function validateArray(inputId: string): string {
  const raw = arrayInputs.value[inputId];
  if (!raw || !raw.trim()) return '';
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return '格式错误：请输入有效的 JSON 数组，如 [1, 2, 3]';
    }
    return '';
  } catch {
    return '格式错误：请输入有效的 JSON 数组';
  }
}

function validateJson(inputId: string): string {
  const raw = jsonInputs.value[inputId];
  if (!raw || !raw.trim()) return '';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      return '格式错误：请输入有效的 JSON 对象，如 {"key": "value"}';
    }
    return '';
  } catch {
    return '格式错误：请输入有效的 JSON 对象';
  }
}

function validateField(input: FlowInput): string {
  const displayName = input.displayName || input.id;

  if (input.required) {
    const rawValue = formValues.value[input.id];
    if (input.type === 'ARRAY') {
      const raw = arrayInputs.value[input.id];
      if (!raw || !raw.trim()) return `请填写「${displayName}」`;
    } else if (input.type === 'JSON') {
      const raw = jsonInputs.value[input.id];
      if (!raw || !raw.trim()) return `请填写「${displayName}」`;
    } else {
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        return `请填写「${displayName}」`;
      }
    }
  }

  if (input.type === 'ARRAY') {
    return validateArray(input.id);
  }
  if (input.type === 'JSON') {
    return validateJson(input.id);
  }
  return '';
}

function updateValidation(inputId: string, error: string) {
  if (error) {
    validationErrors.value[inputId] = error;
  } else {
    delete validationErrors.value[inputId];
  }
}

function parseArrayField(inputId: string, displayName: string): any[] {
  const raw = arrayInputs.value[inputId] || '[]';
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('不是数组');
    }
    return parsed;
  } catch {
    throw new Error(`「${displayName}」数组格式错误，请输入有效的 JSON 数组`);
  }
}

function parseJsonField(inputId: string, displayName: string): Record<string, any> {
  const raw = jsonInputs.value[inputId] || '{}';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('不是对象');
    }
    return parsed;
  } catch {
    throw new Error(`「${displayName}」JSON 格式错误，请输入有效的 JSON 对象`);
  }
}

function handleConfirm() {
  const result: Record<string, any> = {};
  const errors: string[] = [];

  for (const input of props.inputs) {
    const displayName = input.displayName || input.id;
    const rawValue = formValues.value[input.id];

    if (input.required) {
      if (input.type === 'ARRAY') {
        const raw = arrayInputs.value[input.id];
        if (!raw || !raw.trim()) {
          errors.push(`请填写「${displayName}」`);
          continue;
        }
      } else if (input.type === 'JSON') {
        const raw = jsonInputs.value[input.id];
        if (!raw || !raw.trim()) {
          errors.push(`请填写「${displayName}」`);
          continue;
        }
      } else {
        if (rawValue === undefined || rawValue === null || rawValue === '') {
          errors.push(`请填写「${displayName}」`);
          continue;
        }
      }
    }

    try {
      switch (input.type) {
        case 'STRING':
          result[input.id] = String(rawValue ?? '');
          break;
        case 'INT':
          result[input.id] = Number(rawValue) || 0;
          break;
        case 'FLOAT':
          result[input.id] = Number(rawValue) || 0;
          break;
        case 'BOOLEAN':
          result[input.id] = Boolean(rawValue);
          break;
        case 'ARRAY':
          result[input.id] = parseArrayField(input.id, displayName);
          break;
        case 'JSON':
          result[input.id] = parseJsonField(input.id, displayName);
          break;
        default:
          result[input.id] = rawValue;
      }
    } catch (e: any) {
      errors.push(e.message || `「${displayName}」格式错误`);
    }
  }

  if (errors.length > 0) {
    message.warning(errors[0]);
    return;
  }

  emit('confirm', result);
}

function handleCancel() {
  emit('update:visible', false);
}

function onArrayInput(inputId: string, e: Event) {
  const target = e.target as HTMLTextAreaElement;
  arrayInputs.value[inputId] = target.value;
  const input = props.inputs.find((i) => i.id === inputId);
  if (input) {
    const error = validateField(input);
    updateValidation(inputId, error);
  }
}

function onJsonInput(inputId: string, e: Event) {
  const target = e.target as HTMLTextAreaElement;
  jsonInputs.value[inputId] = target.value;
  const input = props.inputs.find((i) => i.id === inputId);
  if (input) {
    const error = validateField(input);
    updateValidation(inputId, error);
  }
}

function getPlaceholder(input: FlowInput): string {
  switch (input.type) {
    case 'ARRAY':
      return '如 [1, 2, 3]';
    case 'JSON':
      return '如 {"key": "value"}';
    default:
      return '';
  }
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    STRING: 'default',
    INT: 'blue',
    FLOAT: 'blue',
    BOOLEAN: 'green',
    ARRAY: 'purple',
    JSON: 'cyan',
  };
  return colors[type] || 'default';
}

function getTypeLabelFull(input: FlowInput): string {
  const { type, itemType } = input;
  if (type === 'ARRAY' && itemType) {
    return `ARRAY<${itemType}>`;
  }
  const labels: Record<string, string> = {
    STRING: 'STRING',
    INT: 'INT',
    FLOAT: 'FLOAT',
    BOOLEAN: 'BOOLEAN',
    ARRAY: 'ARRAY',
    JSON: 'JSON',
  };
  return labels[type] || type;
}

function getValidationStatus(inputId: string): '' | 'error' | 'success' {
  const error = validationErrors.value[inputId];
  if (error) return 'error';
  return '';
}

function getTypeTooltip(input: FlowInput): string {
  const tips: Record<string, string> = {
    STRING: '字符串类型',
    INT: '整数类型',
    FLOAT: '浮点数类型',
    BOOLEAN: '布尔类型（true/false）',
    ARRAY: '数组类型，需配置元素类型',
    JSON: 'JSON 对象类型',
  };
  return tips[input.type] || input.type;
}
</script>

<template>
  <Modal
    :open="visible"
    title="运行配置"
    :confirm-loading="loading"
    ok-text="运行"
    cancel-text="取消"
    :mask-closable="false"
    :destroy-on-close="true"
    :body-style="{ maxHeight: '70vh', overflowY: 'auto', padding: '12px 16px' }"
    :width="520"
    @ok="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="form-list">
      <div
        v-for="input in inputs"
        :key="input.id"
        class="form-row"
      >
        <div class="form-row-header">
          <span class="label-prefix">参数名：</span>
          <span class="label-text">{{ input.displayName || input.id }}</span>
          <span v-if="input.required" class="required">*</span>
          <span class="label-spacer"></span>
          <Tooltip :title="getTypeTooltip(input)">
            <Tag :color="getTypeColor(input.type)" size="small" class="type-tag">
              {{ getTypeLabelFull(input) }}
            </Tag>
          </Tooltip>
        </div>
        <div class="form-row-control">
          <span class="control-prefix">参数值：</span>
          <div class="control-wrapper">
            <Input
              v-if="input.type === 'STRING'"
              v-model:value="formValues[input.id]"
              :placeholder="getPlaceholder(input)"
              size="small"
            />
            <InputNumber
              v-else-if="input.type === 'INT' || input.type === 'FLOAT'"
              v-model:value="formValues[input.id]"
              :step="input.type === 'INT' ? 1 : 0.01"
              :precision="input.type === 'INT' ? 0 : 2"
              style="width: 100%"
              :placeholder="getPlaceholder(input)"
              size="small"
            />
            <Radio.Group
              v-else-if="input.type === 'BOOLEAN'"
              v-model:value="formValues[input.id]"
            >
              <Radio :value="true">是</Radio>
              <Radio :value="false">否</Radio>
            </Radio.Group>
            <template v-else-if="input.type === 'ARRAY'">
              <Input.TextArea
                :value="arrayInputs[input.id]"
                :auto-size="{ minRows: 1, maxRows: 5 }"
                :placeholder="getPlaceholder(input)"
                :status="getValidationStatus(input.id)"
                @input="onArrayInput(input.id, $event)"
                size="small"
                class="form-textarea"
              />
              <div v-if="validationErrors[input.id]" class="field-error">
                {{ validationErrors[input.id] }}
              </div>
            </template>
            <template v-else-if="input.type === 'JSON'">
              <Input.TextArea
                :value="jsonInputs[input.id]"
                :auto-size="{ minRows: 2, maxRows: 10 }"
                :placeholder="getPlaceholder(input)"
                :status="getValidationStatus(input.id)"
                @input="onJsonInput(input.id, $event)"
                size="small"
                class="form-textarea"
              />
              <div v-if="validationErrors[input.id]" class="field-error">
                {{ validationErrors[input.id] }}
              </div>
            </template>
            <Input
              v-else
              v-model:value="formValues[input.id]"
              :placeholder="getPlaceholder(input)"
              size="small"
            />
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.form-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row-header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.88);
  line-height: 1.5;
  gap: 4px;
}

.label-prefix {
  color: #6b7280;
  font-weight: 400;
}

.label-text {
  font-weight: 500;
}

.label-spacer {
  flex: 1;
}

.form-row-header .required {
  color: #ff4d4f;
}

.form-row-control {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}

.control-prefix {
  flex-shrink: 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.8;
  padding-top: 2px;
}

.control-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-error {
  color: #ff4d4f;
  font-size: 12px;
  line-height: 1.4;
}

.type-tag {
  cursor: help;
  user-select: none;
  flex-shrink: 0;
  font-size: 11px;
}

.form-textarea {
  width: 100%;
}
</style>
