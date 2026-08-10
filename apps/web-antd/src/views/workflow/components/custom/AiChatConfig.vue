<script lang="ts" setup>
import { ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, InputNumber, Select, Tooltip } from 'ant-design-vue';

import VarInserter from '../fields/VarInserter.vue';
import VarPicker from '../fields/VarPicker.vue';

const props = defineProps<{
  nodeConfigForm: Record<string, any>;
}>();

// ==================== AI 引擎配置 ====================

const engineOptions = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'qwen', label: '通义千问' },
  { value: 'deepseek', label: 'DeepSeek' },
];

/** AI 引擎预设：包含 Kestra type、默认 baseUrl、默认 modelName */
const enginePresets: Record<
  string,
  { baseUrl: string; modelName: string; type: string }
> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o',
    type: 'idp_ai_provider_OpenAI',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelName: 'qwen-max',
    type: 'idp_ai_provider_DashScope',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
    type: 'idp_ai_provider_DeepSeek',
  },
};

const showApiKey = ref(false);

/**
 * 切换 AI 引擎时自动填充预设值
 * 注意：baseUrl 和 modelName 始终可编辑，不会被锁定
 */
function onEngineChange(value: string) {
  const preset = enginePresets[value];
  if (preset) {
    props.nodeConfigForm.providerType = preset.type;
    // 只在当前为空时填充默认值，避免覆盖用户已输入的内容
    if (!props.nodeConfigForm.baseUrl || props.nodeConfigForm.baseUrl === '') {
      props.nodeConfigForm.baseUrl = preset.baseUrl;
    }
    if (!props.nodeConfigForm.modelName || props.nodeConfigForm.modelName === '') {
      props.nodeConfigForm.modelName = preset.modelName;
    }
  }
}

// ==================== 高级参数 ====================

const advancedExpanded = ref(false);

// ==================== 初始化默认值 ====================

if (props.nodeConfigForm.providerKey === undefined) {
  props.nodeConfigForm.providerKey = 'openai';
}
if (props.nodeConfigForm.providerType === undefined) {
  props.nodeConfigForm.providerType = enginePresets.openai.type;
}
if (props.nodeConfigForm.apiKey === undefined) {
  props.nodeConfigForm.apiKey = '';
}
if (props.nodeConfigForm.modelName === undefined) {
  props.nodeConfigForm.modelName = enginePresets.openai.modelName;
}
if (props.nodeConfigForm.baseUrl === undefined) {
  props.nodeConfigForm.baseUrl = enginePresets.openai.baseUrl;
}
if (props.nodeConfigForm.systemPrompt === undefined) {
  props.nodeConfigForm.systemPrompt = '';
}
if (props.nodeConfigForm.userPrompt === undefined) {
  props.nodeConfigForm.userPrompt = '';
}
if (props.nodeConfigForm.temperature === undefined) {
  props.nodeConfigForm.temperature = 0.7;
}
if (props.nodeConfigForm.maxTokens === undefined) {
  props.nodeConfigForm.maxTokens = 4096;
}
if (props.nodeConfigForm.topP === undefined) {
  props.nodeConfigForm.topP = 1;
}

// ==================== 监听变化 ====================

watch(
  () => props.nodeConfigForm.providerKey,
  (newVal, oldVal) => {
    if (newVal !== oldVal && newVal) {
      onEngineChange(newVal);
    }
  },
);
</script>

