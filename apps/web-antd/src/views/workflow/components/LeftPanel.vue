<script lang="ts" setup>
import { computed } from 'vue';
import { IconifyIcon } from '@vben/icons';
import { getFlowControlNodes } from '../config/workflow-node-config';
import { resolveNodeIcon } from '../utils/nodeIcon';

const props = defineProps<{
  activeTab: string;
  isPluginLoading: boolean;
  pluginGroups: any[];
}>();

const emit = defineEmits<{
  (e: 'switchTab', tab: string): void;
  (e: 'dragStart', event: DragEvent, nodeType: string): void;
}>();

const flowControlNodes = computed(() => {
  return getFlowControlNodes().filter(
    (node) => node.type !== 'idp_core_flow_Start' && 
             node.type !== 'idp_core_flow_End' &&
             node.type !== 'idp_core_http_Request' &&
             node.type !== 'idp_scripts_python_Script'
  );
});

const httpRequestNode = computed(() => {
  return getFlowControlNodes().find((node) => node.type === 'idp_core_http_Request');
});

const codeNode = computed(() => {
  return getFlowControlNodes().find((node) => node.type === 'idp_scripts_python_Script');
});

// OutputValues：从前端策略注册表获取（OutputValues.node.ts 已注册策略）
const outputValuesNode = computed(() => {
  return getFlowControlNodes().find((node) => node.type === 'idp_core_output_OutputValues');
});

/** 将前端策略节点放入"工具"分组（不存在则创建） */
function ensureNodeInToolsGroup(
  groups: any[],
  node: { type: string; nodeName: string; icon: string; description: string } | undefined,
) {
  if (!node) return;
  const pluginItem = {
    type: node.type,
    nodeName: node.nodeName,
    icon: node.icon,
    description: node.description,
  };
  const toolsGroup = groups.find((g: any) => g.groupName === '工具' || g.groupKey === 'tools');
  if (toolsGroup) {
    toolsGroup.pluginList = toolsGroup.pluginList || [];
    const exists = toolsGroup.pluginList.find((p: any) => p.type === node.type);
    if (!exists) {
      toolsGroup.pluginList.push(pluginItem);
    }
  } else {
    groups.push({
      groupKey: 'tools',
      groupName: '工具',
      pluginList: [pluginItem],
    });
  }
}

const mergedPluginGroups = computed(() => {
  const groups = [...props.pluginGroups];

  // 过滤掉 OutputValues（后面单独放到工具分组）
  for (const group of groups) {
    if (group.pluginList) {
      group.pluginList = group.pluginList.filter((p: any) => p.type !== 'idp_core_output_OutputValues');
    }
  }

  // 将前端策略节点放入工具分组
  ensureNodeInToolsGroup(groups, httpRequestNode.value);
  ensureNodeInToolsGroup(groups, codeNode.value);
  ensureNodeInToolsGroup(groups, outputValuesNode.value);

  // 调整分组顺序：工具分组移到流程控制分组后面
  const toolsIdx = groups.findIndex((g: any) => g.groupName === '工具' || g.groupKey === 'tools');
  if (toolsIdx > 0) {
    const [toolsGroup] = groups.splice(toolsIdx, 1);
    groups.unshift(toolsGroup);
  }

  return groups;
});
</script>

<template>
  <div class="w-48 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
    <div class="flex-shrink-0 px-4 py-3">
      <div class="flex gap-2">
        <button
          class="flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200"
          :class="activeTab === 'task' ? 'bg-primary/10 text-primary' : 'bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
          @click="emit('switchTab', 'task')"
        >
          节点
        </button>
        <button
          class="flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200"
          :class="activeTab === 'template' ? 'bg-primary/10 text-primary' : 'bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
          @click="emit('switchTab', 'template')"
        >
          模板
        </button>
      </div>
    </div>
    <div class="h-px bg-gray-100" />
    <div class="flex-1 overflow-y-auto p-4 space-y-6">
      <div v-if="activeTab === 'template'" class="text-center text-gray-500 py-12">
        暂无模板
      </div>
      <template v-else>
        <div v-if="isPluginLoading" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
        <div v-else>
          <div class="group-section">
            <h3 class="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-primary" />
              流程控制
            </h3>
            <div class="space-y-2">
              <div
                v-for="node in flowControlNodes"
                :key="node.type"
                class="flex items-center justify-start px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-200 border border-gray-200 hover:border-primary/50 hover:bg-primary/5 w-full"
                draggable="true"
                @dragstart="(e) => emit('dragStart', e, node.type)"
              >
                <div class="flex items-center gap-2">
                  <div
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-primary-foreground bg-gradient-to-br from-primary to-primary-600"
                  >
                    <IconifyIcon :icon="node.icon" :size="14" />
                  </div>
                  <span class="font-medium text-sm text-gray-700">{{ node.nodeName }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-for="group in mergedPluginGroups" :key="group.groupKey" class="group-section">
            <div class="h-px bg-gray-100 my-4" />
            <h3 class="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-primary" />
              {{ group.groupName }}
            </h3>
            <div class="space-y-2">
              <div
                v-for="plugin in group.pluginList"
                :key="plugin?.type"
                v-show="plugin && plugin.type"
                class="flex items-center justify-start px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-200 border border-gray-200 hover:border-primary/50 hover:bg-primary/5 w-full"
                draggable="true"
                @dragstart="(e) => emit('dragStart', e, plugin.type)"
              >
                <div class="flex items-center gap-2">
                  <div
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-primary-foreground bg-gradient-to-br from-primary to-primary-600"
                  >
                    <IconifyIcon :icon="resolveNodeIcon(plugin.icon)" :size="14" />
                  </div>
                  <span class="font-medium text-sm text-gray-700">{{ plugin.nodeName }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
