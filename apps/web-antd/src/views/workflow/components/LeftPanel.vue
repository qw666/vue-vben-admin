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

function getCategoryColor(): string {
  return 'bg-primary';
}
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
          :class="activeTab === 'trigger' ? 'bg-primary/10 text-primary' : 'bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
          @click="emit('switchTab', 'trigger')"
        >
          触发器
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-4 space-y-6">
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
              v-for="node in getFlowControlNodes()"
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
        <div v-for="group in pluginGroups" :key="group.groupKey" class="group-section">
          <div class="h-px bg-gray-100 my-4" />
          <h3 class="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-primary" />
            {{ group.groupName }}
          </h3>
          <div class="space-y-2">
            <div
              v-for="plugin in group.pluginList"
              :key="plugin.type"
              class="flex items-center justify-start px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-200 border border-gray-200 hover:border-primary/50 hover:bg-primary/5 w-full"
              draggable="true"
              @dragstart="(e) => emit('dragStart', e, plugin.type)"
            >
              <div class="flex items-center gap-2">
                <div
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-primary-foreground bg-gradient-to-br from-primary to-primary-600"
                >
                  <IconifyIcon :icon="plugin.icon" :size="14" />
                </div>
                <span class="font-medium text-sm text-gray-700">{{ plugin.nodeName }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
