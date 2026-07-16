<script lang="ts" setup>
import { computed } from 'vue';
import { Button, InputNumber, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const emit = defineEmits<{
  (e: 'addNumberArrayItem', fieldKey: string): void;
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
        <span v-if="field.props.fieldType" style="font-size: 12px; padding: 2px 8px; background: #f3f4f6; color: #4b5563; border-radius: 4px;">{{ field.props.fieldType }}</span>
        <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
          <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af;" />
        </Tooltip>
      </div>
    </div>
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 12px; color: #6b7280;">{{ field.props.label }} ({{ nodeConfigForm[fieldKey]?.length || 0 }})</span>
        <Button type="text" size="small" @click="emit('addNumberArrayItem', fieldKey)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div v-for="(_, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-number-' + (index as number)" style="display: flex; align-items: center; gap: 8px;">
          <InputNumber
            v-model:value="nodeConfigForm[fieldKey][index as number]"
            :placeholder="'请输入'"
            style="flex: 1;"
            size="small"
            :controls="true"
            :controls-position="'both'"
          />
          <Button type="text" size="small" @click="emit('removeArrayItem', fieldKey, index as number)" danger>
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
