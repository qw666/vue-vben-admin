<script lang="ts" setup>
import { computed } from 'vue';
import { Button, Tooltip, Input, Textarea, Select, Switch, InputNumber } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

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
  (e: 'addArrayItem', fieldKey: string, itemsSchema: any): void;
  (e: 'removeArrayItem', fieldKey: string, index: number): void;
  (e: 'updateArrayItemValue', fieldKey: string, index: number, itemKey: string, value: any): void;
  (e: 'openNodeSelectModal', fieldKey: string): void;
  (e: 'editChildNode', fieldKey: string, index: number): void;
}>();
</script>

<template>
  <div class="flex items-center justify-between mb-1">
    <label class="text-sm font-medium text-gray-700">
      {{ field.props.label }}
      <span v-if="field.props.required" class="text-red-500 ml-1">*</span>
    </label>
    <div class="flex items-center gap-2">
      <span v-if="field.props.fieldType" class="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{{ field.props.fieldType }}</span>
      <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
        <IconifyIcon icon="mdi:help-circle" :size="14" class="text-gray-400" />
      </Tooltip>
    </div>
  </div>
  <Input
    v-if="field.type === 'Input'"
    v-model:value="nodeConfigForm[fieldKey]"
    :placeholder="field.props.placeholder"
    class="w-full"
  />
  <Textarea
    v-else-if="field.type === 'Textarea'"
    v-model:value="nodeConfigForm[fieldKey]"
    :placeholder="field.props.placeholder"
    :rows="field.props.rows"
    class="w-full"
  />
  <InputNumber
    v-else-if="field.type === 'InputNumber'"
    v-model:value="nodeConfigForm[fieldKey]"
    :min="field.props.min"
    class="w-full"
  />
  <Switch
    v-else-if="field.type === 'Switch'"
    :checked="nodeConfigForm[fieldKey]"
    @change="(val: any) => { nodeConfigForm[fieldKey] = val; }"
  />
  <div v-else-if="field.type === 'AnyOfRadio'" class="flex flex-wrap gap-4">
    <label
      v-for="option in field.props.options"
      :key="option.value"
      class="flex items-center gap-2 cursor-pointer"
    >
      <input
        type="radio"
        :value="option.value"
        v-model="nodeConfigForm[fieldKey]"
        class="w-4 h-4 text-blue-600"
      />
      <span class="text-sm text-gray-700">{{ option.label }}</span>
    </label>
  </div>
  <Select
    v-else-if="field.type === 'EnumSelect'"
    v-model:value="nodeConfigForm[fieldKey]"
    :placeholder="field.props.placeholder"
    class="w-full"
  >
    <option v-for="opt in field.props.options" :key="opt" :value="opt">{{ opt }}</option>
  </Select>
  <Select
    v-else-if="field.type === 'Select'"
    v-model:value="nodeConfigForm[fieldKey]"
    :mode="'multiple'"
    :placeholder="field.props.placeholder"
    class="w-full"
  />
  <div v-else-if="field.type === 'StringArray'" class="mt-2">
    <div class="bg-gray-50 rounded-lg p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-gray-500">{{ field.props.label }} ({{ nodeConfigForm[fieldKey]?.length || 0 }})</span>
        <Button type="text" size="small" @click="emit('addStringArrayItem', fieldKey)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
        </Button>
      </div>
      <div class="space-y-2">
        <div v-for="(item, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-string-' + index" class="flex items-center gap-2">
          <Input
            v-model:value="nodeConfigForm[fieldKey][index]"
            :placeholder="'请输入'"
            class="flex-1"
            size="small"
          />
          <Button type="text" size="small" @click="emit('removeArrayItem', fieldKey, index)" danger>
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="field.type === 'ObjectInput'" class="mt-2">
    <div class="bg-gray-50 rounded-lg p-3">
      <div class="flex items-center justify-end mb-2">
        <Button type="text" size="small" @click="emit('addObjectItem', fieldKey)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
        </Button>
      </div>
      <div class="space-y-2">
        <div v-for="(entry, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-obj-' + index" class="flex items-center gap-2">
          <Input
            :value="entry.key"
            @input="(e: any) => emit('updateObjectKey', fieldKey, index, e.target.value)"
            :placeholder="'Key'"
            class="w-20"
            size="small"
          />
          <Input
            :value="entry.value"
            @input="(e: any) => emit('updateObjectValue', fieldKey, index, e.target.value)"
            :placeholder="'Value'"
            class="flex-1 min-w-0"
            size="small"
          />
          <Button type="text" size="small" @click="emit('removeObjectItem', fieldKey, index)" danger>
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
        <div v-if="(nodeConfigForm[fieldKey] || []).length === 0" class="text-xs text-gray-400 py-2">
          {{ field.props.placeholder }}
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="field.type === 'ArrayTable'" class="mt-2">
    <div class="bg-gray-50 rounded-lg p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-gray-500">{{ field.props.label }} ({{ nodeConfigForm[fieldKey]?.length || 0 }})</span>
        <Button type="text" size="small" @click="emit('addArrayItem', fieldKey, field.props.itemsSchema)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
        </Button>
      </div>
      <div class="space-y-3">
        <div v-for="(item, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-array-' + index" class="bg-white rounded-lg p-3 border border-gray-200">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-gray-600">第 {{ index + 1 }} 项</span>
            <Button type="text" size="small" @click="emit('removeArrayItem', fieldKey, index)" danger>
              <IconifyIcon icon="mdi:close" :size="14" />
            </Button>
          </div>
          <div class="grid grid-cols-1 gap-2">
            <div v-for="(prop, propKey) in (field.props.itemsSchema?.properties || {})" :key="propKey">
              <label class="text-xs text-gray-500">{{ prop.title || propKey }}<span v-if="prop.$required" class="text-red-500 ml-1">*</span></label>
              <Input
                v-if="prop.type === 'string'"
                :value="nodeConfigForm[fieldKey][index][propKey]"
                @input="(e: any) => emit('updateArrayItemValue', fieldKey, index, propKey, e.target.value)"
                :placeholder="prop.description || '请输入'"
                :disabled="prop.$dynamic === false"
                class="w-full"
                size="small"
              />
              <InputNumber
                v-else-if="prop.type === 'number' || prop.type === 'integer'"
                :value="nodeConfigForm[fieldKey][index][propKey]"
                @input="(val: any) => emit('updateArrayItemValue', fieldKey, index, propKey, val)"
                :min="prop.minimum"
                class="w-full"
                size="small"
              />
              <Select
                v-else-if="prop.enum"
                :value="nodeConfigForm[fieldKey][index][propKey]"
                @change="(val: any) => emit('updateArrayItemValue', fieldKey, index, propKey, val)"
                class="w-full"
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
  <div v-else-if="field.type === 'NodeArray'" class="mt-2">
    <div class="bg-gray-50 rounded-lg p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-gray-500">{{ field.props.label }} ({{ nodeConfigForm[fieldKey]?.length || 0 }})</span>
        <Button type="text" size="small" @click="emit('openNodeSelectModal', fieldKey)">
          <IconifyIcon icon="mdi:plus" :size="14" /> 添加节点
        </Button>
      </div>
      <div class="space-y-3">
        <div v-for="(item, index) in (nodeConfigForm[fieldKey] || [])" :key="fieldKey + '-node-' + index" class="bg-white rounded-lg p-3 border border-gray-200">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-gray-600">第 {{ index + 1 }} 项</span>
              <span class="text-sm text-blue-600">
                {{ pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === item.type)?.nodeName || item.type }}
              </span>
            </div>
            <div class="flex items-center gap-1">
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
