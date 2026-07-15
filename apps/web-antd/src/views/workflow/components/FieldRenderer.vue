<script lang="ts" setup>
import { computed, watch } from 'vue';
import { Button, Tooltip, Input, Textarea, Select, Switch, InputNumber } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
  pluginGroups: any[];
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

watch(() => props.nodeConfigForm[fieldKey.value], (newVal) => {
  console.log('FieldRenderer watch - fieldKey:', fieldKey.value, 'newVal:', JSON.stringify(newVal));
}, { deep: true });

const emit = defineEmits<{
  (e: 'addObjectItem', fieldKey: string): void;
  (e: 'updateObjectKey', fieldKey: string, index: number, value: string): void;
  (e: 'updateObjectValue', fieldKey: string, index: number, value: string): void;
  (e: 'removeObjectItem', fieldKey: string, index: number): void;
  (e: 'addStringArrayItem', fieldKey: string): void;
  (e: 'addArrayItem', fieldKey: string, itemsSchema: any): void;
  (e: 'removeArrayItem', fieldKey: string, index: number): void;
  (e: 'updateArrayItemValue', fieldKey: string, index: number, itemKey: string, value: any): void;
  (e: 'openNodeSelectModal', fieldKey: string): void;
  (e: 'editChildNode', fieldKey: string, index: number): void;
}>();
</script>

<template>
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
    style="width: 100%;"
  />
  <Switch
    v-else-if="field.type === 'Switch'"
    :checked="nodeConfigForm[fieldKey]"
    @change="(val: any) => { nodeConfigForm[fieldKey] = val; }"
  />
  <div v-else-if="field.type === 'AnyOfRadio'" style="display: flex; flex-wrap: wrap; gap: 16px;">
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
</template>
