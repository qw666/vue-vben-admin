<script lang="ts" setup>
import { computed, watch } from 'vue';
import { Tooltip, Button } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import FieldRenderer from '../FieldRenderer.vue';
import { renderFormField } from '../../composables/useFormFieldResolver';

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

const selectedAnyOfOption = computed(() => {
  if (!props.field.props.options || props.nodeConfigForm[fieldKey.value] === undefined || props.nodeConfigForm[fieldKey.value] === null) return null;
  return props.field.props.options.find((opt: any) => opt.value === props.nodeConfigForm[fieldKey.value]);
});

/** 值存储 key（与选项索引分开存储） */
const valueKey = computed(() => fieldKey.value + '_value');

/** 动态创建的 renderedField（当选项没有 subFields 时） */
const renderedField = computed(() => {
  const option = selectedAnyOfOption.value;
  if (!option || option.subFields?.length) return null;
  const schema = option.schema;
  if (!schema?.type) return null;

  const vKey = valueKey.value;
  const isRequired = props.field.props.required;

  // 从正确位置读取值
  const value = props.nodeConfigForm[vKey];

  // onUpdate 写入到正确位置
  const onUpdate = (val: any) => {
    props.nodeConfigForm[vKey] = val;
  };

  // 创建字段，key 使用 vKey，这样 VarPicker 会从正确位置读写
  const field = renderFormField({ [vKey]: schema }, vKey, isRequired, {}, value, onUpdate, '');

  // 保持 label 为原始字段名
  field.props.label = props.field.props.label;

  return field;
});

function clearSelection() {
  props.nodeConfigForm[fieldKey.value] = null;
  // 清除对应的值
  delete props.nodeConfigForm[valueKey.value];
}

// 监听选项切换，清除旧数据
watch(selectedAnyOfOption, (newOption, oldOption) => {
  if (!newOption || !oldOption) return;
  // 选项切换时，清除旧的值数据
  delete props.nodeConfigForm[valueKey.value];
  delete props.nodeConfigForm[fieldKey.value + '_values'];
});

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

/** 针对 renderedField 路径的数组操作（直接在 nodeConfigForm[valueKey] 上操作） */
function addStringArrayItemDirect(key: string) {
  const cur = props.nodeConfigForm[key] || [];
  props.nodeConfigForm[key] = [...cur, ''];
}

function addNumberArrayItemDirect(key: string) {
  const cur = props.nodeConfigForm[key] || [];
  props.nodeConfigForm[key] = [...cur, 0];
}

function addArrayItemDirect(key: string, itemsSchema: any) {
  const cur = props.nodeConfigForm[key] || [];
  let newItem: any = {};
  if (itemsSchema && itemsSchema.$ref) {
    newItem = { type: '' };
  } else if (itemsSchema && itemsSchema.properties) {
    newItem = {};
    Object.keys(itemsSchema.properties).forEach((pk: string) => {
      newItem[pk] = itemsSchema.properties[pk].type === 'boolean' ? false : '';
    });
  }
  props.nodeConfigForm[key] = [...cur, newItem];
}

function removeArrayItemDirect(key: string, index: number) {
  const cur = props.nodeConfigForm[key] || [];
  props.nodeConfigForm[key] = cur.filter((_: any, i: number) => i !== index);
}

