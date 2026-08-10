<script lang="ts" setup>
import { computed } from 'vue';
import { Button, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
  pluginGroups: any[];
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const emit = defineEmits<{
  (e: 'openNodeSelectModal', fieldKey: string): void;
  (e: 'editChildNode', fieldKey: string, index: number): void;
  (e: 'removeArrayItem', fieldKey: string, index: number): void;
}>();
</script>

<template>
  <div class="field-renderer">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
      <label style="font-size: 14px; font-weight: 500; color: #374151;">
        {{ field.props.label }}
        <span v-if="field.props.required" style="color: #ef4444; margin-left: 4px;">*</span>
      </label>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span v-if="field.props.fieldType" style="font-size: 12px; color: #9ca3af;">{{ field.props.fieldType }}</span>
        <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
          <span class="help-icon-wrapper">
            <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; pointer-events: none;" />
          </span>
        </Tooltip>
      </div>
    </div>
    <div style="padding: 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 12px; color: #6b7280;">{{ field.props.label }} ({{ nodeConfigForm[fieldKey]?.length || 0 }})</span>
        <Button type="text" size="small" @click="emit('openNodeSelectModal', fieldKey)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加节点
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div v-for="(item, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-node-' + (index as number)" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; font-weight: 500; color: #4b5563;">第 {{ (index as number) + 1 }} 项</span>
            <span style="font-size: 14px; color: #2563eb;">
              {{ pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === item.type)?.nodeName || item.type }}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <Button type="text" @click="emit('editChildNode', fieldKey, index as number)">
              <IconifyIcon icon="mdi:pencil" :size="14" />
            </Button>
            <Button type="text" @click="emit('removeArrayItem', fieldKey, index as number)" danger>
              <IconifyIcon icon="mdi:close" :size="14" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help-icon-wrapper {
  display: inline-flex;
  align-items: center;
}
</style>
