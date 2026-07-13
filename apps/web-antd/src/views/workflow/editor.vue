<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

import { Button, message, Tooltip, Drawer, Input } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import { useWorkflowStore } from '#/store/workflow';
import { getPluginTree } from '#/api';

const router = useRouter();
const route = useRoute();
const store = useWorkflowStore();

const workflowName = ref('未命名流程');
const isLoading = ref(false);
const isConfigOpen = ref(false);
const selectedNode = ref<any>(null);
const nodeLabel = ref('');

const pluginGroups = ref<any[]>([]);
const isPluginLoading = ref(false);

const colorMap: Record<string, string> = {
  '基础': 'bg-green-500',
  'AI': 'bg-purple-500',
  '工具': 'bg-orange-500',
  '控制': 'bg-yellow-500',
  '数据': 'bg-indigo-500',
};

function getCategoryColor(category: string): string {
  return colorMap[category] || 'bg-gray-500';
}

const categories = computed(() => {
  return pluginGroups.value.map(g => g.groupName);
});

function nodesByCategory(category: string) {
  const group = pluginGroups.value.find(g => g.groupName === category);
  return group ? group.pluginList : [];
}

async function loadPlugins() {
  isPluginLoading.value = true;
  try {
    const response = await getPluginTree('task');
    if (response) {
      pluginGroups.value = response;
    }
  } catch (error) {
    console.error('Failed to load plugins:', error);
    message.error('加载节点列表失败');
  } finally {
    isPluginLoading.value = false;
  }
}

function onDragStart(e: DragEvent, nodeType: string) {
  if (e.dataTransfer) {
    e.dataTransfer.setData('application/json', JSON.stringify({ nodeType }));
    e.dataTransfer.effectAllowed = 'move';
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  const canvas = e.currentTarget as HTMLElement;
  const rect = canvas.getBoundingClientRect();
  const position = {
    x: e.clientX - rect.left - 70,
    y: e.clientY - rect.top - 30,
  };

  if (e.dataTransfer) {
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      const { nodeType } = JSON.parse(data);
      let template: any = null;
      for (const group of pluginGroups.value) {
        template = group.pluginList.find((p: any) => p.type === nodeType);
        if (template) {
          template.category = group.groupName;
          break;
        }
      }
      if (template && store.currentWorkflow) {
        const newNode = {
          id: `node-${Date.now()}`,
          type: 'custom',
          position,
          data: {
            label: template.nodeName,
            type: template.type,
            icon: template.icon,
            description: template.nodeCategory,
          },
        };
        store.currentWorkflow.nodes.push(newNode);
        message.success(`已添加 ${template.nodeName} 节点`);
      }
    }
  }
}

function handleNodeClick(node: any) {
  selectedNode.value = node;
  nodeLabel.value = node.data.label;
  isConfigOpen.value = true;
}

function handleConfigClose() {
  isConfigOpen.value = false;
  selectedNode.value = null;
}

function handleSaveConfig() {
  if (selectedNode.value) {
    selectedNode.value.data.label = nodeLabel.value;
    message.success('节点配置已更新');
  }
}

async function handleSave() {
  isLoading.value = true;
  try {
    if (store.currentWorkflow) {
      store.currentWorkflow.name = workflowName.value;
      store.currentWorkflow.updatedAt = new Date().toISOString();
      store.saveWorkflow(store.currentWorkflow);
    }
    message.success('流程已保存');
  } catch (error) {
    message.error('保存失败');
  } finally {
    isLoading.value = false;
  }
}

async function handleRun() {
  message.info('正在运行流程...');
  setTimeout(() => {
    message.success('流程运行成功');
  }, 1500);
}

function handleClear() {
  if (store.currentWorkflow) {
    store.currentWorkflow.nodes = [];
    store.currentWorkflow.edges = [];
  }
  message.info('画布已清空');
}

function handleBack() {
  router.push('/workflow/list');
}

onMounted(() => {
  store.initMockData();
  loadPlugins();
  const workflowId = route.params.id as string;
  if (workflowId) {
    const workflow = store.getWorkflowById(workflowId);
    if (workflow) {
      store.setCurrentWorkflow(workflow);
      workflowName.value = workflow.name;
    }
  } else {
    const newWorkflow = store.createWorkflow('未命名流程');
    store.setCurrentWorkflow(newWorkflow);
  }
});
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-100">
    <header class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div class="flex items-center gap-4">
        <Button type="text" @click="handleBack">
          返回列表
        </Button>
        <input
          v-model="workflowName"
          type="text"
          class="text-xl font-semibold bg-transparent border-none outline-none w-64"
          placeholder="流程名称"
        />
      </div>
      <div class="flex items-center gap-2">
        <Button type="text" @click="handleClear">
          <IconifyIcon icon="mdi:trash-can" :size="16" />
          清空画布
        </Button>
        <Button type="primary" :loading="isLoading" @click="handleSave">
          <IconifyIcon icon="mdi:content-save" :size="16" />
          保存流程
        </Button>
        <Button type="primary" @click="handleRun">
          <IconifyIcon icon="mdi:play" :size="16" />
          运行流程
        </Button>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <div class="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div class="p-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-800">节点列表</h2>
          <p class="text-sm text-gray-500 mt-1">拖拽节点到画布</p>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-if="isPluginLoading" class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
          <div v-else>
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
                  @dragstart="onDragStart($event, plugin.type)"
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

      <div
        class="flex-1 relative bg-gray-50"
        @drop="onDrop"
        @dragover="onDragOver"
      >
        <div class="absolute inset-0 pointer-events-none">
          <svg class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="gray" stroke-width="0.5" opacity="0.3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div v-if="store.currentWorkflow?.nodes.length === 0" class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <div class="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
              <IconifyIcon icon="mdi:mouse-pointer-click" :size="48" class="text-gray-400" />
            </div>
            <h3 class="text-xl font-medium text-gray-600 mb-2">从左侧拖拽节点到这里</h3>
            <p class="text-gray-400">开始构建你的工作流</p>
          </div>
        </div>

        <div
          v-for="node in store.currentWorkflow?.nodes"
          :key="node.id"
          class="absolute cursor-pointer select-none"
          :style="{ left: node.position.x + 'px', top: node.position.y + 'px' }"
          @click="handleNodeClick(node)"
        >
          <div class="flex flex-col items-center justify-center px-4 py-3 rounded-lg border-2 bg-white shadow-md hover:shadow-lg transition-shadow">
            <div class="flex items-center gap-2 mb-1">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-white"
                :class="getCategoryColor(node.data.description || '基础')"
              >
                <IconifyIcon :icon="node.data.icon" :size="16" />
              </div>
              <span class="font-medium text-sm text-gray-700">{{ node.data.label }}</span>
            </div>
            <div class="flex gap-1 mt-2">
              <div class="w-2 h-2 rounded-full bg-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <Drawer
      v-model:open="isConfigOpen"
      title="节点属性"
      :width="400"
      @close="handleConfigClose"
    >
      <div v-if="selectedNode" class="space-y-4">
        <div class="p-4 bg-gray-50 rounded-lg">
          <div class="text-sm text-gray-500">节点ID</div>
          <div class="text-base font-mono text-gray-800">{{ selectedNode.id }}</div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">节点名称</label>
          <Input v-model="nodeLabel" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">节点类型</label>
          <div class="text-gray-600 mt-1">{{ selectedNode.data.type }}</div>
        </div>
        <Button type="primary" block @click="handleSaveConfig">保存配置</Button>
      </div>
      <div v-else class="text-center text-gray-500 py-12">
        请选择一个节点以编辑属性
      </div>
    </Drawer>
  </div>
</template>
