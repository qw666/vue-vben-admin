<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  Button,
  Input,
  InputNumber,
  Modal,
  Radio,
  TabPane,
  Tabs,
  Tag,
  Tooltip,
  message,
} from 'ant-design-vue';

import { IconifyIcon } from '@vben/icons';

import type { FlowInput } from '#/api';

import {
  createOrUpdateCredential,
  getCredentialByFlow,
  type CredentialResp,
} from '#/api/core/openCredential';

interface Props {
  inputs: FlowInput[];
  visible: boolean;
  loading?: boolean;
  /** 项目ID */
  projectId?: number;
  /** 流程ID */
  flowId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  projectId: undefined,
  flowId: undefined,
});

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'confirm', values: Record<string, any>): void;
}>();

// ==================== Tab 相关 ====================
const activeTab = ref<string>('inputs');

const hasInputs = computed(() => props.inputs.length > 0);
const showWebhookTab = computed(() => props.flowId && props.projectId);

watch(
  () => props.visible,
  (val) => {
    if (val) {
      // 默认选中 inputs tab
      activeTab.value = 'inputs';
      // 重置 webhook 状态
      credentialData.value = null;
      webhookLoaded.value = false;
    }
  },
);

watch(
  () => activeTab.value,
  (val) => {
    if (val === 'webhook' && showWebhookTab.value && !webhookLoaded.value) {
      loadCredential();
    }
  },
);

// ==================== Inputs 相关 ====================
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

// ==================== Webhook 相关 ====================
const generatingKey = ref(false);
const loadingCredential = ref(false);
const credentialData = ref<CredentialResp | null>(null);
const webhookLoaded = ref(false);

async function loadCredential() {
  if (!props.projectId || !props.flowId) return;

  loadingCredential.value = true;
  webhookLoaded.value = true;
  try {
    const resp = await getCredentialByFlow(props.projectId, props.flowId);
    credentialData.value = resp || null;
  } catch {
    credentialData.value = null;
  } finally {
    loadingCredential.value = false;
  }
}

async function handleGenerateKey() {
  if (!props.projectId || !props.flowId) {
    message.warning('缺少项目ID或流程ID');
    return;
  }

  generatingKey.value = true;
  try {
    await createOrUpdateCredential({
      projectId: props.projectId,
      flowId: props.flowId,
    });
    message.success('密钥生成成功');
    // 生成后自动加载完整信息
    await loadCredential();
  } catch (error: any) {
    message.error(error?.message || '密钥生成失败');
  } finally {
    generatingKey.value = false;
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  } catch {
    message.error('复制失败');
  }
}

