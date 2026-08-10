<script lang="ts" setup>
import { computed } from 'vue';
import { Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import FieldRenderer from '../FieldRenderer.vue';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
  pluginGroups: any[];
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const emit = defineEmits<{
  (e: 'addObjectItem', fieldKey: string): void;
  (e: 'updateObjectKey', fieldKey: string, index: number, value: string): void;
  (e: 'updateObjectValue', fieldKey: string, index: number, value: string): void;
  (e: 'removeObjectItem', fieldKey: string, index: number): void;
  (e: 'addStringArrayItem', fieldKey: string): void;
  (e: 'addNumberArrayItem', fieldKey: string): void;
  (e: 'addArrayItem', fieldKey: string, itemsSchema: any): void;
  (e: 'removeArrayItem', fieldKey: string, index: number): void;
  (e: 'updateArrayItemValue', fieldKey: string, index: number, itemKey: string, value: any): void;
  (e: 'openNodeSelectModal', fieldKey: string): void;
  (e: 'editChildNode', fieldKey: string, index: number): void;
}>();

function getNestedValue(parentKey: string): Record<string, any> {
  if (!props.nodeConfigForm[parentKey]) {
    props.nodeConfigForm[parentKey] = {};
  }
  return props.nodeConfigForm[parentKey];
}

function addObjectItemTo(parentKey: string, subKey: string) {
  const obj = getNestedValue(parentKey);
  const cur = obj[subKey] || [];
  obj[subKey] = [...cur, { key: '', value: '' }];
}

function updateObjectKeyAt(parentKey: string, subKey: string, index: number, val: string) {
  const obj = getNestedValue(parentKey);
  const cur = obj[subKey] || [];
  if (cur[index]) cur[index].key = val;
  obj[subKey] = [...cur];
}

function updateObjectValueAt(parentKey: string, subKey: string, index: number, val: string) {
  const obj = getNestedValue(parentKey);
  const cur = obj[subKey] || [];
  if (cur[index]) cur[index].value = val;
  obj[subKey] = [...cur];
}

function removeObjectItemAt(parentKey: string, subKey: string, index: number) {
  const obj = getNestedValue(parentKey);
  const cur = obj[subKey] || [];
  obj[subKey] = cur.filter((_: any, i: number) => i !== index);
}

function addStringArrayItemTo(parentKey: string, subKey: string) {
  const obj = getNestedValue(parentKey);
  const cur = obj[subKey] || [];
  obj[subKey] = [...cur, ''];
}

function addNumberArrayItemTo(parentKey: string, subKey: string) {
  const obj = getNestedValue(parentKey);
  const cur = obj[subKey] || [];
  obj[subKey] = [...cur, 0];
}

function addArrayItemTo(parentKey: string, subKey: string, itemsSchema: any) {
  const obj = getNestedValue(parentKey);
  const cur = obj[subKey] || [];
  if (itemsSchema && itemsSchema.$ref) {
    obj[subKey] = [...cur, { type: '' }];
  } else if (itemsSchema && itemsSchema.properties) {
    const newItem: Record<string, any> = {};
    Object.keys(itemsSchema.properties).forEach((pk: string) => {
      newItem[pk] = itemsSchema.properties[pk].type === 'boolean' ? false : '';
    });
    obj[subKey] = [...cur, newItem];
  } else {
    obj[subKey] = [...cur, {}];
  }
}

function removeArrayItemAt(parentKey: string, subKey: string, index: number) {
  const obj = getNestedValue(parentKey);
  const cur = obj[subKey] || [];
  obj[subKey] = cur.filter((_: any, i: number) => i !== index);
}

function updateArrayItemValueAt(parentKey: string, subKey: string, index: number, itemKey: string, val: any) {
  const obj = getNestedValue(parentKey);
  const cur = obj[subKey] || [];
  if (cur[index]) cur[index][itemKey] = val;
  obj[subKey] = [...cur];
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
        <span v-if="field.props.fieldType" style="font-size: 12px; color: #9ca3af;">{{ field.props.fieldType }}</span>
        <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
          <span class="help-icon-wrapper">
            <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; pointer-events: none;" />
          </span>
        </Tooltip>
      </div>
    </div>
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div v-for="subField in field.props.subFields" :key="subField.props.key" style="border-left: 2px solid #d1d5db; padding-left: 12px;">
          <FieldRenderer
            :field="subField"
            :node-config-form="getNestedValue(fieldKey)"
            :plugin-groups="pluginGroups"
            @add-object-item="(fk: string) => addObjectItemTo(fieldKey, fk)"
            @update-object-key="(fk: string, idx: number, val: string) => updateObjectKeyAt(fieldKey, fk, idx, val)"
            @update-object-value="(fk: string, idx: number, val: string) => updateObjectValueAt(fieldKey, fk, idx, val)"
            @remove-object-item="(fk: string, idx: number) => removeObjectItemAt(fieldKey, fk, idx)"
            @add-string-array-item="(fk: string) => addStringArrayItemTo(fieldKey, fk)"
            @add-number-array-item="(fk: string) => addNumberArrayItemTo(fieldKey, fk)"
            @add-array-item="(fk: string, schema: any) => addArrayItemTo(fieldKey, fk, schema)"
            @remove-array-item="(fk: string, idx: number) => removeArrayItemAt(fieldKey, fk, idx)"
            @update-array-item-value="(fk: string, idx: number, pk: string, val: any) => updateArrayItemValueAt(fieldKey, fk, idx, pk, val)"
            @open-node-select-modal="(fk: string) => emit('openNodeSelectModal', fieldKey + '.' + fk)"
            @edit-child-node="(fk: string, idx: number) => emit('editChildNode', fieldKey + '.' + fk, idx)"
          />
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
