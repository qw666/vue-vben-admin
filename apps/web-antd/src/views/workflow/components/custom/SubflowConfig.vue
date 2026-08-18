<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import {
  AutoComplete,
  Button,
  Input,
  InputNumber,
  Select,
  Spin,
  Switch,
  Tag,
} from 'ant-design-vue';

import { getFlowSelectList } from '#/api/core/workflow';
import { useProjectStore } from '#/store/project';

import VarPicker from '../fields/VarPicker.vue';

const props = defineProps<{
  nodeConfigForm: Record<string, any>;
}>();

const route = useRoute();
const projectStore = useProjectStore();

const canvasProjectId = computed(() => {
  const urlProjectId = route.query.projectId as string;
  if (urlProjectId) return Number(urlProjectId);
  return projectStore.selectedId ?? 0;
});

interface FlowOption {
  flowId: string;
  description: string;
  projectId?: number;
  inputs?: Array<Record<string, any>>;
  value: string;
  label: string;
}

interface InputMapping {
  name: string;
  value: any;
  type: string;
  itemType?: string;
  required: boolean;
  description?: string;
}

const itemTypeOptions = [
  { value: 'STRING', label: 'STRING' },
  { value: 'INT', label: 'INT' },
  { value: 'FLOAT', label: 'FLOAT' },
  { value: 'BOOLEAN', label: 'BOOLEAN' },
];

function getControlType(type: string): string {
  if (['INT', 'FLOAT'].includes(type)) return 'number';
  if (type === 'BOOLEAN') return 'switch';
  if (type === 'JSON') return 'json';
  if (type === 'ARRAY') return 'array';
  return 'string';
}

function getDefaultValueByType(type: string, defaults: any): any {
  if (defaults !== undefined && defaults !== null) {
    return defaults;
  }
  switch (type) {
    case 'INT':
    case 'FLOAT':
      return undefined;
    case 'BOOLEAN':
      return false;
    case 'ARRAY':
      return [];
    case 'JSON':
      return '';
    default:
      return '';
  }
}

const searchKeyword = ref('');
const flowOptions = ref<FlowOption[]>([]);
const selectedFlow = ref<FlowOption | null>(null);
const loadingFlows = ref(false);
const loadingFlowDetail = ref(false);
const flowDetailError = ref('');
const inputMappings = ref<InputMapping[]>([]);
const jsonValidMap = ref<Record<number, boolean>>({});

async function initForm() {
  if (!props.nodeConfigForm.targetFlowId) {
    props.nodeConfigForm.targetFlowId = '';
  }
  if (props.nodeConfigForm.wait === undefined) {
    props.nodeConfigForm.wait = true;
  }
  if (props.nodeConfigForm.transmitFailed === undefined) {
    props.nodeConfigForm.transmitFailed = true;
  }
  if (!props.nodeConfigForm.inputs) {
    props.nodeConfigForm.inputs = {};
  }
  if (props.nodeConfigForm.targetFlowId) {
    await searchFlows('');
    loadFlowInputs(props.nodeConfigForm.targetFlowId);
  }
}

initForm();

async function searchFlows(keyword: string) {
  loadingFlows.value = true;
  try {
    const list = await getFlowSelectList(canvasProjectId.value, keyword || undefined);
    flowOptions.value = list.map((item) => ({
      flowId: item.flowId,
      description: item.description || '',
      projectId: item.projectId,
      inputs: item.inputs,
      value: item.flowId,
      label: item.description ? `${item.description} (${item.flowId})` : item.flowId,
    }));
  } catch (e) {
    console.error('Failed to fetch flow list', e);
  } finally {
    loadingFlows.value = false;
  }
}

function loadFlowInputs(flowId: string) {
  flowDetailError.value = '';

  const matched = flowOptions.value.find((f) => f.flowId === flowId);
  if (!matched) {
    flowDetailError.value = `流程 "${flowId}" 不存在或已被删除`;
    inputMappings.value = [];
    loadingFlowDetail.value = false;
    return;
  }

  selectedFlow.value = matched;

  const flowInputs = matched.inputs || [];
  const existingInputs = props.nodeConfigForm.inputs || {};
  inputMappings.value = flowInputs.map((inp: any) => {
    const name = inp.id || inp.name;
    const type = inp.type || 'STRING';
    const itemType = inp.itemType;
    let existingValue = existingInputs[name];
    if (existingValue === undefined) {
      existingValue = getDefaultValueByType(type, inp.defaults);
    } else {
      existingValue = deserializeInputValue(existingValue, type, itemType);
    }
    if (type === 'JSON' && typeof existingValue === 'object') {
      existingValue = JSON.stringify(existingValue, null, 2);
    }
    return {
      name,
      type,
      itemType,
      value: existingValue,
      required: inp.required || false,
      description: inp.displayName || inp.description || '',
    };
  });

  loadingFlowDetail.value = false;
}

