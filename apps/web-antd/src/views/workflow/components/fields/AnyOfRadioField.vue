<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Tooltip, Button } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import FieldRenderer from '../FieldRenderer.vue';
import { renderFormField } from '../../composables/useFormFieldResolver';
import { inferAnyOfOption } from '../../composables/useSchemaParser';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
  pluginGroups: any[];
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

// 组件内部管理选项索引状态，不再写入 nodeConfigForm
const selectedIndex = ref<number | null>(null);

// 从 nodeConfigForm 的值推断选项索引
function initSelectedIndexFromValue(): number {
  const value = props.nodeConfigForm[fieldKey.value];
  const options = props.field.props.options || [];
  return inferAnyOfOption(options, value);
}

// 监听字段 key 的变化（节点切换时），重新初始化选项索引
watch(
  fieldKey,
  () => {
    selectedIndex.value = initSelectedIndexFromValue();
  },
  { immediate: true }
);

// 当 nodeConfigForm 的值外部变化时，同步选项索引
watch(
  () => props.nodeConfigForm[fieldKey.value],
  (newVal, oldVal) => {
    // 只有当值真正变化且不是选项切换导致的才同步
    if (newVal !== oldVal && selectedIndex.value !== null) {
      const newIndex = inferAnyOfOption(props.field.props.options || [], newVal);
      if (newIndex !== selectedIndex.value) {
        selectedIndex.value = newIndex;
      }
    }
  }
);

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
  if (selectedIndex.value === null || selectedIndex.value === undefined) return null;
  return props.field.props.options.find((opt: any) => opt.value === selectedIndex.value);
});

/** 动态创建的 renderedField（当选项没有 subFields 时） */
const renderedField = computed(() => {
  const option = selectedAnyOfOption.value;
  
  if (!option || option.subFields?.length) {
    return null;
  }
  const schema = option.schema;
  if (!schema?.type) {
    return null;
  }

  const isRequired = props.field.props.required;

  // 直接使用主字段读取值
  const value = props.nodeConfigForm[fieldKey.value];

  // onUpdate 写入到主字段
  const onUpdate = (val: any) => {
    props.nodeConfigForm[fieldKey.value] = val;
  };

  // 创建字段
  const field = renderFormField({ [fieldKey.value]: schema }, fieldKey.value, isRequired, {}, value, onUpdate, '');

  // 保持 label 为原始字段名
  field.props.label = props.field.props.label;

  return field;
});

function clearSelection() {
  selectedIndex.value = null;
  // 清除主字段的值
  props.nodeConfigForm[fieldKey.value] = '';
}

// 监听选项切换，清除旧数据
watch(selectedIndex, (newIndex, oldIndex) => {
  // 只有当选项真正切换时才清空（index 变化了）
  if (newIndex === oldIndex) return;
  
  // 选项切换时，清除主字段的值
  props.nodeConfigForm[fieldKey.value] = '';
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

/** 针对 renderedField 路径的数组操作（直接在 nodeConfigForm[key] 上操作） */
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
        <span v-if="field.props.fieldType" style="font-size: 12px; color: #9ca3af;">{{ field.props.fieldType }}</span>
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
            v-model="selectedIndex"
            style="width: 16px; height: 16px; color: #2563eb;"
          />
          <span style="font-size: 14px; color: #374151;">{{ option.label }}</span>
        </label>
        <Button
          v-if="selectedIndex !== null && selectedIndex !== undefined"
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
