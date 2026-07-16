<script lang="ts" setup>
import { computed } from 'vue';
import { Select, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);
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
    <Select
      v-model:value="nodeConfigForm[fieldKey]"
      :placeholder="field.props.placeholder"
      style="width: 100%;"
    >
      <option v-for="opt in field.props.options" :key="opt" :value="opt">{{ opt }}</option>
    </Select>
  </div>
</template>