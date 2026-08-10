<script lang="ts" setup>
import { computed } from 'vue';
import { Button, Input, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import VarPicker from './VarPicker.vue';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const emit = defineEmits<{
  (e: 'addObjectItem', fieldKey: string): void;
  (e: 'updateObjectKey', fieldKey: string, index: number, value: string): void;
  (e: 'updateObjectValue', fieldKey: string, index: number, value: string): void;
  (e: 'removeObjectItem', fieldKey: string, index: number): void;
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
      <div style="display: flex; align-items: center; justify-content: flex-end; margin-bottom: 8px;">
        <Button type="text" @click="emit('addObjectItem', fieldKey)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div v-for="(entry, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-obj-' + (index as number)" style="display: flex; align-items: center; gap: 8px;">
          <Input
            :value="entry.key"
            @input="(e: any) => emit('updateObjectKey', fieldKey, index as number, e.target.value)"
            :placeholder="'Key'"
            style="width: 100px;"
          />
          <VarPicker
            :value="entry.value"
            @update:value="(val: string) => emit('updateObjectValue', fieldKey, index as number, val)"
            :placeholder="'输入 / 选择变量'"
            style="flex: 1; min-width: 0;"
          />
          <Button type="text" @click="emit('removeObjectItem', fieldKey, index as number)" danger>
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
        <div v-if="(nodeConfigForm[fieldKey] || []).length === 0" style="font-size: 12px; color: #9ca3af; padding: 8px 0;">
          {{ field.props.placeholder }}
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
