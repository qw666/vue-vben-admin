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
  Textarea,
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

function toggleExpand(index: number) {
  if (expandedTriggers.value.has(index)) {
    expandedTriggers.value.delete(index);
  } else {
    expandedTriggers.value.add(index);
  }
  expandedTriggers.value = new Set(expandedTriggers.value);
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
          <IconifyIcon
            icon="mdi:help-circle"
            :size="14"
            style="color: #9ca3af"
          />
        </Tooltip>
      </div>
    </div>
    <div style=" padding: 12px;background: #f9fafb; border-radius: 8px">
      <div
        style="
          display: flex;
          align-items: center;
          justify-content: flex-end;
          margin-bottom: 8px;
        "
      >
        <Button type="text" size="small" @click="addTriggersItem">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加触发器
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px">
        <div
          v-for="(trigger, index) in nodeConfigForm[fieldKey] || []"
          :key="`${fieldKey }-trigger-${ index}`"
          style="
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 8px;
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
            style="display: flex; flex-direction: column; gap: 4px;"
          >
            <div style="display: flex; gap: 6px; align-items: center">
              <span style=" width: 40px;font-size: 11px; color: #9ca3af">id</span>
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
            <div style="display: flex; gap: 6px; align-items: center">
              <span style=" width: 40px;font-size: 11px; color: #9ca3af">类型</span>
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
            <div v-if="trigger.type === 'idp_core_trigger_Schedule'" style="margin-top: 4px">
              <div style="padding: 8px; background: #f9fafb; border-radius: 4px;">
                <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">
                  定时调度配置
                </div>
                <CronField
                  :model-value="trigger.cron"
                  @update:model-value="(val: string) => updateField(index as number, 'cron', val)"
                />
              </div>
            </div>
            <div v-else-if="trigger.type" style="margin-top: 4px">
              <Spin v-if="loadingMeta[trigger.type]" tip="加载中..." style="display: block; margin: 16px auto;">
              </Spin>
              <template v-else-if="triggerMetaCache[trigger.type]">
                <div style="padding: 8px; background: #f9fafb; border-radius: 4px;">
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">
                    {{ triggerMetaCache[trigger.type].nodeName || trigger.type }} 配置
                  </div>
                  <div v-if="triggerMetaCache[trigger.type].formProperties" style="display: flex; flex-direction: column; gap: 6px;">
                    <div
                        v-for="(propSchema, propKey) in triggerMetaCache[trigger.type].formProperties"
                        :key="propKey"
                        style="display: flex; gap: 6px; align-items: center;"
                      >
                        <template v-if="propKey !== 'id' && propKey !== 'type'">
                      <span style="width: 80px; font-size: 11px; color: #9ca3af;">{{ propSchema.title || propKey }}</span>
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
                        <Textarea
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
                          :placeholder="`输入 ${propKey}`"
                          style="flex: 1; min-height: 60px"
                          size="small"
                        />
                      </template>
                      <template v-else>
                        <Input
                          :value="trigger[propKey]"
                          @input="
                            (e: any) => updateField(index as number, propKey, e.target.value)
                          "
                          :placeholder="`输入 ${propKey}`"
                          style="flex: 1"
                          size="small"
                        />
                      </template>
                        </template>
                    </div>
                  </div>
                  <div v-else style="padding: 8px; color: #9ca3af; font-size: 12px;">
                    该触发器类型暂无配置项
                  </div>
                </div>
              </template>
              <div v-else style="padding: 8px; color: #9ca3af; font-size: 12px;">
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
