<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Button, message, Input } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import { useWorkflowStore } from '#/store/workflow';
import { usePluginMeta } from './composables/usePluginMeta';
import { useNodeConfig } from './composables/useNodeConfig';
import { useCanvasInteraction } from './composables/useCanvasInteraction';
import LeftPanel from './components/LeftPanel.vue';
import Canvas from './components/Canvas.vue';
import ConfigPanel from './components/ConfigPanel.vue';
import NodeSelectModal from './components/NodeSelectModal.vue';
import { getFlowControlConfig } from './config/workflow-node-config';

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
  addOnResumeItem,
  updateOnResumeField,
  removeOnResumeItem,
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
  selectedNodeId,
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
  selectNode,
  handleCanvasClick,
  handleKeyDown,
  handleCanvasMouseLeave,
  getConnectionPath,
  getConnectionColor,
  getTempLinePath,
  getNodePorts,
  updateSwitchCaseKey,
  removeSwitchCaseKey,
  addSwitchCaseKey,
  updatePanOffset,
  updateScale,
  scale,
} = useCanvasInteraction(pluginGroupsCache, pluginMetaCache, loadPluginMeta, (nodeId: string) => {
  if (isConfigPanelOpen && selectedNode.value?.id === nodeId) {
    handleConfigClose();
  }
}, nodeConfigForm, selectedNode, (node: any) => {
  const flowControlConfig = getFlowControlConfig(node.data.type);
  if (flowControlConfig) {
    const freshNode = store.currentWorkflow?.nodes.find(n => n.id === node.id);
    const config = (freshNode?.data.config || node.data.config) || {};

    if (!isConfigPanelOpen.value) {
      selectedNode.value = freshNode || node;
      isConfigPanelOpen.value = true;
    }

    const casesValue = config.cases;
    nodeConfigForm.cases = typeof casesValue === 'object' && casesValue !== null && !Array.isArray(casesValue)
      ? JSON.parse(JSON.stringify(casesValue))
      : {};
    nodeConfigForm.value = config.value || '';
    nodeConfigForm.defaults = Array.isArray(config.defaults) ? [...config.defaults] : [];
    nodeConfigForm.errors = Array.isArray(config.errors) ? [...config.errors] : [];
    nodeConfigForm.finally = Array.isArray(config.finally) ? [...config.finally] : [];
  }
});

const workflowName = ref('未命名流程');
const isLoading = ref(false);
const isPageReady = ref(false);

function updateNodeValue(fieldKey: string, caseKey: string, index: number, value: string) {
  const node = store.currentWorkflow?.nodes.find(n => n.id === selectedNode.value?.id);
  if (node && node.data.config?.[fieldKey]?.[caseKey]) {
    node.data.config[fieldKey][caseKey][index].value = value;
    node.data.config[fieldKey] = { ...node.data.config[fieldKey] };
    store.updateNode(node.id, { data: { ...node.data } });
    if (nodeConfigForm[fieldKey]) {
      nodeConfigForm[fieldKey] = { ...node.data.config[fieldKey] };
    }
  }
}

function removeNodeFromCase(fieldKey: string, caseKey: string, index: number) {
  const node = store.currentWorkflow?.nodes.find(n => n.id === selectedNode.value?.id);
  if (node && node.data.config?.[fieldKey]?.[caseKey]) {
    const items = [...node.data.config[fieldKey][caseKey]];
    const removedItem = items.splice(index, 1)[0];
    node.data.config[fieldKey][caseKey] = items;
    node.data.config[fieldKey] = { ...node.data.config[fieldKey] };
    store.updateNode(node.id, { data: { ...node.data } });
    if (nodeConfigForm[fieldKey]) {
      nodeConfigForm[fieldKey] = { ...node.data.config[fieldKey] };
    }
    if (removedItem?.nodeId) {
      store.currentWorkflow!.edges = (store.currentWorkflow?.edges || []).filter(
        conn => !(conn.source === node.id && conn.target === removedItem.nodeId)
      );
      connections.value = connections.value.filter(
        conn => !(conn.source === node.id && conn.target === removedItem.nodeId)
      );
      store.removeNode(removedItem.nodeId);
    }
  }
}

