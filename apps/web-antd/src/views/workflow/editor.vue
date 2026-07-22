<script lang="ts" setup>
import type { ProjectVO } from '#/api/core/workflow';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, message } from 'ant-design-vue';

import { useTitle } from '@vueuse/core';

import { useTabbarStore } from '@vben/stores';

import { useWorkflowStore } from '#/store/workflow';

import Canvas from './components/Canvas.vue';
import ConfigPanel from './components/ConfigPanel.vue';
import LeftPanel from './components/LeftPanel.vue';
import NodeSelectModal from './components/NodeSelectModal.vue';
import { useCanvasInteraction } from './composables/useCanvasInteraction';
import { useNodeConfig } from './composables/useNodeConfig';
import { usePluginMeta } from './composables/usePluginMeta';
import { getFlowControlConfig } from './config/workflow-node-config';
import {
  convertFlowModelToWorkflow,
  buildFlowSavePayload,
} from './utils/flowModelConverter';
import { validateAllNodes } from './composables/useNodeConfig';

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
} = useNodeConfig(
  pluginMetaCache,
  loadPluginMeta,
  isTaskRef,
  resolveRef,
  pluginGroups,
);

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
  selectConnection,
  showConnectionContextMenu,
  showNodeContextMenu,
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
    getGroupBounds,
    updateSwitchCaseKey,
    removeSwitchCaseKey,
    addSwitchCaseKey,
    updatePanOffset,
    updateScale,
    scale,
    panOffset,
    cleanup,
  } = useCanvasInteraction(
  pluginGroupsCache,
  pluginMetaCache,
  loadPluginMeta,
  (nodeId: string) => {
    if (isConfigPanelOpen.value && selectedNode.value?.id === nodeId) {
      handleConfigClose();
    }
  },
  nodeConfigForm,
  selectedNode,
  () => {},
);

const workflowName = ref('未命名流程');
const isLoading = ref(false);
const isPageReady = ref(false);
const isProjectsLoading = ref(false);
const workflowLoaded = ref(false);

watch(
  workflowName,
  (newName) => {
    useTitle(`${newName} - 智能体开发平台`);
    route.meta.title = newName;
    const tabbarStore = useTabbarStore();
    tabbarStore.addTab({
      ...route,
      meta: { ...route.meta, title: newName },
    });
  },
  { immediate: true },
);

const currentProjectName = computed(() => {
  const project = store.projects.find(
    (p: ProjectVO) => p.id === store.projectId,
  );
  return project?.projectName || '';
});

