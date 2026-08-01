<script lang="ts" setup>
import type { ProjectVO } from '#/api/core/workflow';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, message, Tag } from 'ant-design-vue';

import { useTitle } from '@vueuse/core';

import { useTabbarStore } from '@vben/stores';

import { useWorkflowStore } from '#/store/workflow';

import Canvas from './components/Canvas.vue';
import ConfigPanel from './components/ConfigPanel.vue';
import LeftPanel from './components/LeftPanel.vue';
import NodeSelectModal from './components/NodeSelectModal.vue';
import { useCanvasInteraction } from './composables/useCanvasInteraction';
import { useNodeConfig, validateAllNodes } from './composables/useNodeConfig';
import { usePluginMeta } from './composables/usePluginMeta';
import { getFlowControlConfig } from './config/workflow-node-config';
import {
  convertFlowModelToWorkflow,
  buildFlowSavePayload,
} from './utils/flowModelConverter';
import {
  validateAll as validateWorkflowStructure,
  formatValidationErrors,
} from './utils/validateWorkflow';

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
const isRunning = ref(false);
const isPageReady = ref(false);
const isProjectsLoading = ref(false);
const workflowLoaded = ref(false);
const workflowEnabled = computed(() => {
  return store.currentWorkflow?.enabled !== false;
});

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
  addInputsItem,
  updateInputsField,
  removeInputsItem,
  addTriggersItem,
  updateTriggersField,
  removeTriggersItem,
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

    if (!workflowName.value || !workflowName.value.trim()) {
      message.error('请填写流程名称');
      return;
    }

    const configValidation = validateAllNodes(
      store.currentWorkflow.nodes,
      pluginMetaCache.value,
    );

    if (!configValidation.isValid) {
      const errorMessages = configValidation.errors.map(
        (err) => `${err.nodeLabel}：${err.missingFields.join('、')}`,
      );
      message.error(`以下节点存在未填写的必填项：\n${errorMessages.join('\n')}`);
      return;
    }

    const structureValidation = validateWorkflowStructure(
      store.currentWorkflow,
    );

    if (!structureValidation.valid) {
      message.error(formatValidationErrors(structureValidation.errors));
      return;
    }

    const endNode = store.currentWorkflow.nodes.find(
      (n) => n.data.type === 'idp_core_flow_End',
    );
    store.currentWorkflow.outputs = endNode?.data.config?.outputs || [];
    store.currentWorkflow.name = workflowName.value;
    store.currentWorkflow.updatedAt = new Date().toISOString();

    const payload = buildFlowSavePayload(
      store.currentWorkflow,
      store.projectId,
      workflowName.value,
    );

    const backendValidationResult = await store.validateFlow(payload);

    if (backendValidationResult?.constraints) {
      message.error(`流程校验失败：${backendValidationResult.constraints}`);
      return;
    }

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
  if (isRunning.value) return;
  if (!store.currentWorkflow) {
    message.warning('请先创建流程');
    return;
  }
  if (!store.currentWorkflow.flowId) {
    message.warning('工作流ID不存在，请先保存流程');
    return;
  }
  isRunning.value = true;
  try {
    const success = await store.runWorkflow(store.currentWorkflow.id);
    if (success) {
      message.success('流程运行成功');
    } else {
      message.error('流程运行失败');
    }
  } catch (error) {
    console.error('Failed to run workflow:', error);
    message.error('流程运行失败');
  } finally {
    isRunning.value = false;
  }
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
  router.push('/shuzhiliu/workflow/list');
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

