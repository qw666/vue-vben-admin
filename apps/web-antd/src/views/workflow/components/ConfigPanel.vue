<script lang="ts" setup>
import { Button, Input, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import FieldRenderer from './FieldRenderer.vue';

defineProps<{
  isOpen: boolean;
  width: number;
  isResizing: boolean;
  isMetaLoading: boolean;
  selectedNode: any;
  nodeConfigForm: Record<string, any>;
  pluginGroups: any[];
  currentNodeMeta: any;
  requiredFields: any[];
  optionalFields: any[];
  fieldRendererEvents: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'startResize', event: MouseEvent): void;
  (e: 'saveConfig'): void;
}>();
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
      :style="{ width: width + 'px' }"
    >
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-800">节点配置</h2>
        <Button type="text" @click="emit('close')">
          <IconifyIcon icon="mdi:close" :size="18" />
        </Button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div v-if="isMetaLoading" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
        <div v-else-if="!selectedNode" class="text-center text-gray-500 py-12">
          请选择一个节点
        </div>
        <div v-else>
          <div class="p-4 bg-gray-50 rounded-lg">
            <div class="text-sm text-gray-500">节点ID</div>
            <Input
              v-model:value="selectedNode.id"
              class="mt-1"
              size="small"
              placeholder="请输入节点ID"
            />
          </div>
          <div class="p-4 bg-gray-50 rounded-lg">
            <div class="text-sm text-gray-500">节点名称</div>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-base font-medium text-gray-800">{{ selectedNode.data.label }}</span>
              <Tooltip v-if="currentNodeMeta?.description" :title="currentNodeMeta.description">
                <IconifyIcon icon="mdi:help-circle" :size="16" class="text-gray-400 cursor-help" />
              </Tooltip>
            </div>
          </div>
          <div class="p-4 bg-gray-50 rounded-lg">
            <div class="text-sm text-gray-500">节点类型</div>
            <div class="text-base text-gray-800">{{ selectedNode.data.type }}</div>
          </div>
          <div v-if="currentNodeMeta?.parsedSchema?.description" class="p-4 bg-blue-50 rounded-lg">
            <div class="text-sm text-blue-600 font-medium mb-1">配置说明</div>
            <div class="text-sm text-blue-800">{{ currentNodeMeta.parsedSchema.description }}</div>
          </div>
          <div v-if="requiredFields.length > 0" class="mb-6">
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
          </div>
          <div v-if="requiredFields.length === 0 && optionalFields.length === 0" class="text-center text-gray-500 py-4">
            该节点暂无配置项
          </div>
        </div>
      </div>
      <div class="p-4 border-t border-gray-200">
        <Button type="primary" block @click="emit('saveConfig')">保存配置</Button>
      </div>
    </div>
  </div>
</template>
