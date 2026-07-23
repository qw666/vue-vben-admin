<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select';

import { computed, ref, watch, onMounted } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  InputNumber,
  Select,
  Spin,
  Switch,
  Tooltip,
} from 'ant-design-vue';

import { usePluginMeta } from '../../composables/usePluginMeta';
import CronField from './CronField.vue';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'addTriggersItem', fieldKey: string): void;
  (e: 'updateTriggersField', fieldKey: string, index: number, key: string, value: any): void;
  (e: 'removeTriggersItem', fieldKey: string, index: number): void;
}>();

const { pluginGroupsCache, loadPlugins, loadPluginMeta } = usePluginMeta();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const frontendTriggers = [
  {
    type: 'idp_core_trigger_Schedule',
    label: '定时调度',
  },
  {
    type: 'idp_core_trigger_Webhook',
    label: 'Webhook',
  },
];

const triggerOptions = computed(() => {
  const options: {
    value: string;
    label: string;
  }[] = [];

  for (const ft of frontendTriggers) {
    options.push({
      value: ft.type,
      label: ft.label,
    });
  }

  const groups = pluginGroupsCache.value['trigger'] || [];
  for (const group of groups) {
    for (const plugin of group.pluginList || []) {
      const exists = options.some((o) => o.value === plugin.type);
      if (!exists) {
        options.push({
          value: plugin.type,
          label: plugin.nodeName || plugin.type,
        });
      }
    }
  }
  return options;
});

function isFrontendTrigger(type: string) {
  return frontendTriggers.some((t) => t.type === type);
}

const loadingMeta = ref<Record<string, boolean>>({});
const triggerMetaCache = ref<Record<string, any>>({});
const expandedTriggers = ref<Set<number>>(new Set());

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

const webhookFieldLabels: Record<string, { label: string; tooltip: string }> = {
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

const dynamicFieldLabels: Record<string, { label: string; tooltip: string }> = {
  cron: {
    label: 'Cron 表达式',
    tooltip: '定时调度的 Cron 表达式，格式为：分 时 日 月 周',
  },
  key: {
    label: '密钥',
    tooltip: 'Webhook 触发器的唯一密钥，用于生成安全的回调 URL。',
  },
  wait: {
    label: '等待完成',
    tooltip: '是否等待流程执行完成后再返回响应。',
  },
  returnOutputs: {
    label: '返回输出',
    tooltip: '是否将流程输出作为响应返回给调用方。',
  },
  allowConcurrent: {
    label: '允许并发',
    tooltip: '是否允许同时运行多个流程实例。',
  },
  responseCode: {
    label: '响应状态码',
    tooltip: '自定义 HTTP 响应状态码。',
  },
  responseContentType: {
    label: '响应内容类型',
    tooltip: '自定义响应的 Content-Type。',
  },
  stopAfter: {
    label: '停止状态',
    tooltip: '当流程达到指定状态时停止触发器。',
  },
};

function toggleExpand(index: number) {
  if (expandedTriggers.value.has(index)) {
    expandedTriggers.value.delete(index);
  } else {
    expandedTriggers.value.add(index);
  }
  expandedTriggers.value = new Set(expandedTriggers.value);
}

function generateRandomKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

async function loadTriggerMeta(triggerType: string) {
  if (isFrontendTrigger(triggerType)) return;
  if (triggerMetaCache.value[triggerType])
    return triggerMetaCache.value[triggerType];
  if (loadingMeta.value[triggerType])
    return null;
  loadingMeta.value[triggerType] = true;
  try {
    const meta = await loadPluginMeta(triggerType);
    if (meta) {
      triggerMetaCache.value[triggerType] = meta;
      return meta;
    }
  }
  catch (error) {
    console.error('Failed to load trigger meta:', error);
  }
  finally {
    loadingMeta.value[triggerType] = false;
  }
  return null;
}

watch(() => props.nodeConfigForm[fieldKey.value], (triggers) => {
  if (triggers && Array.isArray(triggers)) {
    for (const trigger of triggers) {
      if (trigger.type && !isFrontendTrigger(trigger.type) && !triggerMetaCache.value[trigger.type]) {
        loadTriggerMeta(trigger.type);
      }
    }
  }
}, { immediate: true });

onMounted(() => {
  if (!pluginGroupsCache.value['trigger'] || pluginGroupsCache.value['trigger'].length === 0) {
    loadPlugins('trigger');
  }
});

function addTriggersItem() {
  emit('addTriggersItem', fieldKey.value);
}

function updateField(index: number, key: string, value: any) {
  emit('updateTriggersField', fieldKey.value, index, key, value);
  if (key === 'type' && value) {
    loadTriggerMeta(value);
  }
}

function removeField(index: number) {
  emit('removeTriggersItem', fieldKey.value, index);
}

function getFieldControlType(type: string): string {
  if (type === 'boolean') return 'switch';
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'string') return 'input';
  return 'input';
}