function onFlowSelect(value: string) {
  if (!value) {
    props.nodeConfigForm.targetFlowId = '';
    selectedFlow.value = null;
    inputMappings.value = [];
    flowDetailError.value = '';
    return;
  }
  props.nodeConfigForm.targetFlowId = value;
  loadFlowInputs(value);
}

function updateMappingValue(index: number, value: any) {
  inputMappings.value[index].value = value;
  jsonValidMap.value[index] = undefined as any;
  syncInputsToForm();
}

function updateArrayItem(index: number, itemIndex: number, value: any) {
  const mapping = inputMappings.value[index];
  if (Array.isArray(mapping.value)) {
    mapping.value[itemIndex] = value;
    syncInputsToForm();
  }
}

function addArrayItem(index: number) {
  const mapping = inputMappings.value[index];
  if (!Array.isArray(mapping.value)) {
    mapping.value = [];
  }
  mapping.value.push('');
  syncInputsToForm();
}

function removeArrayItem(index: number, itemIndex: number) {
  const mapping = inputMappings.value[index];
  if (Array.isArray(mapping.value)) {
    mapping.value.splice(itemIndex, 1);
    syncInputsToForm();
  }
}

function syncInputsToForm() {
  const inputs: Record<string, any> = {};
  inputMappings.value.forEach((m) => {
    if (m.name) {
      inputs[m.name] = serializeInputValue(m.value, m.type, m.itemType);
    }
  });
  props.nodeConfigForm.inputs = inputs;
}

function serializeInputValue(value: any, type: string, itemType?: string): any {
  if (value === undefined || value === null || value === '') {
    return value;
  }
  switch (type) {
    case 'JSON':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    case 'ARRAY':
      if (Array.isArray(value)) {
        return value.map((item) => castItemForType(item, itemType));
      }
      if (typeof value === 'string') {
        return value ? [castItemForType(value, itemType)] : [];
      }
      return value;
    case 'INT':
      if (typeof value === 'string' && value.trim()) {
        return Number(value);
      }
      return value;
    case 'FLOAT':
      if (typeof value === 'string' && value.trim()) {
        return Number(value);
      }
      return value;
    case 'BOOLEAN':
      return Boolean(value);
    default:
      return value;
  }
}

function castItemForType(item: any, itemType?: string): any {
  if (!itemType || itemType === 'STRING') return item;
  if (itemType === 'INT' || itemType === 'FLOAT') {
    const n = Number(item);
    return isNaN(n) ? item : n;
  }
  if (itemType === 'BOOLEAN') {
    if (typeof item === 'boolean') return item;
    return item === 'true' || item === '1';
  }
  return item;
}

function deserializeInputValue(value: any, type: string, itemType?: string): any {
  if (value === undefined || value === null) {
    return value;
  }
  switch (type) {
    case 'JSON':
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return typeof parsed === 'object' ? parsed : value;
        } catch {
          return value;
        }
      }
      return value;
    case 'ARRAY':
      if (Array.isArray(value)) {
        if (!itemType || itemType === 'STRING') return value;
        return value.map((item) => castItemForType(item, itemType));
      }
      if (typeof value === 'string') {
        return value ? [castItemForType(value, itemType)] : [];
      }
      return value;
    default:
      return value;
  }
}

watch(
  inputMappings,
  () => {
    syncInputsToForm();
  },
  { deep: true },
);

watch(
  () => props.nodeConfigForm.wait,
  () => {},
);

const outputVars = computed(() => {
  const vars = [
    { key: 'executionId', label: 'executionId', type: 'string', desc: '子流程执行ID' },
    { key: 'outputs', label: 'outputs', type: 'object', desc: '子流程的输出结果' },
  ];
  if (props.nodeConfigForm.wait !== false) {
    vars.push({ key: 'state', label: 'state', type: 'string', desc: '子流程的最终状态' });
  }
  return vars;
});

const typeColorMap: Record<string, string> = {
  string: 'blue',
  number: 'green',
  boolean: 'orange',
  object: 'purple',
  array: 'cyan',
};

const inputTypeColorMap: Record<string, string> = {
  STRING: 'default',
  INT: 'blue',
  FLOAT: 'blue',
  BOOLEAN: 'green',
  ARRAY: 'purple',
  JSON: 'cyan',
};

function validateJsonOnBlur(index: number) {
  const mapping = inputMappings.value[index];
  if (!mapping || mapping.type !== 'JSON') return;
  const value = mapping.value;
  if (!value || !value.trim()) {
    jsonValidMap.value[index] = true;
    return;
  }
  try {
    JSON.parse(value);
    jsonValidMap.value[index] = true;
  } catch {
    jsonValidMap.value[index] = false;
  }
}
</script>

