<script lang="ts" setup>
import { computed } from 'vue';
import { Button, Input, Select, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const emit = defineEmits<{
  (e: 'addOnResumeItem', fieldKey: string): void;
  (e: 'updateOnResumeField', fieldKey: string, index: number, key: string, value: any): void;
  (e: 'removeOnResumeItem', fieldKey: string, index: number): void;
}>();

const inputTypes = [
  { value: 'STRING', label: 'STRING' },
  { value: 'BOOLEAN', label: 'BOOLEAN' },
  { value: 'INT', label: 'INT' },
  { value: 'LONG', label: 'LONG' },
  { value: 'FLOAT', label: 'FLOAT' },
  { value: 'DOUBLE', label: 'DOUBLE' },
  { value: 'DATE', label: 'DATE' },
  { value: 'DATETIME', label: 'DATETIME' },
  { value: 'URI', label: 'URI' },
  { value: 'ARRAY', label: 'ARRAY' },
];

function addOnResumeItem() {
  emit('addOnResumeItem', fieldKey.value);
}

function updateField(index: number, key: string, value: any) {
  emit('updateOnResumeField', fieldKey.value, index, key, value);
}

function removeField(index: number) {
  emit('removeOnResumeItem', fieldKey.value, index);
}
</script>

<template>
  <div class="field-renderer">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
      <label style="font-size: 14px; font-weight: 500; color: #374151;">
        {{ field.props.label }}
        <span v-if="field.props.required" style="color: #ef4444; margin-left: 4px;">*</span>
      </label>
      <div style="display: flex; align-items: center; gap: 8px;">
        <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
          <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af;" />
        </Tooltip>
      </div>
    </div>
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
      <div style="display: flex; align-items: center; justify-content: flex-end; margin-bottom: 8px;">
        <Button type="text" size="small" @click="addOnResumeItem">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加输入字段
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div v-for="(item, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-onresume-' + index" 
             style="display: flex; flex-direction: column; gap: 6px; padding: 8px; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; font-weight: 500; color: #6b7280;">字段 {{ index + 1 }}</span>
            <Button type="text" size="small" @click="removeField(index)" danger>
              <IconifyIcon icon="mdi:close" :size="12" />
            </Button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; color: #9ca3af; width: 36px;">id</span>
              <Input
                :value="item.id"
                @input="(e: any) => updateField(index, 'id', e.target.value)"
                :placeholder="'字段标识'"
                style="flex: 1;"
                size="small"
              />
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; color: #9ca3af; width: 36px;">type</span>
              <Select
                :value="item.type"
                @change="(val: any) => updateField(index, 'type', val)"
                style="flex: 1;"
                size="small"
              >
                <Select.Option v-for="t in inputTypes" :key="t.value" :value="t.value">{{ t.label }}</Select.Option>
              </Select>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; color: #9ca3af; width: 36px;">描述</span>
              <Input
                :value="item.description"
                @input="(e: any) => updateField(index, 'description', e.target.value)"
                :placeholder="'字段描述'"
                style="flex: 1;"
                size="small"
              />
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; color: #9ca3af; width: 36px;">默认</span>
              <Input
                :value="item.defaults"
                @input="(e: any) => updateField(index, 'defaults', e.target.value)"
                :placeholder="'默认值'"
                style="flex: 1;"
                size="small"
              />
            </div>
          </div>
        </div>
        <div v-if="(nodeConfigForm[fieldKey] || []).length === 0" style="font-size: 12px; color: #9ca3af; padding: 16px 0; text-align: center;">
          点击上方按钮添加恢复时需要填写的输入字段
        </div>
      </div>
    </div>
  </div>
</template>