function updateArrayItemValueDirect(key: string, index: number, itemKey: string, val: any) {
  const cur = props.nodeConfigForm[key] || [];
  if (itemKey === '' || itemKey === undefined) {
    cur[index] = val;
  } else {
    if (cur[index]) cur[index][itemKey] = val;
  }
  props.nodeConfigForm[key] = [...cur];
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
        <span v-if="field.props.fieldType" style="font-size: 12px; padding: 2px 8px; background: #f3f4f6; color: #4b5563; border-radius: 4px;">{{ field.props.fieldType }}</span>
        <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
          <span class="help-icon-wrapper">
            <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; pointer-events: none;" />
          </span>
        </Tooltip>
      </div>
    </div>
    <div style="margin-top: 8px;">
      <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 12px;">
        <label
          v-for="option in field.props.options"
          :key="option.value"
          style="display: flex; align-items: center; gap: 8px; cursor: pointer;"
        >
          <input
            type="radio"
            :value="option.value"
            v-model="nodeConfigForm[fieldKey]"
            style="width: 16px; height: 16px; color: #2563eb;"
          />
          <span style="font-size: 14px; color: #374151;">{{ option.label }}</span>
        </label>
        <Button
          v-if="nodeConfigForm[fieldKey] !== undefined && nodeConfigForm[fieldKey] !== null"
          type="text"
          size="small"
          @click="clearSelection"
          style="color: #6b7280;"
        >
          <IconifyIcon icon="mdi:close" :size="14" />
        </Button>
      </div>
      <div v-if="selectedAnyOfOption?.subFields?.length" style="background: #f9fafb; border-radius: 8px; padding: 12px;">
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div v-for="subField in selectedAnyOfOption.subFields" :key="subField.props.key" style="border-left: 2px solid #d1d5db; padding-left: 12px;">
            <FieldRenderer
              :field="subField"
              :node-config-form="getNestedValue(fieldKey + '_values')"
              :plugin-groups="pluginGroups"
              @add-object-item="(fk: string) => addObjectItemTo(fieldKey + '_values', fk)"
              @update-object-key="(fk: string, idx: number, val: string) => updateObjectKeyAt(fieldKey + '_values', fk, idx, val)"
              @update-object-value="(fk: string, idx: number, val: string) => updateObjectValueAt(fieldKey + '_values', fk, idx, val)"
              @remove-object-item="(fk: string, idx: number) => removeObjectItemAt(fieldKey + '_values', fk, idx)"
              @add-string-array-item="(fk: string) => addStringArrayItemTo(fieldKey + '_values', fk)"
              @add-number-array-item="(fk: string) => addNumberArrayItemTo(fieldKey + '_values', fk)"
              @add-array-item="(fk: string, schema: any) => addArrayItemTo(fieldKey + '_values', fk, schema)"
              @remove-array-item="(fk: string, idx: number) => removeArrayItemAt(fieldKey + '_values', fk, idx)"
              @update-array-item-value="(fk: string, idx: number, pk: string, val: any) => updateArrayItemValueAt(fieldKey + '_values', fk, idx, pk, val)"
              @open-node-select-modal="(fk: string) => emit('openNodeSelectModal', fieldKey + '_values.' + fk)"
              @edit-child-node="(fk: string, idx: number) => emit('editChildNode', fieldKey + '_values.' + fk, idx)"
            />
          </div>
        </div>
      </div>
      <div v-else-if="renderedField" style="margin-top: 8px;">
        <FieldRenderer
          :field="renderedField"
          :node-config-form="nodeConfigForm"
          :plugin-groups="pluginGroups"
          @add-object-item="(fk: string) => addObjectItemTo(fieldKey + '_value', fk)"
          @update-object-key="(fk: string, idx: number, val: string) => updateObjectKeyAt(fieldKey + '_value', fk, idx, val)"
          @update-object-value="(fk: string, idx: number, val: string) => updateObjectValueAt(fieldKey + '_value', fk, idx, val)"
          @remove-object-item="(fk: string, idx: number) => removeObjectItemAt(fieldKey + '_value', fk, idx)"
          @add-string-array-item="(fk: string) => addStringArrayItemDirect(fk)"
          @add-number-array-item="(fk: string) => addNumberArrayItemDirect(fk)"
          @add-array-item="(fk: string, schema: any) => addArrayItemDirect(fk, schema)"
          @remove-array-item="(fk: string, idx: number) => removeArrayItemDirect(fk, idx)"
          @update-array-item-value="(fk: string, idx: number, pk: string, val: any) => updateArrayItemValueDirect(fk, idx, pk, val)"
          @open-node-select-modal="(fk: string) => emit('openNodeSelectModal', fieldKey + '_value.' + fk)"
          @edit-child-node="(fk: string, idx: number) => emit('editChildNode', fieldKey + '_value.' + fk, idx)"
        />
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
