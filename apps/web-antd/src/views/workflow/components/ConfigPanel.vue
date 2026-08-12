<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { Button, Tooltip, message } from 'ant-design-vue';

import { computed } from 'vue';

import NodeBasicInfo from './NodeBasicInfo.vue';
import NodeConfigRenderer from './NodeConfigRenderer.vue';
import { getFlowControlConfig } from '../config/workflow-node-config';
import { flowControlNodeRegistry } from '../nodes/FlowControlNodeRegistry';

const props = defineProps<{
  currentNodeMeta: any;
  fieldRendererEvents: Record<string, any>;
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

// 当前节点类型
const currentNodeType = computed(() => props.selectedNode?.data?.type);

// 是否显示基本信息区（通过策略判断，替代原 isStartOrEndNode 硬编码）
const showBasicInfo = computed(() => {
  if (!currentNodeType.value) return false;
  return flowControlNodeRegistry.getShowBasicInfo(currentNodeType.value);
});

// 节点类型显示名称
const nodeTypeDisplayName = computed(() => {
  const type = props.selectedNode?.data?.type;
  if (!type) return '';
  const flowConfig = getFlowControlConfig(type);
  if (flowConfig?.nodeName) return flowConfig.nodeName;
  if (props.currentNodeMeta?.title) return props.currentNodeMeta.title;
  return type;
});

function updateConfig(_formData: Record<string, any>) {
  emit('saveConfig');
}

/**
 * 保存前统一校验
 * 通过 flowControlNodeRegistry.validateBeforeSave 调用策略的 validateBeforeSave 方法
 */
function handleSaveConfig() {
  const type = currentNodeType.value;
  if (type) {
    const error = flowControlNodeRegistry.validateBeforeSave(type, props.nodeConfigForm);
    if (error) {
      message.error(error);
      return;
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
      <div class="flex-1 overflow-y-auto p-2">
        <div v-if="!selectedNode" class="text-center text-gray-500 py-12">
          请选择一个节点
        </div>
        <div v-else :key="selectedNode?.id">
          <!-- 基本信息区：由 NodeBasicInfo 负责，自动根据策略判断是否显示 -->
          <NodeBasicInfo
            v-if="showBasicInfo"
            :node="selectedNode"
            :node-type-display-name="nodeTypeDisplayName"
            @update-node-label="(val) => emit('updateNodeLabel', val)"
          />

          <!-- 配置区：由 NodeConfigRenderer 负责，自动选择专用组件或回退到 FieldRenderer -->
          <NodeConfigRenderer
            class="mt-4"
            :node-type="currentNodeType"
            :node-config-form="nodeConfigForm"
            :required-fields="requiredFields"
            :optional-fields="optionalFields"
            :plugin-groups="pluginGroups"
            :field-renderer-events="fieldRendererEvents"
            @update:config="updateConfig"
          />
        </div>
      </div>
    </div>
  </div>
</template>