// ==================== 提交相关 ====================
function handleConfirm() {
  // 如果在 webhook tab，直接关闭
  if (activeTab.value === 'webhook') {
    emit('confirm', {});
    return;
  }

  if (!hasInputs.value) {
    emit('confirm', {});
    return;
  }

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
    :width="560"
    @ok="handleConfirm"
    @cancel="handleCancel"
  >
    <!-- 有 inputs 或 webhook 时显示 Tabs -->
    <Tabs v-if="showWebhookTab || hasInputs || true" v-model:activeKey="activeTab" size="small">
      <TabPane key="inputs" tab="输入参数">
        <!-- 有 inputs 配置 -->
        <div v-if="hasInputs" class="form-list">
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

        <!-- 无 inputs 配置 -->
        <div v-else class="empty-state">
          <IconifyIcon icon="mdi:form-textbox-input" :size="32" class="empty-icon" />
          <div class="empty-title">未配置输入参数</div>
          <div class="empty-desc">当前流程未配置输入参数，可直接运行</div>
        </div>
      </TabPane>

      <TabPane v-if="showWebhookTab" key="webhook" tab="Webhook">
        <div class="webhook-section">
          <!-- 加载中 -->
          <div v-if="loadingCredential" class="webhook-loading">
            加载中...
          </div>

          <!-- 已加载且有凭据 -->
          <template v-else-if="credentialData">
            <div class="webhook-item">
              <div class="webhook-header">
                <span class="webhook-title">API 密钥</span>
                <Button
                  type="primary"
                  size="small"
                  :loading="generatingKey"
                  @click="handleGenerateKey"
                >
                  重新生成
                </Button>
              </div>
              <div class="webhook-content">
                <div class="value-row">
                  <span class="value-label">密钥值：</span>
                  <Input :value="credentialData.apiKey" readonly size="small" />
                  <Tooltip title="复制">
                    <span class="copy-icon" @click="copyToClipboard(credentialData.apiKey)">复制</span>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div class="webhook-item">
              <div class="webhook-header">
                <span class="webhook-title">Webhook 调用信息</span>
              </div>
              <div class="webhook-content">
                <div class="value-row">
                  <span class="value-label">调用地址：</span>
                  <Input :value="credentialData.webhookUrl" readonly size="small" />
                  <Tooltip title="复制">
                    <span class="copy-icon" @click="copyToClipboard(credentialData.webhookUrl)">复制</span>
                  </Tooltip>
                </div>
                <div class="value-row">
                  <span class="value-label">请求头：</span>
                  <Input.TextArea
                    :value="credentialData.authHeaderText"
                    :auto-size="{ minRows: 2, maxRows: 4 }"
                    readonly
                    size="small"
                  />
                  <Tooltip title="复制">
                    <span class="copy-icon copy-icon-top" @click="copyToClipboard(credentialData.authHeaderText)">复制</span>
                  </Tooltip>
                </div>
                <div class="value-row">
                  <span class="value-label">Body 示例：</span>
                  <Input.TextArea
                    :value="credentialData.bodyExample"
                    :auto-size="{ minRows: 2, maxRows: 4 }"
                    readonly
                    size="small"
                  />
                  <Tooltip title="复制">
                    <span class="copy-icon copy-icon-top" @click="copyToClipboard(credentialData.bodyExample)">复制</span>
                  </Tooltip>
                </div>
                <div class="value-row">
                  <span class="value-label">Curl 示例：</span>
                  <Input.TextArea
                    :value="credentialData.curlExample"
                    :auto-size="{ minRows: 3, maxRows: 6 }"
                    readonly
                    size="small"
                  />
                  <Tooltip title="复制">
                    <span class="copy-icon copy-icon-top" @click="copyToClipboard(credentialData.curlExample)">复制</span>
                  </Tooltip>
                </div>
              </div>
            </div>
          </template>

          <!-- 已加载但无凭据 -->
          <template v-else-if="webhookLoaded">
            <div class="webhook-item webhook-empty">
              <div class="webhook-empty-icon">🔒</div>
              <div class="webhook-empty-title">尚未生成 Webhook 密钥</div>
              <div class="webhook-empty-desc">点击下方按钮为当前流程创建 API 密钥，生成后可获取 Webhook 调用地址</div>
              <Button
                type="primary"
                size="small"
                :loading="generatingKey"
                @click="handleGenerateKey"
              >
                生成密钥
              </Button>
            </div>
          </template>
        </div>
      </TabPane>
    </Tabs>
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

.webhook-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.webhook-loading {
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
  padding: 24px 0;
}

.webhook-item {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
}

.webhook-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.webhook-title {
  font-weight: 500;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.88);
}

.webhook-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.webhook-empty {
  text-align: center;
  padding: 32px 24px;
}

.webhook-empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.webhook-empty-title {
  font-weight: 500;
  font-size: 15px;
  color: rgba(0, 0, 0, 0.88);
  margin-bottom: 8px;
}

.webhook-empty-desc {
  color: #9ca3af;
  font-size: 13px;
  margin-bottom: 16px;
  line-height: 1.5;
}

.webhook-tip {
  color: #9ca3af;
  font-size: 13px;
  padding: 8px 0;
}

.value-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.value-label {
  flex-shrink: 0;
  color: #6b7280;
  font-size: 13px;
  min-width: 70px;
}

.value-row .ant-input,
.value-row .ant-input-textarea {
  flex: 1;
}

.copy-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  height: 22px;
  line-height: 22px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  color: #8c8c8c;
  background: #f5f5f5;
  border: 1px solid #e8e8e8;
  transition: all 0.15s;
}

.copy-icon:hover {
  color: #1677ff;
  background: #e6f4ff;
  border-color: #1677ff;
}

.copy-icon-top {
  margin-top: 6px;
}

.empty-state {
  text-align: center;
  padding: 40px 24px;
}

.empty-icon {
  color: #d1d5db;
  margin-bottom: 12px;
}

.empty-title {
  font-weight: 500;
  font-size: 15px;
  color: rgba(0, 0, 0, 0.88);
  margin-bottom: 8px;
}

.empty-desc {
  color: #9ca3af;
  font-size: 13px;
  line-height: 1.5;
}
</style>
