<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Button, message, Tooltip, Input, Textarea, Select, Switch, InputNumber } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import { useWorkflowStore } from '#/store/workflow';
import { usePluginMeta } from './composables/usePluginMeta';
import { useNodeConfig } from './composables/useNodeConfig';
import { useCanvasInteraction } from './composables/useCanvasInteraction';
import FieldRenderer from './components/FieldRenderer.vue';

const router = useRouter();
const route = useRoute();
const store = useWorkflowStore();

const {
  isPluginLoading,
  isMetaLoading,
  activeTab,
  pluginGroups,
  pluginGroupsCache,
  isTaskRef,
  resolveRef,
  loadPlugins,
  switchTab,
  loadPluginMeta,
  pluginMetaCache,
} = usePluginMeta();

const {
  selectedNode,
  nodeConfigForm,
  isConfigPanelOpen,
  configPanelWidth,
  isResizing,
  showNodeSelectModal,
  currentArrayFieldKey,
  currentArrayIndex,
  selectedChildNodeType,
  selectedChildNodeMeta,
  childNodeConfigForm,
  selectedChildNodeLabel,
  handleNodeDoubleClick,
  handleConfigClose,
  startResize,
  addArrayItem,
  removeArrayItem,
  addStringArrayItem,
  addNumberArrayItem,
  addObjectItem,
  updateObjectKey,
  updateObjectValue,
  removeObjectItem,
  updateArrayItemValue,
  currentNodeMeta,
  requiredFields,
  optionalFields,
  handleSaveConfig,
  openNodeSelectModal,
  closeNodeSelectModal,
  selectChildNode,
  confirmAddChildNode,
  editChildNode,
  confirmEditChildNode,
} = useNodeConfig(pluginMetaCache, loadPluginMeta, isTaskRef, resolveRef, pluginGroups);

const {
  isDraggingNode,
  draggingNodeId,
  isConnecting,
  connections,
  selectedConnectionId,
  contextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  startNodeDrag,
  startConnection,
  deleteConnection,
  selectConnection,
  showConnectionContextMenu,
  showNodeContextMenu,
  closeContextMenu,
  deleteSelectedConnection,
  deleteSelectedNode,
  handleCanvasClick,
  handleKeyDown,
  handleCanvasMouseLeave,
  getConnectionPath,
  getTempLinePath,
} = useCanvasInteraction(pluginGroupsCache, pluginMetaCache, loadPluginMeta);

