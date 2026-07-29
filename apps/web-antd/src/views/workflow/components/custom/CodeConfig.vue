<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, Tooltip } from 'ant-design-vue';

const props = defineProps<{
  nodeConfigForm: Record<string, any>;
}>();

const DEFAULT_SOURCE_CODE = `def main(inputs):
    # 通过 inputs["参数key"] 获取上游传入的数据
    # 业务逻辑编写位置

    # return 字典作为节点输出，传递给下游节点
    return {

    }`;

const inputParams = ref<Array<{ key: string; expression: string }>>([]);
const outputKeys = ref<Array<{ key: string }>>([]);

const codeValidationError = ref('');

const inputsHelpText = `配置输入变量，在代码中通过 inputs["key"] 获取。
- 参数Key：英文字母或下划线开头，仅支持英文字母、数字、下划线
- 变量值：绑定上游变量，如 {{ vars.payload.data }}`;

const outputsHelpText = `输出变量仅用于画布下游节点下拉选择变量，不会注入运行代码。
真实输出由代码中 return 的字典决定，保证运行和配置解耦。`;

const codeHelpText = `必须定义 main(inputs) 函数作为入口，通过 return 字典返回输出。
平台后端自动拼接脚手架代码，用户不需要手动导入 os/json 等系统包。`;

function initForm() {
  if (!props.nodeConfigForm.inputParams) {
    props.nodeConfigForm.inputParams = [];
  }
  if (!props.nodeConfigForm.sourceCode) {
    props.nodeConfigForm.sourceCode = DEFAULT_SOURCE_CODE;
  }
  if (!props.nodeConfigForm.outputKeys) {
    props.nodeConfigForm.outputKeys = [];
  }

  inputParams.value = props.nodeConfigForm.inputParams.map((item: any) => ({
    key: item.key || '',
    expression: item.expression || '',
  }));

  outputKeys.value = props.nodeConfigForm.outputKeys.map((item: any) => {
    if (typeof item === 'string') {
      return { key: item };
    }
    return { key: item.key || '' };
  });
}

initForm();

watch(
  () => props.nodeConfigForm.inputParams,
  () => {
    inputParams.value = props.nodeConfigForm.inputParams.map((item: any) => ({
      key: item.key || '',
      expression: item.expression || '',
    }));
  },
  { deep: true },
);

watch(
  () => props.nodeConfigForm.outputKeys,
  () => {
    outputKeys.value = props.nodeConfigForm.outputKeys.map((item: any) => {
      if (typeof item === 'string') {
        return { key: item };
      }
      return { key: item.key || '' };
    });
  },
  { deep: true },
);

const keyPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const duplicateKeyError = computed(() => {
  const keys = inputParams.value.map(p => p.key).filter(k => k);
  const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
  return duplicates;
});

const outputDuplicateKeyError = computed(() => {
  const keys = outputKeys.value.map(p => p.key).filter(k => k);
  const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
  return duplicates;
});

function addInputParam() {
  inputParams.value.push({ key: '', expression: '' });
  syncInputParamsToForm();
}

function removeInputParam(index: number) {
  inputParams.value.splice(index, 1);
  syncInputParamsToForm();
}

function addOutputKey() {
  outputKeys.value.push({ key: '' });
  syncOutputKeysToForm();
}

function removeOutputKey(index: number) {
  outputKeys.value.splice(index, 1);
  syncOutputKeysToForm();
}

function syncInputParamsToForm() {
  props.nodeConfigForm.inputParams = inputParams.value.map(item => ({ ...item }));
}

function syncOutputKeysToForm() {
  props.nodeConfigForm.outputKeys = outputKeys.value.map(item => ({ ...item }));
}

function validateCode() {
  const code = props.nodeConfigForm.sourceCode || '';
  const hasMainFunction = /def\s+main\s*\(\s*inputs\s*\)/.test(code);
  if (!hasMainFunction) {
    codeValidationError.value = '代码中未找到 main(inputs) 函数';
  } else {
    codeValidationError.value = '';
  }
  return hasMainFunction;
}

watch(
  () => props.nodeConfigForm.sourceCode,
  () => {
    validateCode();
  },
  { immediate: true },
);

function validateKeyFormat(key: string): boolean {
  if (!key) return true;
  return keyPattern.test(key);
}
</script>