<template>
  <div class="ai-chat-config">
    <!-- AI 引擎配置区 -->
    <div class="config-section">
      <div class="section-header">
        <span class="section-title">AI 引擎</span>
        <Tooltip title="选择预配置引擎可自动填充默认值，所有字段都支持自定义修改">
          <IconifyIcon icon="mdi:help-circle" :size="14" class="help-icon" />
        </Tooltip>
      </div>

      <div class="form-row">
        <label class="form-label">AI 引擎</label>
        <Select
          v-model:value="nodeConfigForm.providerKey"
          :options="engineOptions"
          placeholder="选择 AI 引擎"
          class="form-input"
        />
      </div>

      <div class="form-row">
        <label class="form-label">
          API Base URL
          <Tooltip title="支持填写任意 HTTP/HTTPS 地址，可用于本地部署、代理转发、企业网关等场景">
            <IconifyIcon icon="mdi:information" :size="12" class="help-icon" />
          </Tooltip>
        </label>
        <VarPicker
          v-model:value="nodeConfigForm.baseUrl"
          placeholder="https://api.example.com/v1"
          class="form-input"
        />
      </div>

      <div class="form-row">
        <label class="form-label">API Key</label>
        <div class="password-wrap">
          <Input
            v-model:value="nodeConfigForm.apiKey"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="请输入 API Key"
            class="form-input"
          />
          <Button
            type="text"
            size="small"
            @click="showApiKey = !showApiKey"
            class="password-toggle"
          >
            <IconifyIcon :icon="showApiKey ? 'mdi:eye-off' : 'mdi:eye'" :size="16" />
          </Button>
        </div>
      </div>

      <div class="form-row">
        <label class="form-label">模型名称</label>
        <VarPicker
          v-model:value="nodeConfigForm.modelName"
          placeholder="模型名称，如 gpt-4o、qwen-max"
          class="form-input"
        />
      </div>
    </div>

    <!-- 提示词配置区 -->
    <div class="config-section">
      <div class="section-header">
        <span class="section-title">提示词配置</span>
        <Tooltip title="系统提示词定义 AI 角色和行为，用户提示词包含具体任务和输入">
          <IconifyIcon icon="mdi:help-circle" :size="14" class="help-icon" />
        </Tooltip>
      </div>

      <div class="form-row">
        <label class="form-label">
          系统提示词
          <span class="optional-tag">（可选）</span>
        </label>
        <VarInserter
          v-model:value="nodeConfigForm.systemPrompt"
          :rows="3"
          placeholder="设置 AI 的角色和行为，如：你是专业的客服助手"
          class="prompt-textarea"
        />
      </div>

      <div class="form-row">
        <label class="form-label">
          用户提示词
          <span class="required-star">*</span>
        </label>
        <VarInserter
          v-model:value="nodeConfigForm.userPrompt"
          :rows="5"
          placeholder="输入具体任务和输入内容，支持插入 {{ }} 变量引用上游节点输出"
          class="prompt-textarea"
        />
      </div>
    </div>

    <!-- 高级参数 -->
    <div class="advanced-section">
      <div class="advanced-header" @click="advancedExpanded = !advancedExpanded">
        <span class="expand-icon">{{ advancedExpanded ? '▼' : '▶' }}</span>
        <span class="advanced-title">高级参数</span>
      </div>
      <div v-show="advancedExpanded" class="advanced-content">
        <div class="form-row">
          <label class="form-label">温度 (Temperature)</label>
          <div class="slider-wrap">
            <InputNumber
              v-model:value="nodeConfigForm.temperature"
              :min="0"
              :max="2"
              :step="0.1"
              size="small"
              class="slider-input"
            />
            <div class="slider-desc">
              <span v-if="nodeConfigForm.temperature < 0.5">更确定性</span>
              <span v-else-if="nodeConfigForm.temperature > 1">更创造性</span>
              <span v-else>平衡</span>
            </div>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">最大 Token 数</label>
          <InputNumber
            v-model:value="nodeConfigForm.maxToken"
            :min="1"
            :max="128000"
            size="small"
            class="form-input"
          />
        </div>

        <div class="form-row">
          <label class="form-label">Top P</label>
          <InputNumber
            v-model:value="nodeConfigForm.topP"
            :min="0"
            :max="1"
            :step="0.1"
            size="small"
            class="form-input"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-chat-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  padding: 0;
}

.config-section {
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.help-icon {
  cursor: help;
  color: #6b7280;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: #495057;
  display: flex;
  align-items: center;
  gap: 4px;
}

.optional-tag {
  font-size: 11px;
  font-weight: normal;
  color: #9ca3af;
}

.required-star {
  color: #ef4444;
}

.form-input {
  width: 100%;
}

.prompt-textarea {
  width: 100%;
}

.password-wrap {
  display: flex;
  align-items: center;
}

.password-toggle {
  margin-left: -28px;
  z-index: 1;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.advanced-section {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.advanced-header {
  display: flex;
  align-items: center;
  padding: 12px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  user-select: none;
  background: #f9fafb;
}

.advanced-header:hover {
  background: #f3f4f6;
}

.expand-icon {
  margin-right: 8px;
  font-size: 12px;
  color: #6b7280;
}

.advanced-title {
  flex: 1;
}

.advanced-content {
  padding: 12px;
  background: #fff;
}

.slider-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-input {
  width: 120px !important;
}

.slider-desc {
  font-size: 12px;
  color: #6b7280;
}
</style>
