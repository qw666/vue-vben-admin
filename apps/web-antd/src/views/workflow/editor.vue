<script lang="ts" setup>
import type { ProjectVO } from '#/api/core/workflow';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

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
import { createVarSelectContext, provideVarSelect } from './composables/varSelectContext';
import { useFlowControlNode } from './composables/useFlowControlNode';
import {
  convertFlowModelToWorkflow,
} from './utils/flowModelConverter';
import { useWorkflowInit } from './composables/useWorkflowInit';
import { useWorkflowActions } from './composables/useWorkflowActions';
import { useNodeOperations } from './composables/useNodeOperations';

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
  preloadPluginMeta,
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
  addInputsItem,
  updateInputsField,
  removeInputsItem,
  addTriggersItem,
  updateTriggersField,
  removeTriggersItem,
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

const { getParentNodeFieldInfo, getChildNodeIds } = useFlowControlNode(nodeConfigForm, selectedNode);

const {
  isDraggingNode,
  draggingNodeId,
  isConnecting,
  connections,
  selectedConnectionId,
  selectedNodeId,
  multiSelectedIds,
  isMultiDragging,
  contextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  startDrag,
  startConnection,
  selectConnection,
  showConnectionContextMenu,
  showNodeContextMenu,
  deleteSelectedConnection,
  deleteSelectedNode,
  clearSelection,
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
const isRunning = ref(false);
const isPageReady = ref(false);
const isProjectsLoading = ref(false);
const workflowLoaded = ref(false);
const workflowEnabled = computed(() => {
  return store.currentWorkflow?.enabled !== false;
});

// ===== 容器访问层 =====
const { ensureStartAndEndNodes, centerCanvasOnNodes } = useWorkflowInit(
  connections,
  updatePanOffset,
);

// ===== 工作流操作 =====
const { handleSave, handleRun, handleClear, handleBack } = useWorkflowActions(
  workflowName,
  isLoading,
  isRunning,
  connections,
);

// ===== 节点操作 =====
const { removeNodeFromCase, updateNodeLabel, updateNodeId } = useNodeOperations(
  selectedNode,
  nodeConfigForm,
  connections,
  getParentNodeFieldInfo,
);

// ===== 变量选择器上下文（provide 一次，所有 VarPicker 自动可用）=====
provideVarSelect(
  createVarSelectContext({
    selectedNodeId: computed(() => selectedNode.value?.id || store.selectedNodeId || ''),
    nodes: computed(() => store.currentWorkflow?.nodes || []),
    edges: computed(() => store.currentWorkflow?.edges || []),
  }),
);

watch(
  workflowName,
  (newName) => {
    useTitle(newName);
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
  addInputsItem,
  updateInputsField,
  removeInputsItem,
  addTriggersItem,
  updateTriggersField,
  removeTriggersItem,
}));

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

  const workflowId = route.params.id as string;
  const projectsPromise = loadProjects();
  const detailPromise = workflowId
    ? store.loadWorkflowDetail(workflowId)
    : null;

  await projectsPromise;

  if (workflowId) {
    const parsedBackendId = Number.parseInt(
      workflowId.replace('workflow-', ''),
    );
    if (!Number.isNaN(parsedBackendId)) {
      const detail = await detailPromise;
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
        ensureStartAndEndNodes();
        workflowLoaded.value = true;

        // 批量预加载所有节点的元数据（用于 VarPicker 获取 outputs）
        const nodeTypes = (restoredWorkflow.nodes || [])
          .map((n: any) => n.data?.type)
          .filter((t: string) => t && !t.startsWith('idp_core_flow_'));
        if (nodeTypes.length > 0) {
          // 使用 await 确保元数据加载完成后再继续
          // 这样用户打开节点配置时 pluginMetaCache 已包含 outputs 声明
          await preloadPluginMeta([...new Set(nodeTypes)]);
        }

        setTimeout(() => {
          centerCanvasOnNodes();
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
      ensureStartAndEndNodes();
    } else {
      const newWorkflow = store.createWorkflow('未命名流程');
      store.setCurrentWorkflow(newWorkflow);
    }
  } else {
    if (store.currentWorkflow && store.currentWorkflow.id) {
      workflowName.value = store.currentWorkflow.name;
      connections.value = (store.currentWorkflow.edges ||
        []) as unknown as typeof connections.value;
      ensureStartAndEndNodes();
      workflowLoaded.value = true;
    } else {
      const newWorkflow = store.createWorkflow('未命名流程');
      store.setCurrentWorkflow(newWorkflow);
      workflowLoaded.value = true;
    }
    setTimeout(() => {
      centerCanvasOnNodes();
    }, 200);
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
            placeholder="请输入流程名称"
          />
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5 px-2 py-1 rounded-full" :class="workflowEnabled ? 'bg-green-50' : 'bg-orange-50'">
          <span class="w-2 h-2 rounded-full" :class="workflowEnabled ? 'bg-green-500' : 'bg-orange-500'"></span>
          <span class="text-xs font-medium" :class="workflowEnabled ? 'text-green-700' : 'text-orange-700'">
            {{ workflowEnabled ? '已启用' : '已停用' }}
          </span>
        </div>
        <Button type="text" @click="handleClear">
          <IconifyIcon icon="mdi:trash-can" :size="16" />
          清空画布
        </Button>
        <Button type="primary" :loading="isLoading" @click="handleSave">
          <IconifyIcon icon="mdi:content-save" :size="16" />
          保存流程
        </Button>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden h-full">
      <LeftPanel
        class="flex-shrink-0"
        :active-tab="activeTab"
        :is-plugin-loading="isPluginLoading"
        :plugin-groups="pluginGroups"
        @switch-tab="(tab: string) => switchTab(tab as 'task' | 'template')"
        @drag-start="onDragStart"
      />

      <div class="flex-1 flex overflow-hidden min-h-0">
        <Canvas
          :nodes="store.currentWorkflow?.nodes || []"
          :is-dragging-node="isDraggingNode"
          :dragging-node-id="draggingNodeId"
          :is-multi-dragging="isMultiDragging"
          :multi-selected-ids="multiSelectedIds"
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
          @start-drag="startDrag"
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