<template>
  <div class="code-config">
    <!-- 输入参数 -->
    <div class="section-block">
      <div class="section-header">
        <div class="section-title">
          <span>输入参数</span>
        </div>
        <div class="section-header-right">
          <Button type="link" size="small" class="add-btn" @click="addInputParam">
            <IconifyIcon icon="mdi:plus" :size="14" />
            添加变量
          </Button>
          <Tooltip :title="inputsHelpText" placement="right">
            <IconifyIcon icon="mdi:help-circle-outline" :size="14" class="help-icon" />
          </Tooltip>
        </div>
      </div>

      <template v-if="inputParams.length > 0">
        <div class="list-header">
          <span class="col-key">变量名称</span>
          <span class="col-expression">变量值</span>
          <span class="col-action"></span>
        </div>

        <div
          v-for="(param, index) in inputParams"
          :key="index"
          class="form-row"
          :class="{ 'has-error': !validateKeyFormat(param.key) || duplicateKeyError.includes(param.key) }"
        >
          <Input
            v-model:value="param.key"
            placeholder="英文、下划线开头"
            class="col-key"
            @input="syncInputParamsToForm"
            :status="!validateKeyFormat(param.key) || duplicateKeyError.includes(param.key) ? 'error' : ''"
          />
          <Input
            v-model:value="param.expression"
            placeholder="{{ vars.xxx }}"
            class="col-expression"
            @input="syncInputParamsToForm"
          />
          <Button
            type="text"
            size="small"
            @click="removeInputParam(index)"
            class="col-action"
          >
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
      </template>

      <div v-else class="empty-tip">
        暂无输入参数，点击上方按钮添加
      </div>

      <div v-if="duplicateKeyError.length > 0" class="error-message">
        <IconifyIcon icon="mdi:alert" :size="12" />
        <span>参数Key重复：{{ duplicateKeyError.join(', ') }}</span>
      </div>
    </div>

    <!-- 代码 -->
    <div class="section-block">
      <div class="section-header">
        <div class="section-title">
          <span>代码</span>
        </div>
        <div class="section-header-right">
          <div class="section-actions">
            <Tooltip title="重置为默认模板" placement="left">
              <Button type="text" size="small" @click="nodeConfigForm.sourceCode = DEFAULT_SOURCE_CODE">
                <IconifyIcon icon="mdi:refresh" :size="14" />
              </Button>
            </Tooltip>
          </div>
          <Tooltip :title="codeHelpText" placement="right">
            <IconifyIcon icon="mdi:help-circle-outline" :size="14" class="help-icon" />
          </Tooltip>
        </div>
      </div>

      <div class="code-editor-wrapper">
        <div class="code-line-numbers">
          <div v-for="n in Math.max((nodeConfigForm.sourceCode || '').split('\n').length, 1)" :key="n" class="line-number">{{ n }}</div>
        </div>
        <textarea
          v-model="nodeConfigForm.sourceCode"
          class="code-textarea"
          spellcheck="false"
          @input="validateCode"
        ></textarea>
      </div>

      <div v-if="codeValidationError" class="warning-message">
        <IconifyIcon icon="mdi:alert" :size="12" />
        <span>{{ codeValidationError }}</span>
      </div>
    </div>

    <!-- 输出字段 -->
    <div class="section-block">
      <div class="section-header">
        <div class="section-title">
          <span>输出字段</span>
        </div>
        <div class="section-header-right">
          <Button type="link" size="small" class="add-btn" @click="addOutputKey">
            <IconifyIcon icon="mdi:plus" :size="14" />
            添加变量
          </Button>
          <Tooltip :title="outputsHelpText" placement="right">
            <IconifyIcon icon="mdi:help-circle-outline" :size="14" class="help-icon" />
          </Tooltip>
        </div>
      </div>

      <template v-if="outputKeys.length > 0">
        <div class="list-header">
          <span class="col-output-key">输出变量</span>
          <span class="col-action"></span>
        </div>

        <div
          v-for="(output, index) in outputKeys"
          :key="index"
          class="form-row"
          :class="{ 'has-error': outputDuplicateKeyError.includes(output.key) }"
        >
          <Input
            v-model:value="output.key"
            placeholder="输出变量名"
            class="col-output-key"
            @input="syncOutputKeysToForm"
            :status="outputDuplicateKeyError.includes(output.key) ? 'error' : ''"
          />
          <Button
            type="text"
            size="small"
            @click="removeOutputKey(index)"
            class="col-action"
          >
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
      </template>

      <div v-else class="empty-tip">
        暂无输出字段，点击上方按钮添加
      </div>

      <div v-if="outputDuplicateKeyError.length > 0" class="error-message">
        <IconifyIcon icon="mdi:alert" :size="12" />
        <span>输出Key重复：{{ outputDuplicateKeyError.join(', ') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.code-config {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  padding-top: 8px;
}

.section-block {
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.section-title::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9ca3af;
  margin-right: 8px;
}

.section-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.help-icon {
  color: #9ca3af;
  cursor: help;
  transition: color 0.2s;
}

.help-icon:hover {
  color: #3b82f6;
}

.add-btn {
  font-size: 13px !important;
  color: #3b82f6;
}

.add-btn:hover {
  color: #2563eb;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.section-actions :deep(.ant-btn) {
  color: #9ca3af;
}

.section-actions :deep(.ant-btn:hover) {
  color: #3b82f6;
}

.list-header {
  display: flex;
  gap: 8px;
  padding: 0 0 4px;
  font-size: 12px;
  color: #6b7280;
}

.list-header .col-key {
  width: 30%;
}

.list-header .col-expression {
  flex: 1;
}

.list-header .col-output-key {
  flex: 1;
}

.list-header .col-action {
  width: 32px;
}

.form-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.form-row.has-error :deep(.ant-input) {
  border-color: #ef4444;
}

.col-key {
  width: 30% !important;
}

.col-expression {
  flex: 1;
}

.col-output-key {
  flex: 1;
}

.col-action {
  width: 32px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
  color: #9ca3af;
  flex-shrink: 0;
}

.col-action:hover {
  color: #ef4444;
}

.empty-tip {
  padding: 8px 0;
  font-size: 12px;
  color: #9ca3af;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 6px 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  font-size: 12px;
  color: #dc2626;
}

.code-editor-wrapper {
  position: relative;
  display: flex;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.code-textarea {
  flex: 1;
  min-height: 280px;
  padding: 10px 12px 10px 40px;
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #1f2937;
  background: #fff;
  border: none;
  resize: vertical;
  outline: none;
  tab-size: 4;
}

.code-textarea:focus {
  box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.5);
}

.code-line-numbers {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 32px;
  padding: 10px 6px;
  text-align: right;
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #9ca3af;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  user-select: none;
  overflow: hidden;
}

.code-line-numbers .line-number {
  min-height: 19.5px;
}

.warning-message {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 6px 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 4px;
  font-size: 12px;
  color: #b45309;
}
</style>
