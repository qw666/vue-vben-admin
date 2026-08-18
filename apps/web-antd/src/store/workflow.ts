import type { FlowSaveDTO, FlowValidateResultVO, FlowVO } from '#/api';
import type {
  Workflow,
  WorkflowEdge,
  WorkflowFolder,
  WorkflowNode,
} from '#/types/workflow';

import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import {
  addFlow,
  addFolder,
  batchDisableFlow,
  batchEnableFlow,
  deleteFlow,
  deleteFolder,
  getFlowDetail,
  getFlowPage,
  getFolderTree,
  runFlow,
  updateFlow,
  updateFolder,
  validateFlow as validateFlowApi,
} from '#/api';
import { useProjectStore } from '#/store/project';
import { generateFlowId } from '#/views/workflow/utils/idGenerator';

export const useWorkflowStore = defineStore('workflow', () => {
  const projectStore = useProjectStore();

  const workflows = ref<Workflow[]>([]);
  const folders = ref<WorkflowFolder[]>([]);
  const currentWorkflow = ref<null | Workflow>(null);
  const selectedNodeId = ref<null | string>(null);
  const selectedFolderId = ref<null | number>(null);
  const selectedWorkflowId = ref<null | string>(null);
  const searchKeyword = ref('');
  const totalWorkflows = ref(0);
  const isWorkflowsLoading = ref(false);
  const validationResult = ref<FlowValidateResultVO | null>(null);
  const isValidating = ref(false);
  /** 画布有保存/删除操作时置 true，列表页返回后据此决定是否刷新 */
  const isWorkflowDirty = ref(false);

  const projects = computed(() => projectStore.projects);
  const projectId = computed({
    get: () => projectStore.selectedId ?? 1,
    set: (val: number) => projectStore.selectProject(val),
  });

  function setValidationResult(result: FlowValidateResultVO | null) {
    validationResult.value = result;
  }

  function setCurrentWorkflow(workflow: null | Workflow) {
    currentWorkflow.value = workflow;
  }

  function setSelectedNodeId(id: null | string) {
    selectedNodeId.value = id;
  }

  function setSelectedFolderId(id: null | number) {
    selectedFolderId.value = id;
  }

  function setProjectId(id: number) {
    projectId.value = id;
  }

  function addNode(node: WorkflowNode) {
    if (currentWorkflow.value) {
      currentWorkflow.value.nodes.push(node);
    }
  }

  function removeNode(nodeId: string) {
    if (currentWorkflow.value) {
      currentWorkflow.value.nodes = currentWorkflow.value.nodes.filter(
        (n) => n.id !== nodeId,
      );
      currentWorkflow.value.edges = currentWorkflow.value.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId,
      );
      if (selectedNodeId.value === nodeId) {
        selectedNodeId.value = null;
      }
    }
  }

  function updateNode(nodeId: string, updates: Partial<WorkflowNode>) {
    if (currentWorkflow.value) {
      const index = currentWorkflow.value.nodes.findIndex(
        (n) => n.id === nodeId,
      );
      if (index !== -1) {
        const currentNode = currentWorkflow.value.nodes[index];
        if (currentNode) {
          if (updates.type !== undefined) {
            currentNode.type = updates.type;
          }
          if (updates.position !== undefined) {
            currentNode.position = updates.position;
          }
          if (updates.data !== undefined) {
            currentNode.data = updates.data;
          }
        }
      }
    }
  }

  function addEdge(edge: WorkflowEdge) {
    if (currentWorkflow.value) {
      currentWorkflow.value.edges.push(edge);
    }
  }

  function removeEdge(edgeId: string) {
    if (currentWorkflow.value) {
      currentWorkflow.value.edges = currentWorkflow.value.edges.filter(
        (e) => e.id !== edgeId,
      );
    }
  }

  function removeEdgesByCondition(
    condition: (edge: WorkflowEdge) => boolean,
  ) {
    if (currentWorkflow.value) {
      currentWorkflow.value.edges = currentWorkflow.value.edges.filter(
        (e) => !condition(e),
      );
    }
  }

  function createWorkflow(
    name: string,
    folderId?: number,
    description?: string,
  ): Workflow {
    const now = new Date().toISOString();
    const timestamp = Date.now();
    const workflow: Workflow = {
      id: `workflow-${timestamp}`,
      name,
      description: description || '',
      folderId,
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
      flowId: generateFlowId(),
      enabled: true,
    };

    const startNode: WorkflowNode = {
      id: `start_${timestamp}`,
      type: 'custom',
      position: { x: 2000, y: 2000 },
      data: {
        label: '开始',
        type: 'idp_core_flow_Start',
        icon: 'mdi:play-circle',
        description: '流程开始节点',
        config: { next: [] },
      },
    };

    const endNode: WorkflowNode = {
      id: `end_${timestamp}`,
      type: 'custom',
      position: { x: 2400, y: 2000 },
      data: {
        label: '结束',
        type: 'idp_core_flow_End',
        icon: 'mdi:stop-circle',
        description: '流程结束节点',
        config: {},
      },
    };

    workflow.nodes.push(startNode);
    workflow.nodes.push(endNode);

    workflows.value.push(workflow);
    return workflow;
  }

  function findWorkflowById(id: string): undefined | Workflow {
    return workflows.value.find((w) => w.id === id);
  }

  async function loadProjects(_force = false) {
    await projectStore.loadProjects();
  }

  function transformFolder(folder: any): WorkflowFolder {
    return {
      id: folder.id,
      name: folder.folderName,
      parentId: folder.parentId,
      sort: folder.sort,
      children: folder.children
        ? folder.children.map((child: any) => transformFolder(child))
        : undefined,
    };
  }

  function findFolderById(
    id: number,
    foldersList: WorkflowFolder[] = folders.value,
  ): undefined | WorkflowFolder {
    for (const folder of foldersList) {
      if (folder.id === id) {
        return folder;
      }
      if (folder.children && folder.children.length > 0) {
        const found = findFolderById(id, folder.children);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  async function loadFolders() {
    const data = await getFolderTree(projectId.value);
    folders.value =
      data && data.length > 0
        ? data.map((item: any) => transformFolder(item))
        : [];
  }

  async function createFolder(
    name: string,
    parentId?: number,
    selectedProjectId?: number,
  ): Promise<null | WorkflowFolder> {
    try {
      await addFolder({
        projectId: selectedProjectId ?? projectId.value,
        parentId: parentId ?? 0,
        folderName: name,
      });
      await loadFolders();
      return {} as WorkflowFolder;
    } catch (error) {
      console.error('Failed to create folder:', error);
      return null;
    }
  }

  async function updateFolderById(
    folderId: number,
    name: string,
    newProjectId?: number,
    newParentId?: number,
  ): Promise<boolean> {
    try {
      const folder = findFolderById(folderId);
      await updateFolder({
        id: folderId,
        projectId: newProjectId ?? projectId.value,
        parentId: newParentId ?? folder?.parentId ?? 0,
        folderName: name,
      });
      await loadFolders();
      return true;
    } catch (error) {
      console.error('Failed to update folder:', error);
      return false;
    }
  }

  async function deleteFolderById(folderId: number): Promise<boolean> {
    try {
      await deleteFolder(folderId, projectId.value);
      workflows.value = workflows.value.filter((w) => w.folderId !== folderId);
      await loadFolders();
      if (selectedFolderId.value === folderId) {
        selectedFolderId.value = null;
      }
      return true;
    } catch (error) {
      console.error('Failed to delete folder:', error);
      return false;
    }
  }

  async function loadWorkflows(
    folderId?: number,
    keyword?: string,
    startTime?: string,
    endTime?: string,
    pageNum?: number,
    pageSize?: number,
  ) {
    isWorkflowsLoading.value = true;
    try {
      const data = await getFlowPage({
        projectId: projectId.value,
        folderId: folderId ?? undefined,
        description: keyword || searchKeyword.value || undefined,
        startTime,
        endTime,
        pageNum: pageNum ?? 1,
        pageSize: pageSize ?? 10,
      });
      if (data && data.records) {
        workflows.value = data.records.map((item: FlowVO) => {
          const status: 'deleted' | 'disabled' | 'normal' = item.deleted
            ? 'deleted'
            : item.disabled
              ? 'disabled'
              : 'normal';
          return {
            id: `workflow-${item.id}`,
            name: item.description,
            description: item.description,
            folderId: item.folderId,
            nodes: [],
            edges: [],
            createdAt: item.createTime || new Date().toISOString(),
            updatedAt: item.createTime || new Date().toISOString(),
            backendId: item.id,
            flowId: item.flowId,
            status,
            enabled: (item as any).flowEnabled === true || (item as any).flowEnabled === 'true',
            hasActiveTrigger: (item as any).hasActiveTrigger === true || (item as any).hasActiveTrigger === 'true',
            inputs: (item as any).inputs || [],
            triggers: ((item as any).triggers || []).map((t: any) => ({
              ...t,
              disabled: t.disabled !== undefined ? t.disabled : (t.enabled === false),
            })),
          };
        });
        totalWorkflows.value = data.total || 0;
      } else {
        workflows.value = [];
        totalWorkflows.value = 0;
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
      workflows.value = [];
      totalWorkflows.value = 0;
    } finally {
      isWorkflowsLoading.value = false;
    }
  }

  async function updateWorkflow(workflow: Workflow): Promise<boolean> {
    try {
      const index = workflows.value.findIndex((w) => w.id === workflow.id);
      if (index !== -1) {
        workflows.value[index] = {
          ...workflow,
          updatedAt: new Date().toISOString(),
        };
      }
      return true;
    } catch (error) {
      console.error('Failed to update workflow:', error);
      return false;
    }
  }

  async function deleteWorkflowById(id: string): Promise<boolean> {
    try {
      const workflow = findWorkflowById(id);
      if (workflow) {
        // 只有已保存到后端的流程才调用删除接口
        if (workflow.backendId !== undefined) {
          await deleteFlow(workflow.backendId);
        }
        workflows.value = workflows.value.filter((w) => w.id !== id);
        if (selectedWorkflowId.value === id) {
          selectedWorkflowId.value = null;
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      return false;
    }
  }

  async function saveWorkflowToBackend(data: FlowSaveDTO): Promise<boolean> {
    try {
      const current = currentWorkflow.value;
      if (!current) {
        return false;
      }
      if (current.backendId === undefined) {
        const response = await addFlow(data);
        if (typeof response === 'number') {
          current.backendId = response;
          current.id = `workflow-${response}`;
        }
      } else {
        await updateFlow(current.backendId, data);
      }
      isWorkflowDirty.value = true;
      return true;
    } catch (error) {
      console.error('Failed to save workflow:', error);
      return false;
    }
  }

  async function validateFlow(data: FlowSaveDTO): Promise<FlowValidateResultVO | null> {
    isValidating.value = true;
    try {
      const result = await validateFlowApi(data);
      validationResult.value = result;
      return result;
    } catch (error) {
      console.error('Failed to validate flow:', error);
      validationResult.value = { constraints: '校验接口调用失败' };
      return { constraints: '校验接口调用失败' };
    } finally {
      isValidating.value = false;
    }
  }

  async function runWorkflow(id: string, inputs?: Record<string, any>): Promise<boolean> {
    try {
      const workflow = findWorkflowById(id);
      if (!workflow) {
        console.error('Workflow not found:', id);
        return false;
      }
      if (!workflow.flowId) {
        console.error('Workflow has no flowId');
        return false;
      }
      await runFlow({
        flowId: workflow.flowId,
        projectId: projectId.value,
        ...(inputs ? { inputs } : {}),
      });
      return true;
    } catch (error) {
      console.error('Failed to run workflow:', error);
      return false;
    }
  }

  async function enableWorkflow(flowId: string): Promise<boolean> {
    try {
      await batchEnableFlow(projectId.value, [flowId]);
      // 更新本地状态
      const workflow = workflows.value.find((w) => w.flowId === flowId);
      if (workflow) {
        workflow.enabled = true;
      }
      return true;
    } catch (error) {
      console.error('Failed to enable workflow:', error);
      return false;
    }
  }

  async function disableWorkflow(flowId: string): Promise<boolean> {
    try {
      await batchDisableFlow(projectId.value, [flowId]);
      // 更新本地状态
      const workflow = workflows.value.find((w) => w.flowId === flowId);
      if (workflow) {
        workflow.enabled = false;
      }
      return true;
    } catch (error) {
      console.error('Failed to disable workflow:', error);
      return false;
    }
  }

  async function loadWorkflowDetail(id: string): Promise<FlowSaveDTO | null> {
    const numericId = Number.parseInt(id.replace('workflow-', ''));
    if (Number.isNaN(numericId)) return null;
    return getFlowDetail(numericId);
  }

  function selectFolder(id: null | number) {
    selectedFolderId.value = id;
  }

  function selectWorkflow(id: null | string) {
    selectedWorkflowId.value = id;
  }

  function setSearchKeyword(keyword: string) {
    searchKeyword.value = keyword;
  }

  return {
    projects,
    projectId,
    setProjectId,
    folders,
    workflows,
    currentWorkflow,
    selectedFolderId,
    selectedWorkflowId,
    isWorkflowsLoading,
    isWorkflowDirty,
    searchKeyword,
    totalWorkflows,
    validationResult,
    isValidating,
    setValidationResult,
    loadProjects,
    loadFolders,
    loadWorkflows,
    createFolder,
    updateFolderById,
    deleteFolderById,
    createWorkflow,
    findWorkflowById,
    findFolderById,
    updateWorkflow,
    deleteWorkflowById,
    saveWorkflowToBackend,
    validateFlow,
    runWorkflow,
    enableWorkflow,
    disableWorkflow,
    loadWorkflowDetail,
    selectFolder,
    selectWorkflow,
    setSearchKeyword,
    setCurrentWorkflow,
    setSelectedNodeId,
    setSelectedFolderId,
    addNode,
    removeNode,
    updateNode,
    addEdge,
    removeEdge,
    removeEdgesByCondition,
  };
});
