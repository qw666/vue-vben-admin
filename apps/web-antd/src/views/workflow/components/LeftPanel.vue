<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';
import { getFlowControlNodes } from '../config/workflow-node-config';

defineProps<{
  activeTab: string;
  isPluginLoading: boolean;
  pluginGroups: any[];
}>();

const emit = defineEmits<{
  (e: 'switchTab', tab: string): void;
  (e: 'dragStart', event: DragEvent, nodeType: string): void;
}>();

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    '流程控制': 'bg-purple-500',
    'HTTP操作': 'bg-blue-500',
    '输出操作': 'bg-green-500',
    '触发器': 'bg-orange-500',
    '基础': 'bg-gray-500',
  };
  return colors[category] || 'bg-gray-500';
}
</script>

<template>
  <div class="w-64 bg-white border-r border-gray-200 flex flex-col" style="height: 100%;">
    <div class="border-b border-gray-200 flex-shrink-0">
      <div class="flex">
        <button
          class="flex-1 py-3 text-sm font-medium transition-colors relative"
          :class="activeTab === 'task' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
          @click="emit('switchTab', 'task')"
        >
          节点
          <span v-if="activeTab === 'task'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
        </button>
        <button
          class="flex-1 py-3 text-sm font-medium transition-colors relative"
          :class="activeTab === 'trigger' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
          @click="emit('switchTab', 'trigger')"
        >
          触发器
          <span v-if="activeTab === 'trigger'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
        </button>
      </div>
      <p class="text-xs text-gray-400 px-4 py-2">拖拽{{ activeTab === 'task' ? '节点' : '触发器' }}到画布</p>
    </div>
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-if="isPluginLoading" class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
      <div v-else>
        <div>
          <h3 class="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-indigo-500" />
            流程控制
          </h3>
          <div class="space-y-2">
            <div
              v-for="node in getFlowControlNodes()"
              :key="node.type"
              class="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 cursor-grab active:cursor-grabbing transition-colors border border-indigo-200"
              draggable="true"
              @dragstart="(e) => emit('dragStart', e, node.type)"
            >
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-indigo-500"
              >
                <IconifyIcon :icon="node.icon" :size="20" />
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-800">{{ node.nodeName }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-for="group in pluginGroups" :key="group.groupKey">
          <h3 class="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full" :class="getCategoryColor(group.groupName)" />
            {{ group.groupName }}
          </h3>
          <div class="space-y-2">
            <div
              v-for="plugin in group.pluginList"
              :key="plugin.type"
              class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-grab active:cursor-grabbing transition-colors border border-gray-200"
              draggable="true"
              @dragstart="(e) => emit('dragStart', e, plugin.type)"
            >
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                :class="getCategoryColor(group.groupName)"
              >
                <IconifyIcon :icon="plugin.icon" :size="20" />
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-800">{{ plugin.nodeName }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
