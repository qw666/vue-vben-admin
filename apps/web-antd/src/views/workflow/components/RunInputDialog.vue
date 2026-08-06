<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  Alert,
  Input,
  InputNumber,
  Modal,
  Switch,
  Tabs,
  Tag,
  message,
} from 'ant-design-vue';

const TabPane = Tabs.TabPane;

import type { FlowInput, FlowTrigger } from '#/api';

interface Props {
  inputs: FlowInput[];
  triggers?: FlowTrigger[];
  visible: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  triggers: () => [],
});

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'confirm', values: Record<string, any>): void;
}>();

const formValues = ref<Record<string, any>>({});
const arrayInputs = ref<Record<string, string>>({});
const jsonInputs = ref<Record<string, string>>({});
const triggerValues = ref<Record<string, any>>({});
const activeTab = ref<string>('inputs');

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
      arrays[input.id] = Array.isArray(defaultVal)
        ? JSON.stringify(defaultVal)
        : '[]';
    } else if (input.type === 'JSON') {
      jsons[input.id] =
        typeof defaultVal === 'object' && defaultVal !== null
          ? JSON.stringify(defaultVal, null, 2)
          : '{}';
    }
  });

  formValues.value = values;
  arrayInputs.value = arrays;
  jsonInputs.value = jsons;

  // 初始化触发器值
  const trigValues: Record<string, any> = {};
  props.triggers.forEach((trigger) => {
    trigValues[trigger.id] = { ...trigger };
  });
  triggerValues.value = trigValues;
}

watch(
  () => [props.inputs, props.triggers],
  () => {
    if (props.inputs.length > 0 || props.triggers.length > 0) {
      initFormValues();
    }
  },
  { immediate: true },
);

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (props.inputs.length > 0) {
        activeTab.value = 'inputs';
      } else if (props.triggers.length > 0) {
        activeTab.value = 'triggers';
      }
    }
  },
);

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

  // 处理 inputs
  for (const input of props.inputs) {
    const displayName = input.displayName || input.id;
    const rawValue = formValues.value[input.id];

    if (input.required) {
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        errors.push(`请填写「${displayName}」`);
        continue;
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

  // 处理 triggers
  if (props.triggers.length > 0) {
    const triggersResult: Record<string, any> = {};
    for (const trigger of props.triggers) {
      triggersResult[trigger.id] = triggerValues.value[trigger.id];
    }
    result['_triggers'] = triggersResult;
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
}

function onJsonInput(inputId: string, e: Event) {
  const target = e.target as HTMLTextAreaElement;
  jsonInputs.value[inputId] = target.value;
}

function getPlaceholder(input: FlowInput): string {
  const name = input.displayName || input.id;
  switch (input.type) {
    case 'ARRAY':
      return '请输入 JSON 数组，如 [1, 2, 3]';
    case 'JSON':
      return '请输入 JSON 对象，如 {"key": "value"}';
    case 'INT':
    case 'FLOAT':
      return `请输入${name}`;
    default:
      return `请输入${name}`;
  }
}

function getTriggerTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    schedule: '定时调度',
    webhook: 'Webhook',
  };
  return labels[type] || type;
}

const hasArrayInputs = computed(
  () => props.inputs.some((i) => i.type === 'ARRAY'),
);
const hasJsonInputs = computed(
  () => props.inputs.some((i) => i.type === 'JSON'),
);