const workflowName = ref('未命名流程');
const isLoading = ref(false);
const isPageReady = ref(false);

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
      connections.value = workflow.edges || [];
    }
  } else {
    const newWorkflow = store.createWorkflow('未命名流程');
    store.setCurrentWorkflow(newWorkflow);
  }
  window.addEventListener('keydown', handleKeyDown);
  setTimeout(() => {
    isPageReady.value = true;
  }, 0);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-100">
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <Button type="text" @click="handleBack">
          <IconifyIcon icon="mdi:arrow-left" :size="16" />
          返回列表
        </Button>
        <div class="h-6 w-px bg-gray-200"></div>
        <Input
          v-model:value="workflowName"
          class="w-48"
          size="small"
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

    <div class="flex-1 flex overflow-hidden" style="height: 100%;">
      <div class="w-64 bg-white border-r border-gray-200 flex flex-col" style="height: 100%;">
        <div class="border-b border-gray-200 flex-shrink-0">
          <div class="flex">
            <button
              class="flex-1 py-3 text-sm font-medium transition-colors relative"
              :class="activeTab === 'task' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
              @click="switchTab('task')"
            >
              节点
              <span v-if="activeTab === 'task'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
            </button>
            <button
              class="flex-1 py-3 text-sm font-medium transition-colors relative"
              :class="activeTab === 'trigger' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
              @click="switchTab('trigger')"
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

      <div class="flex-1 flex overflow-hidden min-h-0">
        <div
          class="flex-1 relative bg-gray-50 workflow-canvas overflow-auto"
          @drop="onDrop"
          @dragover="onDragOver"
          @mouseleave="handleCanvasMouseLeave"
          @click="handleCanvasClick"
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

          <div class="absolute inset-0" style="z-index: 5;">
            <svg class="w-full h-full">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                </marker>
              </defs>
              <g>
                <path
                  v-for="conn in connections"
                  :key="conn.id"
                  :d="getConnectionPath(conn.source, conn.target)"
                  fill="none"
                  stroke="transparent"
                  stroke-width="6"
                  stroke-linecap="round"
                  class="cursor-pointer"
                  @click="selectConnection(conn.id)"
                  @contextmenu.prevent="showConnectionContextMenu($event, conn.id)"
                  style="pointer-events: stroke;"
                />
                <path
                  v-for="conn in connections"
                  :key="'line-' + conn.id"
                  :d="getConnectionPath(conn.source, conn.target)"
                  fill="none"
                  stroke="#64748b"
                  stroke-width="1.5"
                  marker-end="url(#arrowhead)"
                  style="pointer-events: none;"
                />
              </g>
              <path
                v-if="isConnecting"
                :d="getTempLinePath()"
                fill="none"
                stroke="#3b82f6"
                stroke-width="2"
                stroke-dasharray="5,5"
                style="pointer-events: none;"
              />
            </svg>
          </div>

          <div v-if="store.currentWorkflow?.nodes.length === 0" class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-center">
              <div class="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
                <IconifyIcon icon="mdi:mouse-pointer-click" :size="48" class="text-gray-400" />
              </div>
              <h3 class="text-xl font-medium text-gray-600 mb-2">从左侧拖拽节点到这里</h3>
              <p class="text-gray-400">双击节点可编辑配置</p>
            </div>
          </div>

          <div
            v-for="node in store.currentWorkflow?.nodes"
            :key="node.id"
            class="absolute cursor-move select-none z-10"
            :class="{ 'z-30': isDraggingNode && draggingNodeId === node.id }"
            :style="{ left: node.position.x + 'px', top: node.position.y + 'px' }"
            @mousedown="startNodeDrag($event, node.id)"
            @dblclick="handleNodeDoubleClick(node)"
            @contextmenu.prevent="showNodeContextMenu($event, node.id)"
          >
            <div class="flex flex-col items-center justify-center px-4 py-3 rounded-lg border-2 bg-white shadow-md hover:shadow-lg transition-shadow relative">
              <div
                class="node-port absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-green-500 border-2 border-white cursor-crosshair hover:bg-green-600 hover:scale-125 transition-all z-20 shadow-sm"
                :data-node-id="node.id"
                :data-port-type="'input'"
                title="输入端口"
              />
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
              <div
                class="node-port absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-white cursor-crosshair hover:bg-blue-600 hover:scale-125 transition-all z-20 shadow-sm"
                :data-node-id="node.id"
                :data-port-type="'output'"
                @mousedown="startConnection($event, node.id)"
                title="输出端口"
              />
            </div>
          </div>
        </div>

        <div
          class="w-2 flex-shrink-0 cursor-col-resize flex items-center justify-center hover:bg-gray-100 transition-colors relative"
          @mousedown="startResize"
        >
          <div class="flex flex-col gap-1.5">
            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
          </div>
        </div>
        <div
          v-if="isConfigPanelOpen"
          class="bg-white border-l border-gray-200 flex flex-col flex-shrink-0 overflow-hidden"
          :style="{ width: configPanelWidth + 'px' }"
        >
          <div class="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-800">节点配置</h2>
            <Button type="text" @click="handleConfigClose">
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
                      @add-object-item="addObjectItem"
                      @update-object-key="updateObjectKey"
                      @update-object-value="updateObjectValue"
                      @remove-object-item="removeObjectItem"
                      @add-string-array-item="addStringArrayItem"
                      @add-number-array-item="addNumberArrayItem"
                      @add-array-item="addArrayItem"
                      @remove-array-item="removeArrayItem"
                      @update-array-item-value="updateArrayItemValue"
                      @open-node-select-modal="openNodeSelectModal"
                      @edit-child-node="editChildNode"
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
                  <div v-for="field in optionalFields" :key="field.props.key" class="border-l-2 border-gray-200 pl-3">
                    <FieldRenderer
                      :field="field"
                      :node-config-form="nodeConfigForm"
                      :plugin-groups="pluginGroups"
                      @add-object-item="addObjectItem"
                      @update-object-key="updateObjectKey"
                      @update-object-value="updateObjectValue"
                      @remove-object-item="removeObjectItem"
                      @add-string-array-item="addStringArrayItem"
                      @add-number-array-item="addNumberArrayItem"
                      @add-array-item="addArrayItem"
                      @remove-array-item="removeArrayItem"
                      @update-array-item-value="updateArrayItemValue"
                      @open-node-select-modal="openNodeSelectModal"
                      @edit-child-node="editChildNode"
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
            <Button type="primary" block @click="handleSaveConfig">保存配置</Button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showNodeSelectModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-[900px] h-[600px] flex flex-col">
        <div class="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-800">选择子节点</h2>
          <Button type="text" @click="closeNodeSelectModal">
            <IconifyIcon icon="mdi:close" :size="18" />
          </Button>
        </div>
        <div class="flex-1 flex overflow-hidden">
          <div class="w-1/2 border-r border-gray-200 overflow-y-auto p-4">
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
                    class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border"
                    :class="selectedChildNodeType === plugin.type ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'"
                    @click="selectChildNode(plugin.type)"
                  >
                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      :class="getCategoryColor(group.groupName)"
                    >
                      <IconifyIcon :icon="plugin.icon" :size="20" />
                    </div>
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-800">{{ plugin.nodeName }}</div>
                      <div class="text-xs text-gray-500">{{ plugin.description }}</div>
                    </div>
                    <div v-if="selectedChildNodeType === plugin.type">
                      <IconifyIcon icon="mdi:check-circle" :size="18" class="text-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="w-1/2 overflow-y-auto p-4">
            <div v-if="!selectedChildNodeType" class="flex items-center justify-center h-full text-gray-500">
              请从左侧选择一个节点
            </div>
            <div v-else-if="isMetaLoading" class="flex items-center justify-center h-full">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
            <div v-else>
              <div class="p-4 bg-blue-50 rounded-lg mb-4">
                <div class="flex items-center gap-2">
                  <div
                    class="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    :class="getCategoryColor(pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === selectedChildNodeType)?.category || '基础')"
                  >
                    <IconifyIcon :icon="pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === selectedChildNodeType)?.icon" :size="20" />
                  </div>
                  <div>
                    <div class="text-base font-medium text-gray-800">{{ selectedChildNodeLabel }}</div>
                    <div class="text-xs text-gray-500">{{ selectedChildNodeType }}</div>
                  </div>
                </div>
                <div v-if="selectedChildNodeMeta?.description" class="mt-2 text-sm text-blue-800">
                  {{ selectedChildNodeMeta.description }}
                </div>
              </div>
              <div v-if="selectedChildNodeMeta?.parsedSchema?.description" class="p-4 bg-gray-50 rounded-lg mb-4">
                <div class="text-sm text-gray-600 font-medium mb-1">配置说明</div>
                <div class="text-sm text-gray-800">{{ selectedChildNodeMeta.parsedSchema.description }}</div>
              </div>
              <div v-if="selectedChildNodeMeta?.formProperties">
                <div v-if="Object.keys(selectedChildNodeMeta.formProperties).filter((k: string) => k !== '$schema').length === 0" class="text-center text-gray-500 py-4">
                  该节点暂无配置项
                </div>
                <div v-else>
                  <div class="space-y-4">
                    <div v-for="(prop, propKey) in selectedChildNodeMeta.formProperties" :key="propKey" v-show="propKey !== '$schema'">
                      <div class="flex items-center justify-between mb-1">
                        <label class="text-sm font-medium text-gray-700">
                          {{ prop.title || propKey }}
                          <span v-if="prop.$required" class="text-red-500 ml-1">*</span>
                        </label>
                        <div class="flex items-center gap-2">
                          <span v-if="prop.$dynamic === true" class="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded">动态</span>
                          <Tooltip v-if="prop.description" :title="prop.description">
                            <IconifyIcon icon="mdi:help-circle" :size="14" class="text-gray-400" />
                          </Tooltip>
                        </div>
                      </div>
                      <Input
                        v-if="prop.type === 'string' || prop.anyOf"
                        v-model:value="childNodeConfigForm[propKey]"
                        :placeholder="prop.$dynamic === true ? '支持动态表达式，如 {{ variable }}' : prop.description || '请输入'"
                        class="w-full"
                        size="small"
                      />
                      <InputNumber
                        v-else-if="prop.type === 'number' || prop.type === 'integer'"
                        v-model:value="childNodeConfigForm[propKey]"
                        :min="prop.minimum"
                        class="w-full"
                        size="small"
                      />
                      <Switch
                        v-else-if="prop.type === 'boolean'"
                        :checked="childNodeConfigForm[propKey]"
                        @change="(val: any) => { childNodeConfigForm[propKey] = val; }"
                      />
                      <Textarea
                        v-else-if="prop.type === 'object' || prop.type === 'array'"
                        :value="typeof childNodeConfigForm[propKey] === 'string' ? childNodeConfigForm[propKey] : JSON.stringify(childNodeConfigForm[propKey], null, 2)"
                        @input="(e: any) => { childNodeConfigForm[propKey] = e.target.value; }"
                        :placeholder="prop.description || '请输入JSON格式数据'"
                        rows="3"
                        class="w-full"
                        size="small"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <Button @click="closeNodeSelectModal">取消</Button>
          <Button type="primary" @click="currentArrayIndex >= 0 ? confirmEditChildNode() : confirmAddChildNode()">
            {{ currentArrayIndex >= 0 ? '确定修改' : '确定添加' }}
          </Button>
        </div>
      </div>
    </div>

    <div
      v-if="contextMenu.show"
      class="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[120px]"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <div
        v-if="contextMenu.type === 'node'"
        class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
        @click="deleteSelectedNode"
      >
        删除节点
      </div>
      <div
        v-if="contextMenu.type === 'connection'"
        class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
        @click="deleteSelectedConnection"
      >
        删除连线
      </div>
    </div>
  </div>
</template>