function getEnumOptions(enumValues: string[]): { value: string; label: string }[] {
  return enumValues.map(value => ({ value, label: value }));
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
        <Button type="text" size="small" @click="addTriggersItem">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加触发器
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div
          v-for="(trigger, index) in nodeConfigForm[fieldKey] || []"
          :key="`${fieldKey }-trigger-${ index}`"
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
          <div style="display: flex; gap: 8px; align-items: center; cursor: pointer;" @click="toggleExpand(index as number)">
            <IconifyIcon
              :icon="expandedTriggers.has(index as number) ? 'mdi:chevron-down' : 'mdi:chevron-right'"
              :size="12"
              style="color: #9ca3af"
            />
            <span style="font-size: 12px; font-weight: 500; color: #6b7280">触发器 {{ (index as number) + 1 }}</span>
            <Button
              type="text"
              size="small"
              @click.stop="removeField(index as number)"
              danger
            >
              <IconifyIcon icon="mdi:close" :size="12" />
            </Button>
          </div>
          <div
            v-show="expandedTriggers.has(index as number)"
            style="display: flex; flex-direction: column; gap: 10px;"
          >
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="display: flex; align-items: center; width: 80px;">
                <span style="font-size: 12px; color: #6b7280;">标识</span>
                <Tooltip :title="'触发器的唯一标识，用于在流程中引用'">
                  <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                </Tooltip>
              </div>
              <Input
                :value="trigger.id"
                @input="
                  (e: any) => updateField(index as number, 'id', e.target.value)
                "
                placeholder="触发器标识"
                style="flex: 1"
                size="small"
              />
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="display: flex; align-items: center; width: 80px;">
                <span style="font-size: 12px; color: #6b7280;">类型</span>
                <Tooltip :title="'触发器类型，决定了触发流程的方式'">
                  <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                </Tooltip>
              </div>
              <Select
                :value="trigger.type"
                @change="
                  (val: SelectValue) =>
                    updateField(index as number, 'type', val)
                "
                style="flex: 1"
                size="small"
              >
                <Select.Option
                  v-for="option in triggerOptions"
                  :key="option.value"
                  :value="option.value"
                  >
{{ option.label }}
</Select.Option>
              </Select>
            </div>
            <div v-if="trigger.type === 'idp_core_trigger_Schedule'" style="margin-top: 4px;">
              <div style="padding: 12px; background: #f9fafb; border-radius: 4px;">
                <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 10px;">
                  定时调度配置
                </div>
                <CronField
                  :model-value="trigger.cron"
                  @update:model-value="(val: string) => updateField(index as number, 'cron', val)"
                />
              </div>
            </div>
            <div v-else-if="trigger.type === 'idp_core_trigger_Webhook'" style="margin-top: 4px;">
              <div style="padding: 12px; background: #f9fafb; border-radius: 4px;">
                <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 12px;">
                  Webhook 配置
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <div style="display: flex; align-items: center; width: 80px;">
                      <span style="font-size: 12px; color: #6b7280;">{{ webhookFieldLabels.key.label }}</span>
                      <span style="color: #ef4444; margin-left: 2px;">*</span>
                      <Tooltip :title="webhookFieldLabels.key.tooltip">
                        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                      </Tooltip>
                    </div>
                    <Input
                      :value="trigger.key"
                      @input="(e: any) => updateField(index as number, 'key', e.target.value)"
                      placeholder="Webhook 密钥"
                      style="flex: 1"
                      size="small"
                    />
                    <Button
                      type="text"
                      size="small"
                      @click="updateField(index as number, 'key', generateRandomKey())"
                    >
                      生成
                    </Button>
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <div style="display: flex; align-items: center; width: 80px;">
                      <span style="font-size: 12px; color: #6b7280;">{{ webhookFieldLabels.allowConcurrent.label }}</span>
                      <Tooltip :title="webhookFieldLabels.allowConcurrent.tooltip">
                        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                      </Tooltip>
                    </div>
                    <Switch
                      :checked="trigger.allowConcurrent"
                      @change="(val: any) => updateField(index as number, 'allowConcurrent', val)"
                      size="small"
                    />
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <div style="display: flex; align-items: center; width: 80px;">
                      <span style="font-size: 12px; color: #6b7280;">{{ webhookFieldLabels.wait.label }}</span>
                      <Tooltip :title="webhookFieldLabels.wait.tooltip">
                        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                      </Tooltip>
                    </div>
                    <Switch
                      :checked="trigger.wait"
                      @change="(val: any) => updateField(index as number, 'wait', val)"
                      size="small"
                    />
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <div style="display: flex; align-items: center; width: 80px;">
                      <span style="font-size: 12px; color: #6b7280;">{{ webhookFieldLabels.returnOutputs.label }}</span>
                      <Tooltip :title="webhookFieldLabels.returnOutputs.tooltip">
                        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                      </Tooltip>
                    </div>
                    <Switch
                      :checked="trigger.returnOutputs"
                      @change="(val: any) => updateField(index as number, 'returnOutputs', val)"
                      size="small"
                    />
                  </div>
                  <div v-if="trigger.wait && trigger.returnOutputs" style="display: flex; gap: 8px; align-items: center;">
                    <div style="display: flex; align-items: center; width: 80px;">
                      <span style="font-size: 12px; color: #6b7280;">{{ webhookFieldLabels.responseCode.label }}</span>
                      <Tooltip :title="webhookFieldLabels.responseCode.tooltip">
                        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                      </Tooltip>
                    </div>
                    <InputNumber
                      :value="trigger.responseCode"
                      @change="(val: any) => updateField(index as number, 'responseCode', val)"
                      style="flex: 1"
                      size="small"
                    />
                  </div>
                  <div v-if="trigger.wait && trigger.returnOutputs" style="display: flex; gap: 8px; align-items: center;">
                    <div style="display: flex; align-items: center; width: 80px;">
                      <span style="font-size: 12px; color: #6b7280;">{{ webhookFieldLabels.responseContentType.label }}</span>
                      <Tooltip :title="webhookFieldLabels.responseContentType.tooltip">
                        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                      </Tooltip>
                    </div>
                    <Select
                      :value="trigger.responseContentType"
                      @change="(val: SelectValue) => updateField(index as number, 'responseContentType', val)"
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
                      <span style="font-size: 12px; color: #6b7280;">{{ webhookFieldLabels.stopAfter.label }}</span>
                      <Tooltip :title="webhookFieldLabels.stopAfter.tooltip">
                        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                      </Tooltip>
                    </div>
                    <Select
                      :value="trigger.stopAfter"
                      @change="(val: any) => updateField(index as number, 'stopAfter', val)"
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
            <div v-else-if="trigger.type" style="margin-top: 4px">
              <Spin v-if="loadingMeta[trigger.type]" tip="加载中..." style="display: block; margin: 16px auto;">
              </Spin>
              <template v-else-if="triggerMetaCache[trigger.type]">
                <div style="padding: 10px; background: #f9fafb; border-radius: 4px;">
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 10px;">
                    {{ triggerMetaCache[trigger.type].nodeName || trigger.type }} 配置
                  </div>
                  <div v-if="triggerMetaCache[trigger.type].formProperties" style="display: flex; flex-direction: column; gap: 10px;">
                    <div
                        v-for="(propSchema, propKey) in triggerMetaCache[trigger.type].formProperties"
                        :key="propKey"
                        style="display: flex; gap: 8px; align-items: center;"
                      >
                        <template v-if="propKey !== 'id' && propKey !== 'type' && propKey !== 'conditions' && propKey !== 'inputs' && propKey !== 'pluginDefaultsRef'">
                      <div style="display: flex; align-items: center; width: 80px;">
                        <span style="font-size: 12px; color: #6b7280;">{{ dynamicFieldLabels[propKey]?.label || propSchema.title || propKey }}</span>
                        <Tooltip v-if="dynamicFieldLabels[propKey]?.tooltip || propSchema.description" :title="dynamicFieldLabels[propKey]?.tooltip || propSchema.description">
                          <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af; cursor: pointer; margin-left: 4px;" />
                        </Tooltip>
                      </div>
                      <template v-if="propSchema.enum">
                        <Select
                          :value="trigger[propKey]"
                          @change="
                            (val: SelectValue) =>
                              updateField(index as number, propKey, val)
                          "
                          style="flex: 1"
                          size="small"
                        >
                          <Select.Option
                            v-for="opt in getEnumOptions(propSchema.enum)"
                            :key="opt.value"
                            :value="opt.value"
                            >
{{ opt.label }}
</Select.Option>
                        </Select>
                      </template>
                      <template v-else-if="getFieldControlType(propSchema.type) === 'switch'">
                        <Switch
                          :checked="trigger[propKey]"
                          @change="
                            (val: any) => updateField(index as number, propKey, val)
                          "
                          size="small"
                        />
                      </template>
                      <template v-else-if="getFieldControlType(propSchema.type) === 'number'">
                        <InputNumber
                          :value="trigger[propKey]"
                          @change="
                            (val: any) => updateField(index as number, propKey, val)
                          "
                          :step="propSchema.step || 1"
                          :min="propSchema.minimum"
                          :max="propSchema.maximum"
                          style="flex: 1"
                          size="small"
                        />
                      </template>
                      <template v-else-if="propSchema.type === 'object' || propSchema.type === 'array'">
                        <textarea
                          :value="typeof trigger[propKey] === 'object' ? JSON.stringify(trigger[propKey], null, 2) : trigger[propKey]"
                          @input="
                            (e: any) => {
                              try {
                                const val = JSON.parse(e.target.value);
                                updateField(index as number, propKey, val);
                              } catch {
                                updateField(index as number, propKey, e.target.value);
                              }
                            }
                          "
                          :placeholder="`输入 ${dynamicFieldLabels[propKey]?.label || propKey}`"
                          style="flex: 1; min-height: 60px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px;"
                        />
                      </template>
                      <template v-else>
                        <Input
                          :value="trigger[propKey]"
                          @input="
                            (e: any) => updateField(index as number, propKey, e.target.value)
                          "
                          :placeholder="`输入 ${dynamicFieldLabels[propKey]?.label || propKey}`"
                          style="flex: 1"
                          size="small"
                        />
                      </template>
                        </template>
                    </div>
                  </div>
                  <div v-else style="padding: 10px; color: #9ca3af; font-size: 12px;">
                    该触发器类型暂无配置项
                  </div>
                </div>
              </template>
              <div v-else style="padding: 10px; color: #9ca3af; font-size: 12px;">
                选择触发器类型以加载配置表单
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
          点击上方按钮添加触发器
        </div>
      </div>
    </div>
  </div>
</template>