const hasInputs = computed(() => props.inputs.length > 0);
const hasTriggers = computed(() => props.triggers.length > 0);
const hasBoth = computed(() => hasInputs.value && hasTriggers.value);
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
    :body-style="{ maxHeight: '65vh', overflowY: 'auto' }"
    :width="hasBoth ? 480 : 400"
    @ok="handleConfirm"
    @cancel="handleCancel"
  >
    <template v-if="hasBoth">
      <Tabs v-model:active-key="activeTab" size="small">
        <TabPane v-if="hasInputs" key="inputs" tab="输入参数">
          <template v-if="hasArrayInputs || hasJsonInputs">
            <Alert
              type="info"
              show-icon
              message="提示"
              description="数组和 JSON 类型请输入合法的 JSON 格式内容"
              style="margin-bottom: 12px"
            />
          </template>
          <div class="form-grid">
            <div
              v-for="input in inputs"
              :key="input.id"
              class="form-item"
            >
              <div class="form-label">
                {{ input.displayName || input.id }}
                <span v-if="input.required" class="required">*</span>
              </div>
              <div class="form-control">
                <Input
                  v-if="input.type === 'STRING'"
                  v-model:value="formValues[input.id]"
                  :placeholder="getPlaceholder(input)"
                />
                <InputNumber
                  v-else-if="input.type === 'INT' || input.type === 'FLOAT'"
                  v-model:value="formValues[input.id]"
                  :step="input.type === 'INT' ? 1 : 0.01"
                  :precision="input.type === 'INT' ? 0 : 2"
                  style="width: 100%"
                  :placeholder="getPlaceholder(input)"
                />
                <Switch
                  v-else-if="input.type === 'BOOLEAN'"
                  v-model:checked="formValues[input.id]"
                  checked-children="是"
                  un-checked-children="否"
                />
                <template v-else-if="input.type === 'ARRAY'">
                  <Input.TextArea
                    :value="arrayInputs[input.id]"
                    :rows="3"
                    :placeholder="getPlaceholder(input)"
                    @input="onArrayInput(input.id, $event)"
                  />
                  <div class="form-hint">将以原生 JSON 数组形式传递</div>
                </template>
                <template v-else-if="input.type === 'JSON'">
                  <Input.TextArea
                    :value="jsonInputs[input.id]"
                    :rows="4"
                    :placeholder="getPlaceholder(input)"
                    @input="onJsonInput(input.id, $event)"
                  />
                  <div class="form-hint">将以原生对象形式传递</div>
                </template>
                <Input
                  v-else
                  v-model:value="formValues[input.id]"
                  :placeholder="getPlaceholder(input)"
                />
              </div>
            </div>
          </div>
        </TabPane>

        <TabPane v-if="hasTriggers" key="triggers" tab="触发器">
          <div class="trigger-list">
            <div
              v-for="trigger in triggers"
              :key="trigger.id"
              class="trigger-item"
            >
              <div class="trigger-header">
                <Tag :color="trigger.type === 'schedule' ? 'blue' : trigger.type === 'webhook' ? 'green' : 'default'">
                  {{ getTriggerTypeLabel(trigger.type) }}
                </Tag>
                <span class="trigger-id">{{ trigger.id }}</span>
              </div>
              <div class="trigger-body">
                <div v-if="trigger.type === 'schedule'" class="trigger-info">
                  <span class="label">Cron 表达式：</span>
                  <span class="value">{{ trigger.cron || '-' }}</span>
                </div>
                <div v-else-if="trigger.type === 'webhook'" class="trigger-info">
                  <span class="label">Webhook Key：</span>
                  <span class="value">{{ trigger.key || '-' }}</span>
                </div>
                <div v-else class="trigger-info">
                  <span class="label">类型：</span>
                  <span class="value">{{ trigger.type }}</span>
                </div>
              </div>
              <div class="trigger-notice">
                <span class="notice-text">触发器已配置，将在运行时自动生效</span>
              </div>
            </div>
          </div>
        </TabPane>
      </Tabs>
    </template>

    <template v-else-if="hasInputs">
      <template v-if="hasArrayInputs || hasJsonInputs">
        <Alert
          type="info"
          show-icon
          message="提示"
          description="数组和 JSON 类型请输入合法的 JSON 格式内容"
          style="margin-bottom: 12px"
        />
      </template>
      <div class="form-grid">
        <div
          v-for="input in inputs"
          :key="input.id"
          class="form-item"
        >
          <div class="form-label">
            {{ input.displayName || input.id }}
            <span v-if="input.required" class="required">*</span>
          </div>
          <div class="form-control">
            <Input
              v-if="input.type === 'STRING'"
              v-model:value="formValues[input.id]"
              :placeholder="getPlaceholder(input)"
            />
            <InputNumber
              v-else-if="input.type === 'INT' || input.type === 'FLOAT'"
              v-model:value="formValues[input.id]"
              :step="input.type === 'INT' ? 1 : 0.01"
              :precision="input.type === 'INT' ? 0 : 2"
              style="width: 100%"
              :placeholder="getPlaceholder(input)"
            />
            <Switch
              v-else-if="input.type === 'BOOLEAN'"
              v-model:checked="formValues[input.id]"
              checked-children="是"
              un-checked-children="否"
            />
            <template v-else-if="input.type === 'ARRAY'">
              <Input.TextArea
                :value="arrayInputs[input.id]"
                :rows="3"
                :placeholder="getPlaceholder(input)"
                @input="onArrayInput(input.id, $event)"
              />
              <div class="form-hint">将以原生 JSON 数组形式传递</div>
            </template>
            <template v-else-if="input.type === 'JSON'">
              <Input.TextArea
                :value="jsonInputs[input.id]"
                :rows="4"
                :placeholder="getPlaceholder(input)"
                @input="onJsonInput(input.id, $event)"
              />
              <div class="form-hint">将以原生对象形式传递</div>
            </template>
            <Input
              v-else
              v-model:value="formValues[input.id]"
              :placeholder="getPlaceholder(input)"
            />
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="hasTriggers">
      <div class="trigger-list">
        <div
          v-for="trigger in triggers"
          :key="trigger.id"
          class="trigger-item"
        >
          <div class="trigger-header">
            <Tag :color="trigger.type === 'schedule' ? 'blue' : trigger.type === 'webhook' ? 'green' : 'default'">
              {{ getTriggerTypeLabel(trigger.type) }}
            </Tag>
            <span class="trigger-id">{{ trigger.id }}</span>
          </div>
          <div class="trigger-body">
            <div v-if="trigger.type === 'schedule'" class="trigger-info">
              <span class="label">Cron 表达式：</span>
              <span class="value">{{ trigger.cron || '-' }}</span>
            </div>
            <div v-else-if="trigger.type === 'webhook'" class="trigger-info">
              <span class="label">Webhook Key：</span>
              <span class="value">{{ trigger.key || '-' }}</span>
            </div>
            <div v-else class="trigger-info">
              <span class="label">类型：</span>
              <span class="value">{{ trigger.type }}</span>
            </div>
          </div>
          <div class="trigger-notice">
            <span class="notice-text">触发器已配置，将在运行时自动生效</span>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.85);
  font-weight: 500;
  line-height: 1.4;
}

.form-label .required {
  color: #ff4d4f;
  margin-left: 2px;
}

.form-hint {
  color: #8c8c8c;
  font-size: 12px;
  margin-top: 4px;
}

.trigger-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.trigger-item {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
}

.trigger-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.trigger-id {
  font-size: 13px;
  color: #6b7280;
  font-family: monospace;
}

.trigger-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trigger-info {
  display: flex;
  align-items: center;
  font-size: 13px;
}

.trigger-info .label {
  color: #6b7280;
  width: 100px;
  flex-shrink: 0;
}

.trigger-info .value {
  color: #374151;
  font-family: monospace;
}

.trigger-notice {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e5e7eb;
}

.notice-text {
  font-size: 12px;
  color: #9ca3af;
}
</style>