const fieldRendererEvents = computed(() => ({
  addObjectItem,
  updateObjectKey,
  updateObjectValue,
  removeObjectItem,
  addStringArrayItem,
  addNumberArrayItem,
  addArrayItem,
  removeArrayItem,
  updateArrayItemValue,
  openNodeSelectModal,
  editChildNode,
  addCaseKey: (fieldKey: string) => addSwitchCaseKey(selectedNode.value?.id || '', fieldKey),
  updateCaseKey: (fieldKey: string, oldKey: string, newKey: string) => updateSwitchCaseKey(selectedNode.value?.id || '', oldKey, newKey, fieldKey),
  removeCaseKey: (fieldKey: string, caseKey: string) => removeSwitchCaseKey(selectedNode.value?.id || '', caseKey, fieldKey),
  updateNodeValue,
  removeNodeFromCase,
  addOnResumeItem,
  updateOnResumeField,
  removeOnResumeItem,
}));

function updateNodeLabel(value: string) {
  const node = store.currentWorkflow?.nodes.find(n => n.id === selectedNode.value?.id);
  if (node) {
    node.data.label = value;
    store.updateNode(node.id, { data: { ...node.data } });
  }
}

function updateNodeId(value: string) {
  const node = store.currentWorkflow?.nodes.find(n => n.id === selectedNode.value?.id);
  if (node) {
    const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitized !== value) {
      return;
    }
    const oldId = node.id;
    node.id = value;
    store.updateNode(oldId, { id: value });
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
  <div class="workflow-editor flex flex-col bg-gray-100 overflow-hidden">
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

    <div class="flex-1 flex overflow-hidden h-full">
      <LeftPanel
        class="flex-shrink-0"
        :active-tab="activeTab"
        :is-plugin-loading="isPluginLoading"
        :plugin-groups="pluginGroups"
        @switch-tab="switchTab"
        @drag-start="onDragStart"
      />

      <div class="flex-1 flex overflow-hidden min-h-0">
        <Canvas
          :nodes="store.currentWorkflow?.nodes || []"
          :is-dragging-node="isDraggingNode"
          :dragging-node-id="draggingNodeId"
          :is-connecting="isConnecting"
          :connections="connections"
          :selected-connection-id="selectedConnectionId"
          :selected-node-id="selectedNodeId"
          :context-menu="contextMenu"
          :get-node-ports="getNodePorts"
          :get-connection-path="getConnectionPath"
          :get-connection-color="getConnectionColor"
          :get-temp-line-path="getTempLinePath"
          :scale="scale"
          :config-panel-width="isConfigPanelOpen ? configPanelWidth : 0"
          @drop="onDrop"
          @drag-over="onDragOver"
          @mouse-leave="handleCanvasMouseLeave"
          @canvas-click="handleCanvasClick"
          @start-node-drag="startNodeDrag"
          @select-node="selectNode"
          @node-double-click="handleNodeDoubleClick"
          @node-context-menu="showNodeContextMenu"
          @start-connection="startConnection"
          @select-connection="selectConnection"
          @connection-context-menu="showConnectionContextMenu"
          @delete-selected-node="deleteSelectedNode"
          @delete-selected-connection="deleteSelectedConnection"
          @pan-change="updatePanOffset"
          @scale-change="updateScale"
        />

        <ConfigPanel
          :is-open="isConfigPanelOpen"
          :width="configPanelWidth"
          :is-resizing="isResizing"
          :is-meta-loading="isMetaLoading"
          :selected-node="selectedNode"
          :node-config-form="nodeConfigForm"
          :plugin-groups="pluginGroups"
          :current-node-meta="currentNodeMeta"
          :required-fields="requiredFields"
          :optional-fields="optionalFields"
          :field-renderer-events="fieldRendererEvents"
          @close="handleConfigClose"
          @start-resize="startResize"
          @save-config="handleSaveConfig"
          @update-node-label="updateNodeLabel"
          @update-node-id="updateNodeId"
        />
      </div>
    </div>

    <NodeSelectModal
      :show="showNodeSelectModal"
      :is-plugin-loading="isPluginLoading"
      :is-meta-loading="isMetaLoading"
      :plugin-groups="pluginGroups"
      :selected-child-node-type="selectedChildNodeType"
      :selected-child-node-meta="selectedChildNodeMeta"
      :selected-child-node-label="selectedChildNodeLabel"
      :child-node-config-form="childNodeConfigForm"
      :current-array-index="currentArrayIndex"
      @close="closeNodeSelectModal"
      @select-child-node="selectChildNode"
      @confirm-add="confirmAddChildNode"
      @confirm-edit="confirmEditChildNode"
    />
  </div>
</template>

<style scoped>
.workflow-editor {
  height: calc(100vh - 88px);
  min-height: 0;
}
</style>
