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
  return 'bg-blue-500';
}
</script>

<template>
  <div class="w-64 bg-sidebar border-r border-border flex flex-col overflow-hidden">
    <div class="border-b border-border flex-shrink-0">
      <div class="flex">
        <button
          class="flex-1 py-3 text-sm font-medium transition-colors relative"
          :class="activeTab === 'task' ? 'text-primary-text bg-primary-background-lightest' : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
          @click="emit('switchTab', 'task')"
        >
          节点
          <span v-if="activeTab === 'task'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>
        </button>
        <button
          class="flex-1 py-3 text-sm font-medium transition-colors relative"
          :class="activeTab === 'trigger' ? 'text-primary-text bg-primary-background-lightest' : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
          @click="emit('switchTab', 'trigger')"
        >
          触发器
          <span v-if="activeTab === 'trigger'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>
        </button>
      </div>
      <p class="text-xs text-muted-foreground px-4 py-2">拖拽{{ activeTab === 'task' ? '节点' : '触发器' }}到画布</p>
    </div>
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-if="isPluginLoading" class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
      <div v-else>
        <div>
          <h3 class="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-primary" />
            流程控制
          </h3>
          <div class="space-y-2">
            <div
              v-for="node in getFlowControlNodes()"
              :key="node.type"
              class="flex items-center gap-3 p-3 rounded-lg bg-primary-background-lightest hover:bg-primary-background-lighter cursor-grab active:cursor-grabbing transition-colors border border-primary-border-light"
              draggable="true"
              @dragstart="(e) => emit('dragStart', e, node.type)"
            >
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center text-primary-foreground bg-primary"
              >
                <IconifyIcon :icon="node.icon" :size="20" />
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-card-foreground">{{ node.nodeName }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-for="group in pluginGroups" :key="group.groupKey">
          <h3 class="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-primary" />
            {{ group.groupName }}
          </h3>
          <div class="space-y-2">
            <div
              v-for="plugin in group.pluginList"
              :key="plugin.type"
              class="flex items-center gap-3 p-3 rounded-lg bg-primary-background-lightest hover:bg-primary-background-lighter cursor-grab active:cursor-grabbing transition-colors border border-primary-border-light"
              draggable="true"
              @dragstart="(e) => emit('dragStart', e, plugin.type)"
            >
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center text-primary-foreground bg-primary"
              >
                <IconifyIcon :icon="plugin.icon" :size="20" />
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-card-foreground">{{ plugin.nodeName }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