function removeNodeFromCase(fieldKey: string, caseKey: string, index: number) {
  const node = store.currentWorkflow?.nodes.find(
    (n) => n.id === selectedNode.value?.id,
  );
  if (node && node.data.config?.[fieldKey]?.[caseKey]) {
    const items = [...node.data.config[fieldKey][caseKey]];
    const removedItem = items.splice(index, 1)[0];
    node.data.config[fieldKey][caseKey] = items;
    node.data.config[fieldKey] = { ...node.data.config[fieldKey] };
    store.updateNode(node.id, { data: { ...node.data } });
    if (nodeConfigForm[fieldKey]) {
      nodeConfigForm[fieldKey] = { ...node.data.config[fieldKey] };
    }
    if (removedItem?.nodeId && store.currentWorkflow) {
      store.currentWorkflow.edges = (store.currentWorkflow.edges || []).filter(
        (conn) =>
          !(conn.source === node.id && conn.target === removedItem.nodeId),
      );
      connections.value = connections.value.filter(
        (conn) =>
          !(conn.source === node.id && conn.target === removedItem.nodeId),
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
  addCaseKey: (fieldKey: string) =>
    addSwitchCaseKey(selectedNode.value?.id || '', fieldKey),
  updateCaseKey: (fieldKey: string, oldKey: string, newKey: string) =>
    updateSwitchCaseKey(selectedNode.value?.id || '', oldKey, newKey, fieldKey),
  removeCaseKey: (fieldKey: string, caseKey: string) =>
    removeSwitchCaseKey(selectedNode.value?.id || '', caseKey, fieldKey),
  removeNodeFromCase,
  addOnResumeItem,
  updateOnResumeField,
  removeOnResumeItem,
}));

function updateNodeLabel(value: string) {
  const node = store.currentWorkflow?.nodes.find(
    (n) => n.id === selectedNode.value?.id,
  );
  if (node) {
    node.data.label = value;
    store.updateNode(node.id, { data: { ...node.data } });
    const freshNode = store.currentWorkflow?.nodes.find(
      (n) => n.id === selectedNode.value?.id,
    );
    if (freshNode) {
      selectedNode.value = freshNode;
    }
  }
}

function updateNodeId(value: string) {
  const node = store.currentWorkflow?.nodes.find(
    (n) => n.id === selectedNode.value?.id,
  );
  if (node) {
    const sanitized = value.replaceAll(/[^a-zA-Z0-9_-]/g, '');
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
    if (!store.currentWorkflow) {
      message.error('请先创建流程');
      return;
    }

    const validationResult = validateAllNodes(
      store.currentWorkflow.nodes,
      pluginMetaCache.value,
    );

    if (!validationResult.isValid) {
      const errorMessages = validationResult.errors.map(
        (err) => `${err.nodeLabel}：${err.missingFields.join('、')}`,
      );
      message.error(`以下节点存在未填写的必填项：\n${errorMessages.join('\n')}`);
      return;
    }

    store.currentWorkflow.name = workflowName.value;
    store.currentWorkflow.updatedAt = new Date().toISOString();

    const payload = buildFlowSavePayload(store.currentWorkflow, store.projectId, workflowName.value);

    const saved = await store.saveWorkflowToBackend(payload);

    if (saved) {
      message.success('流程已保存');
    } else {
      message.error('保存失败');
    }
  } catch (error) {
    console.error('Failed to save workflow:', error);
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
    connections.value = [];
  }
  message.info('画布已清空');
}

function handleBack() {
  store.setCurrentWorkflow(null);
  router.push('/workflow/list');
}

async function loadProjects() {
  isProjectsLoading.value = true;
  try {
    await store.loadProjects();
  } catch {
    message.error('加载项目列表失败');
  } finally {
    isProjectsLoading.value = false;
  }
}

onMounted(async () => {
  loadPlugins();
  await loadProjects();

  const workflowId = route.params.id as string;
  if (workflowId) {
    const parsedBackendId = Number.parseInt(
      workflowId.replace('workflow-', ''),
    );
    if (!Number.isNaN(parsedBackendId)) {
      const detail = await store.loadWorkflowDetail(workflowId);
      if (detail) {
        const restoredWorkflow = convertFlowModelToWorkflow(
          detail.flowModel || { tasks: [] },
          workflowId,
          detail.description || '未命名流程',
          detail.folderId,
          detail.flowId,
          pluginGroupsCache.value,
          detail.flowLayout,
        );
        restoredWorkflow.backendId = parsedBackendId;
        store.setCurrentWorkflow(restoredWorkflow);
        workflowName.value = restoredWorkflow.name;
        connections.value = (restoredWorkflow.edges ||
          []) as unknown as typeof connections.value;
        workflowLoaded.value = true;
        setTimeout(() => {
          const nodes = restoredWorkflow.nodes;
          if (nodes.length > 0) {
            const totalX = nodes.reduce((sum, node) => sum + node.position.x, 0);
            const totalY = nodes.reduce((sum, node) => sum + node.position.y, 0);
            const centerX = totalX / nodes.length + 88;
            const centerY = totalY / nodes.length + 34;

            const canvas = document.querySelector('.workflow-canvas');
            if (canvas) {
              const rect = canvas.getBoundingClientRect();
              const panX = rect.width / 2 - centerX;
              const panY = rect.height / 2 - centerY;
              updatePanOffset({ x: panX, y: panY });
            } else {
              updatePanOffset({ x: 0, y: 0 });
            }
          } else {
            updatePanOffset({ x: 0, y: 0 });
          }
        }, 200);
        return;
      }
    }
    const workflow = store.findWorkflowById(workflowId);
    if (workflow) {
      store.setCurrentWorkflow(workflow);
      workflowName.value = workflow.name;
      connections.value = (workflow.edges ||
        []) as unknown as typeof connections.value;
    } else {
      const newWorkflow = store.createWorkflow('未命名流程');
      store.setCurrentWorkflow(newWorkflow);
    }
  } else {
    if (store.currentWorkflow && store.currentWorkflow.id) {
      workflowName.value = store.currentWorkflow.name;
      connections.value = (store.currentWorkflow.edges ||
        []) as unknown as typeof connections.value;
      workflowLoaded.value = true;
    } else {
      const newWorkflow = store.createWorkflow('未命名流程');
      store.setCurrentWorkflow(newWorkflow);
      workflowLoaded.value = true;
    }
    setTimeout(() => {
      const canvas = document.querySelector('.workflow-canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        updatePanOffset({ x: rect.width / 2 - 2000, y: rect.height / 2 - 2000 });
      }
    }, 100);
  }

  window.addEventListener('keydown', handleKeyDown);
  setTimeout(() => {
    isPageReady.value = true;
  }, 0);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  cleanup();
});
</script>

<template>
  <div class="workflow-editor flex flex-col bg-background overflow-hidden">
    <header
      class="bg-header border-b border-border px-6 py-3 flex items-center justify-between"
    >
      <div class="flex items-center gap-4 flex-nowrap">
        <Button type="text" @click="handleBack">
          <IconifyIcon icon="mdi:arrow-left" :size="16" />
          返回列表
        </Button>
        <div class="h-6 w-px bg-border"></div>
        <div class="flex items-center gap-2 whitespace-nowrap">
          <span class="text-sm text-muted-foreground">项目：</span>
          <span class="text-sm font-medium text-foreground">{{
            currentProjectName || '加载中...'
          }}</span>
        </div>
        <div class="flex items-center gap-2 whitespace-nowrap">
          <span class="text-sm text-muted-foreground">流程名称：</span>
          <Input
            v-model:value="workflowName"
            class="w-48 flex-shrink-0"
            size="small"
            placeholder="请输入流程名称"
          />
        </div>
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
        @switch-tab="(tab: string) => switchTab(tab as 'task' | 'trigger')"
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
          :get-group-bounds="getGroupBounds"
          :scale="scale"
          :pan-offset="panOffset"
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