function ensureStartAndEndNodes() {
  if (!store.currentWorkflow) return;

  const hasStartNode = store.currentWorkflow.nodes.some(
    (n) => n.data.type === 'idp_core_flow_Start',
  );
  const hasEndNode = store.currentWorkflow.nodes.some(
    (n) => n.data.type === 'idp_core_flow_End',
  );

  let layoutNodes: Record<string, { x: number; y: number }> = {};
  if (store.currentWorkflow.flowLayout) {
    try {
      const parsedLayout = JSON.parse(store.currentWorkflow.flowLayout);
      if (parsedLayout && parsedLayout.nodes) {
        layoutNodes = parsedLayout.nodes as Record<string, { x: number; y: number }>;
      }
    } catch {
    }
  }

  const taskNodes = store.currentWorkflow.nodes.filter(
    (n) => n.data.type !== 'idp_core_flow_Start' && n.data.type !== 'idp_core_flow_End',
  );

  const firstLevelNodes = taskNodes.filter((node) => {
    for (const other of store.currentWorkflow?.nodes || []) {
      if (other.id === node.id) continue;
      const config = other.data.config || {};
      for (const key of Object.keys(config)) {
        const value = config[key];
        const checkValue = (v: any) => {
          if (Array.isArray(v)) {
            for (const item of v) {
              if (item.nodeId === node.id) return true;
              if (typeof item === 'object' && item) {
                if (checkValue(item)) return true;
              }
            }
          } else if (typeof v === 'object' && v) {
            for (const innerKey of Object.keys(v)) {
              if (checkValue(v[innerKey])) return true;
            }
          }
          return false;
        };
        if (checkValue(value)) return false;
      }
    }
    return true;
  });

  let startNodeId: string | null = null;
  if (!hasStartNode) {
    const startNode = {
      id: `start_${Date.now()}`,
      type: 'custom',
      position: layoutNodes['start'] || { x: 2000, y: 2000 },
      data: {
        label: '开始',
        type: 'idp_core_flow_Start',
        icon: 'mdi:play-circle',
        description: '流程开始节点',
        config: {
          next: [],
          inputs: store.currentWorkflow.inputs || [],
          triggers: store.currentWorkflow.triggers || [],
        },
      },
    };
    store.addNode(startNode);
    startNodeId = startNode.id;
  } else {
    const existingStart = store.currentWorkflow.nodes.find(
      (n) => n.data.type === 'idp_core_flow_Start',
    );
    if (existingStart && store.currentWorkflow.inputs && !existingStart.data.config?.inputs) {
      existingStart.data.config = existingStart.data.config || {};
      existingStart.data.config.inputs = store.currentWorkflow.inputs;
      store.updateNode(existingStart.id, { data: { ...existingStart.data } });
    }
    if (existingStart && store.currentWorkflow.triggers && !existingStart.data.config?.triggers) {
      existingStart.data.config = existingStart.data.config || {};
      existingStart.data.config.triggers = store.currentWorkflow.triggers;
      store.updateNode(existingStart.id, { data: { ...existingStart.data } });
    }
    startNodeId = existingStart?.id || null;
  }

  let endNodeId: string | null = null;
  if (!hasEndNode) {
    const endNode = {
      id: `end_${Date.now()}`,
      type: 'custom',
      position: layoutNodes['end'] || { x: 2400, y: 2000 },
      data: {
        label: '输出',
        type: 'idp_core_flow_End',
        icon: 'mdi:stop-circle',
        description: '流程输出节点',
        config: { outputs: store.currentWorkflow.outputs || [] },
      },
    };
    store.addNode(endNode);
    endNodeId = endNode.id;
  } else {
    const existingEnd = store.currentWorkflow.nodes.find(
      (n) => n.data.type === 'idp_core_flow_End',
    );
    if (existingEnd && store.currentWorkflow.outputs && !existingEnd.data.config?.outputs) {
      existingEnd.data.config = existingEnd.data.config || {};
      existingEnd.data.config.outputs = store.currentWorkflow.outputs;
      store.updateNode(existingEnd.id, { data: { ...existingEnd.data } });
    }
    endNodeId = existingEnd?.id || null;
  }

  if (firstLevelNodes.length > 0 && startNodeId) {
    const targetNodes = firstLevelNodes.filter(
      (n) => !store.currentWorkflow?.edges.some((e) => e.target === n.id),
    );
    const firstTask = targetNodes.length > 0 ? targetNodes[0] : firstLevelNodes[0];
    const startAlreadyConnected = store.currentWorkflow.edges.some(
      (e) => e.source === startNodeId,
    );
    if (!startAlreadyConnected) {
      const edge = {
        id: `edge_start_${Date.now()}`,
        source: startNodeId,
        sourceHandle: `${startNodeId}-output-next`,
        target: firstTask.id,
        targetHandle: `${firstTask.id}-input`,
      };
      store.addEdge(edge);
      connections.value.push(edge);

      const startNode = store.currentWorkflow.nodes.find((n) => n.id === startNodeId);
      if (startNode && startNode.data.config) {
        startNode.data.config.next = [{ nodeId: firstTask.id }];
        store.updateNode(startNodeId, { data: { ...startNode.data } });
      }
    }
  }

  if (firstLevelNodes.length > 0 && endNodeId) {
    const lastTask = firstLevelNodes[firstLevelNodes.length - 1];
    const endAlreadyConnected = store.currentWorkflow.edges.some(
      (e) => e.target === endNodeId,
    );
    if (!endAlreadyConnected) {
      const edge = {
        id: `edge_end_${Date.now()}`,
        source: lastTask.id,
        sourceHandle: `${lastTask.id}-output-next`,
        target: endNodeId,
        targetHandle: `${endNodeId}-input`,
      };
      store.addEdge(edge);
      connections.value.push(edge);

      const lastNode = store.currentWorkflow.nodes.find((n) => n.id === lastTask.id);
      if (lastNode && lastNode.data.config) {
        if (!lastNode.data.config.next) {
          lastNode.data.config.next = [];
        }
        lastNode.data.config.next.push({ nodeId: endNodeId });
        store.updateNode(lastTask.id, { data: { ...lastNode.data } });
      }
    }
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
        ensureStartAndEndNodes();
        workflowLoaded.value = true;
        setTimeout(() => {
          const nodes = store.currentWorkflow?.nodes || [];
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
      const nodes = store.currentWorkflow?.nodes || [];
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
