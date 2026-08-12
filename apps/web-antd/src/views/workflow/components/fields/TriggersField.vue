<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select';

import { computed, ref, watch, onMounted, nextTick, markRaw } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  Select,
  Spin,
  Switch,
  Tooltip,
} from 'ant-design-vue';

import { usePluginMeta } from '../../composables/usePluginMeta';
import {
  registerTriggerConfig,
  getAllTriggerConfigs,
  getTriggerConfig,
  isFrontendTrigger,
} from '../triggers';
import ScheduleConfig from '../triggers/ScheduleConfig.vue';
import DynamicConfig from '../triggers/DynamicConfig.vue';

registerTriggerConfig({
  type: 'idp_core_trigger_Schedule',
  label: '定时调度',
  component: markRaw(ScheduleConfig),
});

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

const usedTypes = computed(() => {
  const triggers = props.nodeConfigForm[fieldKey.value] || [];
  return new Set(triggers.map((t: any) => t.type).filter(Boolean));
});

const triggerOptions = computed(() => {
  const options: { value: string; label: string }[] = [];

  const frontendConfigs = getAllTriggerConfigs();
  for (const config of frontendConfigs) {
    options.push({
      value: config.type,
      label: config.label,
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

const loadingMeta = ref<Record<string, boolean>>({});
const triggerMetaCache = ref<Record<string, any>>({});

let keyCounter = 0;
const triggerKeyMap = ref<Map<number, string>>(new Map());

function getKeyForIndex(index: number): string {
  if (!triggerKeyMap.value.has(index)) {
    triggerKeyMap.value.set(index, `tk-${keyCounter++}`);
  }
  return triggerKeyMap.value.get(index)!;
}

const expandedTriggers = ref<Set<string>>(new Set());
const manuallyCollapsed = ref<Set<string>>(new Set());

function isExpanded(index: number): boolean {
  return expandedTriggers.value.has(getKeyForIndex(index));
}

function toggleExpand(index: number) {
  const key = getKeyForIndex(index);
  const newSet = new Set(expandedTriggers.value);
  const newCollapsed = new Set(manuallyCollapsed.value);
  if (newSet.has(key)) {
    newSet.delete(key);
    newCollapsed.add(key);
  } else {
    newSet.add(key);
    newCollapsed.delete(key);
  }
  expandedTriggers.value = newSet;
  manuallyCollapsed.value = newCollapsed;
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
    const newExpanded = new Set(expandedTriggers.value);
    for (let i = 0; i < triggers.length; i++) {
      const trigger = triggers[i];
      const keyStr = getKeyForIndex(i);
      if (trigger.type && !manuallyCollapsed.value.has(keyStr)) {
        newExpanded.add(keyStr);
      }
      if (trigger.type && !isFrontendTrigger(trigger.type) && !triggerMetaCache.value[trigger.type]) {
        loadTriggerMeta(trigger.type);
      }
    }
    expandedTriggers.value = newExpanded;
  }
}, { immediate: true });

onMounted(() => {
  if (!pluginGroupsCache.value['trigger'] || pluginGroupsCache.value['trigger'].length === 0) {
    loadPlugins('trigger');
  }
});

function addTriggersItem() {
  emit('addTriggersItem', fieldKey.value);
  nextTick(() => {
    const triggers = props.nodeConfigForm[fieldKey.value] || [];
    if (triggers.length > 0) {
      const lastIndex = triggers.length - 1;
      const keyStr = getKeyForIndex(lastIndex);
      const newSet = new Set(expandedTriggers.value);
      newSet.add(keyStr);
      expandedTriggers.value = newSet;
      const newCollapsed = new Set(manuallyCollapsed.value);
      newCollapsed.delete(keyStr);
      manuallyCollapsed.value = newCollapsed;
    }
  });
}

function updateField(index: number, key: string, value: any) {
  emit('updateTriggersField', fieldKey.value, index, key, value);
  if (key === 'type' && value) {
    loadTriggerMeta(value);
    if (value === 'idp_core_trigger_Schedule') {
      emit('updateTriggersField', fieldKey.value, index, 'withSeconds', false);
    }
  }
}

function removeField(index: number) {
  emit('removeTriggersItem', fieldKey.value, index);
  const newMap = new Map<number, string>();
  const newExpanded = new Set(expandedTriggers.value);
  const newCollapsed = new Set(manuallyCollapsed.value);
  // Remove the deleted trigger's key from tracking sets
  const removedKey = triggerKeyMap.value.get(index);
  if (removedKey) {
    newExpanded.delete(removedKey);
    newCollapsed.delete(removedKey);
  }
  // Rebuild the index-to-key mapping (shift indices down)
  for (const [idx, key] of triggerKeyMap.value) {
    if (idx < index) {
      newMap.set(idx, key);
    } else if (idx > index) {
      newMap.set(idx - 1, key);
    }
  }
  triggerKeyMap.value = newMap;
  expandedTriggers.value = newExpanded;
  manuallyCollapsed.value = newCollapsed;
}

function getConfigComponent(type: string) {
  const config = getTriggerConfig(type);
  if (config) {
    return config.component;
  }
  return DynamicConfig;
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
        <Tooltip v-if="usedTypes.size >= triggerOptions.length" title="所有触发器类型已配置完毕">
          <Button type="text" size="small" :disabled="usedTypes.size >= triggerOptions.length" @click="addTriggersItem">
            <IconifyIcon icon="mdi:plus" :size="14" /> 添加触发器
          </Button>
        </Tooltip>
        <Button v-else type="text" size="small" @click="addTriggersItem">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加触发器
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div
          v-for="(trigger, index) in nodeConfigForm[fieldKey] || []"
          :key="`${fieldKey}-trigger-${getKeyForIndex(index)}`"
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
              :icon="isExpanded(index as number) ? 'mdi:chevron-down' : 'mdi:chevron-right'"
              :size="12"
              style="color: #9ca3af"
            />
            <span style="font-size: 12px; font-weight: 500; color: #6b7280">触发器 {{ (index as number) + 1 }}</span>
            <div style="margin-left: auto; display: flex; gap: 8px; align-items: center;">
              <Switch
                :checked="!trigger.disabled"
                @change="(val: boolean) => updateField(index as number, 'disabled', !val)"
                size="small"
              />
              <Button
                type="text"
                size="small"
                @click.stop="removeField(index as number)"
                danger
              >
                <IconifyIcon icon="mdi:close" :size="12" />
              </Button>
            </div>
          </div>
          <div
            v-show="isExpanded(index as number)"
            style="display: flex; flex-direction: column; gap: 10px;"
          >
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="display: flex; align-items: center; width: 80px;">
                <span style="font-size: 12px; color: #6b7280;">标识</span>
                <Tooltip :title="'触发器的唯一标识，用于在流程中引用'">
                  <span class="help-icon-wrapper">
                    <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; cursor: pointer; margin-left: 4px; pointer-events: none;" />
                  </span>
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
                  <span class="help-icon-wrapper">
                    <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; cursor: pointer; margin-left: 4px; pointer-events: none;" />
                  </span>
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
                  :disabled="usedTypes.has(option.value) && option.value !== trigger.type"
                >
{{ option.label }}
                </Select.Option>
              </Select>
            </div>
            <div v-if="trigger.type" style="min-height: 60px;">
              <Spin v-if="!isFrontendTrigger(trigger.type) && loadingMeta[trigger.type]" tip="加载中..." style="display: block; margin: 16px auto;">
              </Spin>
              <component
                v-else
                :is="getConfigComponent(trigger.type)"
                :trigger="trigger"
                :schema="triggerMetaCache[trigger.type]?.formProperties"
                @update-field="(key: string, value: any) => updateField(index as number, key, value)"
              />
            </div>
            <div v-else style="padding: 10px; color: #9ca3af; font-size: 12px; min-height: 40px;">
              选择触发器类型以加载配置表单
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