<template>
  <div class="subflow-config space-y-4 p-2">
    <div class="config-header">
      <div class="flex items-center gap-2">
        <IconifyIcon icon="mdi:folder-open" class="text-lg text-purple-500" />
        <span class="font-semibold text-base">子流程调用</span>
      </div>
      <p class="text-gray-500 text-xs mt-1">调用系统内另一个流程作为子流程执行</p>
    </div>

    <!-- 流程选择 -->
    <div class="config-section">
      <div class="section-title">
        <span class="title-bar"></span>
        <span>目标流程</span>
        <span class="required">*</span>
      </div>
      <div class="section-content">
        <AutoComplete
          v-model:value="searchKeyword"
          :options="flowOptions"
          :filter-option="false"
          :loading="loadingFlows"
          placeholder="搜索流程名称或ID"
          allow-clear
          class="w-full"
          @search="searchFlows"
          @change="onFlowSelect"
        >
          <template #dataSource="{ options }">
            <Select
              v-model:value="props.nodeConfigForm.targetFlowId"
              placeholder="选择要调用的流程"
              allow-clear
              class="w-full"
              @change="onFlowSelect"
            >
              <Select.Option
                v-for="opt in options"
                :key="opt.flowId"
                :value="opt.flowId"
              >
                <div class="flex items-center justify-between">
                  <span>{{ opt.description || opt.flowId }}</span>
                  <span v-if="opt.description" class="text-gray-400 text-xs">{{ opt.flowId }}</span>
                </div>
              </Select.Option>
            </Select>
          </template>
        </AutoComplete>

        <div v-if="selectedFlow" class="mt-2 p-2 bg-gray-50 rounded text-xs">
          <div class="flex items-center gap-2">
            <Tag color="blue">{{ selectedFlow.flowId }}</Tag>
            <span v-if="selectedFlow.description" class="text-gray-600">{{ selectedFlow.description }}</span>
          </div>
        </div>

        <div v-if="flowDetailError" class="mt-2 text-red-500 text-xs">
          {{ flowDetailError }}
        </div>

        <div v-if="loadingFlowDetail" class="mt-2">
          <Spin size="small" /> <span class="text-xs text-gray-500 ml-1">加载流程详情...</span>
        </div>
      </div>
    </div>

    <!-- 输入参数映射 -->
    <div class="config-section" v-if="selectedFlow && !loadingFlowDetail">
      <div class="section-title">
        <span class="title-bar"></span>
        <span>输入参数映射</span>
        <span class="text-xs text-gray-400 ml-1">（按子流程 Start 节点定义）</span>
      </div>
      <div class="section-content">
        <div v-if="inputMappings.length === 0" class="text-gray-400 text-xs py-2">
          该流程无输入参数
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(mapping, index) in inputMappings"
            :key="mapping.name + '_' + index"
            class="flex items-start gap-1"
          >
            <div class="flex-shrink-0 w-24 leading-6">
              <div class="flex items-center gap-1">
                <span class="text-sm font-medium text-gray-700 truncate">{{ mapping.name }}</span>
                <Tag :color="inputTypeColorMap[mapping.type] || 'default'" size="small" class="!text-[10px] !px-1 !py-0">
                  {{ mapping.type }}
                </Tag>
              </div>
              <div
                v-if="mapping.description && mapping.description !== mapping.name"
                class="text-xs text-gray-400 mt-0.5 truncate"
                :title="mapping.description"
              >
                {{ mapping.description }}
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <!-- STRING -->
              <template v-if="getControlType(mapping.type) === 'string'">
                <VarPicker
                  :value="mapping.value"
                  :placeholder="'参数值' + (mapping.required ? ' (必填)' : '')"
                  @update:value="(val: string) => updateMappingValue(index, val)"
                />
              </template>

              <!-- INT / FLOAT -->
              <template v-else-if="getControlType(mapping.type) === 'number'">
                <InputNumber
                  :value="mapping.value"
                  @change="(val: any) => updateMappingValue(index, val)"
                  :step="mapping.type === 'FLOAT' ? 0.1 : 1"
                  :placeholder="'参数值' + (mapping.required ? ' (必填)' : '')"
                  class="w-full"
                  size="small"
                />
              </template>

              <!-- BOOLEAN -->
              <template v-else-if="getControlType(mapping.type) === 'switch'">
                <Switch
                  :checked="!!mapping.value"
                  @change="(val: boolean) => updateMappingValue(index, val)"
                  checked-children="true"
                  un-checked-children="false"
                />
              </template>

              <!-- JSON -->
              <template v-else-if="getControlType(mapping.type) === 'json'">
                <Input.TextArea
                  :value="mapping.value"
                  @update:value="(val: string) => updateMappingValue(index, val)"
                  @blur="() => validateJsonOnBlur(index)"
                  placeholder='{"key": "value"}'
                  :auto-size="{ minRows: 2, maxRows: 4 }"
                  :status="jsonValidMap[index] === false ? 'error' : ''"
                  size="small"
                />
                <div v-if="jsonValidMap[index] === false" class="text-xs text-red-500 mt-0.5">
                  JSON 格式不正确
                </div>
              </template>

              <!-- ARRAY -->
              <template v-else-if="getControlType(mapping.type) === 'array'">
                <div class="space-y-1">
                  <div class="flex items-center gap-1 mb-1">
                    <Tag :color="inputTypeColorMap[mapping.itemType || 'STRING'] || 'default'" size="small" class="!text-[10px] !px-1 !py-0">
                      元素: {{ mapping.itemType || 'STRING' }}
                    </Tag>
                  </div>
                  <div
                    v-for="(arrItem, arrIndex) in mapping.value"
                    :key="arrIndex"
                    class="flex items-center gap-1"
                  >
                    <Input
                      v-if="getControlType(mapping.itemType || 'STRING') === 'string'"
                      :value="arrItem"
                      @update:value="(val: string) => updateArrayItem(index, arrIndex, val)"
                      :placeholder="`元素 ${arrIndex + 1}`"
                      size="small"
                      class="flex-1"
                    />
                    <InputNumber
                      v-else-if="getControlType(mapping.itemType || 'STRING') === 'number'"
                      :value="arrItem"
                      @change="(val: any) => updateArrayItem(index, arrIndex, val)"
                      :step="mapping.itemType === 'FLOAT' ? 0.1 : 1"
                      size="small"
                      class="flex-1"
                    />
                    <Switch
                      v-else-if="getControlType(mapping.itemType || 'STRING') === 'switch'"
                      :checked="!!arrItem"
                      @change="(val: boolean) => updateArrayItem(index, arrIndex, val)"
                      checked-children="true"
                      un-checked-children="false"
                      size="small"
                    />
                    <Button
                      type="text"
                      size="small"
                      danger
                      @click="removeArrayItem(index, arrIndex)"
                    >
                      <IconifyIcon icon="mdi:close" :size="12" />
                    </Button>
                  </div>
                  <Button
                    type="dashed"
                    size="small"
                    @click="addArrayItem(index)"
                  >
                    <IconifyIcon icon="mdi:plus" :size="12" /> 添加元素
                  </Button>
                </div>
              </template>
            </div>

            <Tag v-if="mapping.required" color="red" size="small" class="flex-shrink-0">必填</Tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 执行行为 -->
    <div class="config-section" v-if="selectedFlow">
      <div class="section-title">
        <span class="title-bar"></span>
        <span>执行行为</span>
      </div>
      <div class="section-content space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm">等待子流程完成</div>
            <div class="text-xs text-gray-400">默认开启。关闭后父流程不等待子流程完成即继续</div>
          </div>
          <Switch v-model:checked="props.nodeConfigForm.wait" />
        </div>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm">子流程失败时传递</div>
            <div class="text-xs text-gray-400">默认开启。子流程失败时父流程也会标记为失败</div>
          </div>
          <Switch v-model:checked="props.nodeConfigForm.transmitFailed" />
        </div>
      </div>
    </div>

    <!-- 输出变量 -->
    <div class="config-section" v-if="selectedFlow">
      <div class="section-title">
        <span class="title-bar"></span>
        <span>输出变量</span>
      </div>
      <div class="section-content">
        <p class="text-xs text-gray-500 mb-2">该节点声明以下输出，可在下游节点通过 / 引用：</p>
        <div class="space-y-1">
          <div
            v-for="v in outputVars"
            :key="v.key"
            class="flex items-center gap-2 py-1 px-2 bg-gray-50 rounded text-xs"
          >
            <Tag :color="typeColorMap[v.type] || 'default'" size="small">
              {{ v.type }}
            </Tag>
            <span class="font-mono">{{ v.key }}</span>
            <span class="text-gray-400 ml-1">{{ v.desc }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!selectedFlow" class="text-gray-400 text-xs py-4 text-center">
      请先选择一个要调用的子流程
    </div>
  </div>
</template>

<style scoped>
.subflow-config {
  font-size: 13px;
}

.config-header {
  padding: 4px 0 8px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
}

.config-section {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  font-weight: 500;
}

.section-title .title-bar {
  width: 3px;
  height: 12px;
  background: #8b5cf6;
  border-radius: 2px;
}

.section-title .required {
  color: #ff4d4f;
  margin-left: 2px;
}

.section-content {
  padding: 12px;
}

.w-full {
  width: 100%;
}
</style>
