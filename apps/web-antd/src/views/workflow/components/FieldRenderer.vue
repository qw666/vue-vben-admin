<script lang="ts" setup>
import { computed } from 'vue';
import { Button, Tooltip, Input, Textarea, Select, Switch, InputNumber } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

defineOptions({
  inheritAttrs: false,
});

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

const selectedAnyOfOption = computed(() => {
  if (!props.field.props.options || props.nodeConfigForm[fieldKey.value] === undefined || props.nodeConfigForm[fieldKey.value] === null) return null;
  return props.field.props.options.find((opt: any) => opt.value === props.nodeConfigForm[fieldKey.value]);
});

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

function buildField(prop: any, key: string): any {
  const baseProps = {
    key,
    label: prop.title || key,
    placeholder: prop.description || '',
    required: prop.$required || false,
    tooltip: prop.description || '',
    dynamic: prop.$dynamic !== false,
    fieldType: prop.type,
  };

  if (prop.anyOf) {
    return {
      type: 'AnyOfRadio',
      props: {
        ...baseProps,
        modelValue: '',
        options: prop.anyOf.map((opt: any, index: number) => ({
          value: index,
          label: opt.title || (opt.const !== undefined ? opt.const.toString() : opt.type || `选项 ${index + 1}`),
          schema: opt,
        })),
      },
    };
  }

  if (prop.$ref) {
    return {
      type: 'RefObject',
      props: {
        ...baseProps,
        subFields: [],
        modelValue: {},
      },
    };
  }

  if (prop.type === 'string') {
    if (prop.enum) {
      return {
        type: 'EnumSelect',
        props: {
          ...baseProps,
          modelValue: '',
          options: prop.enum,
        },
      };
    }
    return {
      type: 'Input',
      props: {
        ...baseProps,
        modelValue: '',
      },
    };
  }

  if (prop.type === 'number' || prop.type === 'integer') {
    return {
      type: 'InputNumber',
      props: {
        ...baseProps,
        modelValue: 0,
        min: prop.minimum,
      },
    };
  }

  if (prop.type === 'boolean') {
    return {
      type: 'Switch',
      props: {
        ...baseProps,
        checked: false,
      },
    };
  }

  if (prop.type === 'array') {
    if (prop.items?.type === 'string') {
      return {
        type: 'StringArray',
        props: {
          ...baseProps,
          modelValue: [],
        },
      };
    }
    return {
      type: 'ArrayTable',
      props: {
        ...baseProps,
        modelValue: [],
        itemsSchema: prop.items,
      },
    };
  }

  if (prop.type === 'object') {
    return {
      type: 'ObjectInput',
      props: {
        ...baseProps,
        modelValue: [],
      },
    };
  }

  return {
    type: 'Input',
    props: {
      ...baseProps,
      modelValue: '',
    },
  };
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
          <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af;" />
        </Tooltip>
      </div>
    </div>
    <Input
    v-if="field.type === 'Input'"
    v-model:value="nodeConfigForm[fieldKey]"
    :placeholder="field.props.placeholder"
    style="width: 100%;"
  />
  <Textarea
    v-else-if="field.type === 'Textarea'"
    v-model:value="nodeConfigForm[fieldKey]"
    :placeholder="field.props.placeholder"
    :rows="field.props.rows"
    style="width: 100%;"
  />
  <InputNumber
    v-else-if="field.type === 'InputNumber'"
    v-model:value="nodeConfigForm[fieldKey]"
    :min="field.props.min"
    :max="field.props.max"
    :step="field.props.step || 1"
    :controls="true"
    :controls-position="'both'"
    style="width: 100%;"
  />
  <Switch
    v-else-if="field.type === 'Switch'"
    :checked="nodeConfigForm[fieldKey]"
    @change="(val: any) => { nodeConfigForm[fieldKey] = val; }"
  />
  <div v-else-if="field.type === 'AnyOfRadio'" style="margin-top: 8px;">
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
  </div>
  <Select
    v-else-if="field.type === 'EnumSelect'"
    v-model:value="nodeConfigForm[fieldKey]"
    :placeholder="field.props.placeholder"
    style="width: 100%;"
  >
    <option v-for="opt in field.props.options" :key="opt" :value="opt">{{ opt }}</option>
  </Select>
  <Select
    v-else-if="field.type === 'Select'"
    v-model:value="nodeConfigForm[fieldKey]"
    :mode="'multiple'"
    :placeholder="field.props.placeholder"
    style="width: 100%;"
  />
  <div v-else-if="field.type === 'StringArray'" style="margin-top: 8px;">
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 12px; color: #6b7280;">{{ field.props.label }} ({{ nodeConfigForm[fieldKey]?.length || 0 }})</span>
        <Button type="text" size="small" @click="emit('addStringArrayItem', fieldKey)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div v-for="(item, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-string-' + index" style="display: flex; align-items: center; gap: 8px;">
          <Input
            v-model:value="nodeConfigForm[fieldKey][index]"
            :placeholder="'请输入'"
            style="flex: 1;"
            size="small"
          />
          <Button type="text" size="small" @click="emit('removeArrayItem', fieldKey, index)" danger>
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="field.type === 'NumberArray'" style="margin-top: 8px;">
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 12px; color: #6b7280;">{{ field.props.label }} ({{ nodeConfigForm[fieldKey]?.length || 0 }})</span>
        <Button type="text" size="small" @click="emit('addNumberArrayItem', fieldKey)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div v-for="(item, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-number-' + index" style="display: flex; align-items: center; gap: 8px;">
          <InputNumber
            v-model:value="nodeConfigForm[fieldKey][index]"
            :placeholder="'请输入'"
            style="flex: 1;"
            size="small"
            :controls="true"
            :controls-position="'both'"
          />
          <Button type="text" size="small" @click="emit('removeArrayItem', fieldKey, index)" danger>
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="field.type === 'ObjectInput'" style="margin-top: 8px;">
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
      <div style="display: flex; align-items: center; justify-content: flex-end; margin-bottom: 8px;">
        <Button type="text" size="small" @click="emit('addObjectItem', fieldKey)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div v-for="(entry, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-obj-' + index" style="display: flex; align-items: center; gap: 8px;">
          <Input
            :value="entry.key"
            @input="(e: any) => emit('updateObjectKey', fieldKey, index, e.target.value)"
            :placeholder="'Key'"
            style="width: 80px;"
            size="small"
          />
          <Input
            :value="entry.value"
            @input="(e: any) => emit('updateObjectValue', fieldKey, index, e.target.value)"
            :placeholder="'Value'"
            style="flex: 1; min-width: 0;"
            size="small"
          />
          <Button type="text" size="small" @click="emit('removeObjectItem', fieldKey, index)" danger>
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
        <div v-if="(nodeConfigForm[fieldKey] || []).length === 0" style="font-size: 12px; color: #9ca3af; padding: 8px 0;">
          {{ field.props.placeholder }}
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="field.type === 'ArrayTable'" style="margin-top: 8px;">
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 12px; color: #6b7280;">{{ field.props.label }} ({{ nodeConfigForm[fieldKey]?.length || 0 }})</span>
        <Button type="text" size="small" @click="emit('addArrayItem', fieldKey, field.props.itemsSchema)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div v-for="(item, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-array-' + index" style="background: white; border-radius: 8px; padding: 12px; border: 1px solid #e5e7eb;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 500; color: #4b5563;">第 {{ index + 1 }} 项</span>
            <Button type="text" size="small" @click="emit('removeArrayItem', fieldKey, index)" danger>
              <IconifyIcon icon="mdi:close" :size="14" />
            </Button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div v-for="(prop, propKey) in (field.props.itemsSchema?.properties || {})" :key="propKey">
              <label style="font-size: 12px; color: #6b7280;">{{ prop.title || propKey }}<span v-if="prop.$required" style="color: #ef4444; margin-left: 4px;">*</span></label>
              <Input
                v-if="prop.type === 'string'"
                :value="nodeConfigForm[fieldKey][index][propKey]"
                @input="(e: any) => emit('updateArrayItemValue', fieldKey, index, propKey, e.target.value)"
                :placeholder="prop.description || '请输入'"
                :disabled="prop.$dynamic === false"
                style="width: 100%;"
                size="small"
              />
              <InputNumber
                v-else-if="prop.type === 'number' || prop.type === 'integer'"
                :value="nodeConfigForm[fieldKey][index][propKey]"
                @input="(val: any) => emit('updateArrayItemValue', fieldKey, index, propKey, val)"
                :min="prop.minimum"
                style="width: 100%;"
                size="small"
              />
              <Select
                v-else-if="prop.enum"
                :value="nodeConfigForm[fieldKey][index][propKey]"
                @change="(val: any) => emit('updateArrayItemValue', fieldKey, index, propKey, val)"
                style="width: 100%;"
                size="small"
              >
                <option v-for="opt in prop.enum" :key="opt" :value="opt">{{ opt }}</option>
              </Select>
              <Switch
                v-else-if="prop.type === 'boolean'"
                :checked="nodeConfigForm[fieldKey][index][propKey]"
                @change="(val: any) => emit('updateArrayItemValue', fieldKey, index, propKey, val)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="field.type === 'NodeArray'" style="margin-top: 8px;">
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 12px; color: #6b7280;">{{ field.props.label }} ({{ nodeConfigForm[fieldKey]?.length || 0 }})</span>
        <Button type="text" size="small" @click="emit('openNodeSelectModal', fieldKey)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加节点
        </Button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div v-for="(item, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-node-' + index" style="background: white; border-radius: 8px; padding: 12px; border: 1px solid #e5e7eb;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; font-weight: 500; color: #4b5563;">第 {{ index + 1 }} 项</span>
              <span style="font-size: 14px; color: #2563eb;">
                {{ pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === item.type)?.nodeName || item.type }}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <Button type="text" size="small" @click="emit('editChildNode', fieldKey, index)">
                <IconifyIcon icon="mdi:pencil" :size="14" />
              </Button>
              <Button type="text" size="small" @click="emit('removeArrayItem', fieldKey, index)" danger>
                <IconifyIcon icon="mdi:close" :size="14" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="field.type === 'ConnectionStatus'" style="margin-top: 8px;">
    <div style="background: #f0f9ff; border-radius: 8px; padding: 12px; border: 1px dashed #93c5fd;">
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
        <IconifyIcon icon="mdi:link-variant" :size="16" class="text-blue-500" />
        <span style="font-size: 13px; font-weight: 500; color: #1e40af;">{{ field.props.label }}</span>
        <span style="font-size: 12px; color: #6b7280;">({{ nodeConfigForm[fieldKey]?.length || 0 }} 个节点)</span>
      </div>
      <div v-if="nodeConfigForm[fieldKey]?.length" style="display: flex; flex-direction: column; gap: 6px;">
        <div v-for="(item, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-conn-' + index"
             style="display: flex; align-items: center; gap: 8px; background: white; padding: 6px 10px; border-radius: 6px; border: 1px solid #e5e7eb;">
          <IconifyIcon icon="mdi:arrow-right-bottom" :size="14" class="text-green-500" />
          <span style="font-size: 13px; color: #374151; flex: 1;">
            {{ pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === item.type)?.nodeName || item.type }}
          </span>
          <span v-if="item.nodeId" style="font-size: 11px; color: #9ca3af;">画布节点</span>
        </div>
      </div>
      <div v-else style="text-align: center; padding: 8px; color: #9ca3af; font-size: 12px;">
        在画布上从此节点的端口拖线连接子节点
      </div>
    </div>
  </div>
  <div v-else-if="field.type === 'RefObject'" style="margin-top: 8px;">
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
</div>
</template>
