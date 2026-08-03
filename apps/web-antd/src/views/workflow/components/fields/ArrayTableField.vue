<script lang="ts" setup>
import { computed } from 'vue';
import { Button, InputNumber, Select, Switch, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import VarPicker from './VarPicker.vue';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const emit = defineEmits<{
  (e: 'addArrayItem', fieldKey: string, itemsSchema: any): void;
  (e: 'removeArrayItem', fieldKey: string, index: number): void;
  (e: 'updateArrayItemValue', fieldKey: string, index: number, itemKey: string, value: any): void;
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
          <span class="help-icon-wrapper">
            <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; pointer-events: none;" />
          </span>
        </Tooltip>
      </div>
    </div>
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 12px; color: #6b7280;">{{ field.props.label }} ({{ nodeConfigForm[fieldKey]?.length || 0 }})</span>
        <Button type="text" size="small" @click="emit('addArrayItem', fieldKey, field.props.itemsSchema)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div v-for="(_, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-array-' + (index as number)" style="background: white; border-radius: 8px; padding: 12px; border: 1px solid #e5e7eb;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 500; color: #4b5563;">第 {{ (index as number) + 1 }} 项</span>
            <Button type="text" size="small" @click="emit('removeArrayItem', fieldKey, index as number)" danger>
              <IconifyIcon icon="mdi:close" :size="14" />
            </Button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div v-for="(prop, propKey) in (field.props.itemsSchema?.properties || {})" :key="propKey">
              <label style="font-size: 12px; color: #6b7280;">{{ prop.title || propKey }}<span v-if="prop.$required" style="color: #ef4444; margin-left: 4px;">*</span></label>
              <VarPicker
                v-if="prop.type === 'string'"
                :value="nodeConfigForm[fieldKey][index as number][propKey]"
                @update:value="(val: string) => emit('updateArrayItemValue', fieldKey, index as number, propKey as string, val)"
                :placeholder="prop.description || '输入 / 选择变量'"
                :disabled="prop.$dynamic === false"
                size="small"
                style="width: 100%;"
              />
              <InputNumber
                v-else-if="prop.type === 'number' || prop.type === 'integer'"
                :value="nodeConfigForm[fieldKey][index as number][propKey]"
                @input="(val: any) => emit('updateArrayItemValue', fieldKey, index as number, propKey as string, val)"
                :min="prop.minimum"
                style="width: 100%;"
                size="small"
              />
              <Select
                v-else-if="prop.enum"
                :value="nodeConfigForm[fieldKey][index as number][propKey]"
                @change="(val: any) => emit('updateArrayItemValue', fieldKey, index as number, propKey as string, val)"
                style="width: 100%;"
                size="small"
              >
                <option v-for="opt in prop.enum" :key="opt" :value="opt">{{ opt }}</option>
              </Select>
              <Switch
                v-else-if="prop.type === 'boolean'"
                :checked="nodeConfigForm[fieldKey][index as number][propKey]"
                @change="(val: any) => emit('updateArrayItemValue', fieldKey, index as number, propKey as string, val)"
              />
            </div>
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
