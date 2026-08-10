<script lang="ts" setup>
import { computed } from 'vue';

import FieldRenderer from './FieldRenderer.vue';
import { flowControlNodeRegistry } from '../nodes/FlowControlNodeRegistry';

const props = defineProps<{
  nodeType: string;
  nodeConfigForm: Record<string, any>;
  requiredFields: any[];
  optionalFields: any[];
  pluginGroups: any[];
  fieldRendererEvents: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'update:config'): void;
}>();

/**
 * 获取当前节点的专用配置组件
 * 查询顺序：1. 节点策略的 getConfigComponent() 2. 配置组件注册表
 */
const configComponent = computed(() => {
  if (!props.nodeType) return null;
  return flowControlNodeRegistry.getConfigComponent(props.nodeType);
});

/**
 * 更新配置时触发保存
 */
function handleUpdateConfig() {
  emit('update:config');
}
</script>

<template>
  <div>
  <!-- 专用组件渲染 -->
  <component
    v-if="configComponent"
    :is="configComponent"
    :node-config-form="nodeConfigForm"
    @update:config="handleUpdateConfig"
  />

  <!-- 通用 FieldRenderer 回退渲染 -->
  <template v-else>
    <!-- 必填项 -->
    <div v-if="requiredFields.length > 0" class="mb-6">
      <div class="flex items-center gap-2 mb-3">
        <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
        <span class="text-sm font-semibold text-gray-700">必填项</span>
      </div>
      <div class="space-y-4">
        <div
          v-for="field in requiredFields"
          :key="field.props.key"
          class="border-l-2 border-red-400 pl-3"
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

    <!-- 选填项 -->
    <div v-if="optionalFields.length > 0">
      <template v-if="flowControlNodeRegistry.getShowBasicInfo(nodeType)">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
          <span class="text-sm font-semibold text-gray-700">选填项</span>
        </div>
      </template>
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

    <!-- 无配置项提示 -->
    <div
      v-if="requiredFields.length === 0 && optionalFields.length === 0"
      class="text-center text-gray-500 py-4"
    >
      该节点暂无配置项
    </div>
  </template>
  </div>
</template>
