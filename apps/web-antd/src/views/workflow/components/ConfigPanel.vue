<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { Button, Input, Tooltip, message } from 'ant-design-vue';

import { computed, ref } from 'vue';

import CodeConfig from './custom/CodeConfig.vue';
import FieldRenderer from './FieldRenderer.vue';
import HttpRequestConfig from './custom/HttpRequestConfig.vue';
import { getFlowControlConfig } from '../config/workflow-node-config';
import { flowControlNodeRegistry } from '../nodes/FlowControlNodeRegistry';

const props = defineProps<{
  currentNodeMeta: any;
  fieldRendererEvents: Record<string, any>;
  isMetaLoading: boolean;
  isOpen: boolean;
  isResizing: boolean;
  nodeConfigForm: Record<string, any>;
  optionalFields: any[];
  pluginGroups: any[];
  requiredFields: any[];
  selectedNode: any;
  width: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'startResize', event: MouseEvent): void;
  (e: 'saveConfig'): void;
  (e: 'updateNodeLabel', value: string): void;
  (e: 'updateNodeId', value: string): void;
}>();

const codeConfigRef = ref<InstanceType<typeof CodeConfig> | null>(null);

// 使用 registry 的 category 来判断节点类型，避免硬编码字符串匹配
const currentNodeType = computed(() => props.selectedNode?.data?.type);

function isHttpRequestNode(nodeType: string): boolean {
  return flowControlNodeRegistry.isCategory(nodeType, 'http');
}

function isCodeNode(nodeType: string): boolean {
  return flowControlNodeRegistry.isCategory(nodeType, 'code');
}

function isStartOrEndNode(nodeType: string): boolean {
  const category = flowControlNodeRegistry.getCategory(nodeType);
  return category === 'start' || category === 'end';
}

// 节点类型显示名称：优先使用左侧节点列表中定义的 nodeName，其次取插件标题，最后回退到原始 type
const nodeTypeDisplayName = computed(() => {
  const type = props.selectedNode?.data?.type;
  if (!type) return '';
  const flowConfig = getFlowControlConfig(type);
  if (flowConfig?.nodeName) return flowConfig.nodeName;
  if (props.currentNodeMeta?.title) return props.currentNodeMeta.title;
  return type;
});

function updateConfig(formData: Record<string, any>) {
  Object.keys(formData).forEach(() => {
    emit('saveConfig');
  });
}

function handleSaveConfig() {
  // 如果是代码节点，先校验代码
  if (isCodeNode(props.selectedNode?.data?.type)) {
    if (codeConfigRef.value) {
      const isValid = codeConfigRef.value.validate();
      if (!isValid) {
        message.error('代码校验未通过，请修复错误后再保存');
        return;
      }
    }
  }
  emit('saveConfig');
}
</script>

<template>
  <div v-if="isOpen" class="flex-shrink-0 flex overflow-hidden">
    <div
      class="w-2 flex-shrink-0 cursor-col-resize flex items-center justify-center hover:bg-gray-100 transition-colors relative bg-gray-100 border-l border-gray-200"
      @mousedown="emit('startResize', $event)"
    >
      <div class="flex flex-col gap-1.5">
        <div class="w-1 h-1 rounded-full bg-gray-400"></div>
        <div class="w-1 h-1 rounded-full bg-gray-400"></div>
        <div class="w-1 h-1 rounded-full bg-gray-400"></div>
      </div>
    </div>
    <div
      class="bg-white border-l border-gray-200 flex flex-col overflow-hidden"
      :style="{ width: `${width}px` }"
    >
      <div class="py-2 px-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-800 flex items-center gap-1">
          节点配置
          <Tooltip v-if="currentNodeMeta?.description" :title="currentNodeMeta.description">
            <IconifyIcon icon="mdi:help-circle" :size="14" class="text-gray-400 cursor-help" />
          </Tooltip>
        </h2>
        <Button type="text" @click="emit('close')">
          <IconifyIcon icon="mdi:close" :size="14" />
        </Button>
      </div>
      <div class="flex-1 overflow-y-auto p-2 space-y-2.5">
        <div v-if="isMetaLoading" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
        <div v-else-if="!selectedNode" class="text-center text-gray-500 py-12">
          请选择一个节点
        </div>
        <div v-else :key="selectedNode?.id">
          <template v-if="!isStartOrEndNode(selectedNode.data.type)">
            <div class="p-2.5 bg-gray-50 rounded-lg">
              <div class="text-sm text-gray-500">节点ID</div>
              <Input
                :value="selectedNode.id"
                class="mt-0.25"
                :disabled="true"
              />
            </div>
            <div class="p-2.5 bg-gray-50 rounded-lg">
              <div class="text-sm text-gray-500 flex items-center gap-1">
                <span>节点名称</span>
                <span class="text-red-500">*</span>
              </div>
              <div class="flex items-center gap-2 mt-0.25">
                <Input
                  :value="selectedNode.data.label"
                  @input="(e: any) => emit('updateNodeLabel', e.target.value)"
                  placeholder="请输入节点名称"
                />
              </div>
            </div>
            <div class="p-2.5 bg-gray-50 rounded-lg">
              <div class="text-sm text-gray-500">节点类型</div>
              <Input
                :value="nodeTypeDisplayName"
                class="mt-0.25"
                :disabled="true"
              />
            </div>

          </template>
          <template v-if="isHttpRequestNode(selectedNode.data.type)">
            <HttpRequestConfig
              :node-config-form="nodeConfigForm"
              @update:config="updateConfig"
            />
          </template>
          <template v-else-if="isCodeNode(selectedNode.data.type)">
            <CodeConfig
              ref="codeConfigRef"
              :node-config-form="nodeConfigForm"
            />
          </template>
          <template v-else>
            <div v-if="requiredFields.length > 0" class="mt-4 mb-6">
              <div class="flex items-center gap-2 mb-3">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span class="text-sm font-semibold text-gray-700">必填项</span>
              </div>
              <div class="space-y-4">
                <div v-for="field in requiredFields" :key="field.props.key" class="border-l-2 border-red-400 pl-3">
                  <FieldRenderer
                    :field="field"
                    :node-config-form="nodeConfigForm"
                    :plugin-groups="pluginGroups"
                    v-on="fieldRendererEvents"
                  />
                </div>
              </div>
            </div>
            <div v-if="optionalFields.length > 0">
              <template v-if="isStartOrEndNode(selectedNode.data.type)">
                <div class="space-y-4">
                  <div
                    v-for="field in optionalFields"
                    :key="field.props.key"
                    :class="field.type === 'InfoBox' ? '' : 'border-l-2 border-gray-200 pl-3'"
                  >
                    <FieldRenderer
                      :field="field"
                      :node-config-form="nodeConfigForm"
                      :plugin-groups="pluginGroups"
                      v-on="fieldRendererEvents"
                    />
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center gap-2 mb-3">
                  <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  <span class="text-sm font-semibold text-gray-700">选填项</span>
                </div>
                <div class="space-y-4">
                  <div
                    v-for="field in optionalFields"
                    :key="field.props.key"
                    :class="field.type === 'InfoBox' ? '' : 'border-l-2 border-gray-200 pl-3'"
                  >
                    <FieldRenderer
                      :field="field"
                      :node-config-form="nodeConfigForm"
                      :plugin-groups="pluginGroups"
                      v-on="fieldRendererEvents"
                    />
                  </div>
                </div>
              </template>
            </div>
            <div v-if="requiredFields.length === 0 && optionalFields.length === 0" class="text-center text-gray-500 py-4">
              该节点暂无配置项
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
