import type { FlowSaveDTO, FlowVO, ProjectVO } from '#/api';
import type {
  Workflow,
  WorkflowEdge,
  WorkflowFolder,
  WorkflowNode,
} from '#/types/workflow';

import { ref } from 'vue';

import { defineStore } from 'pinia';

import {
  addFlow,
  addFolder,
  deleteFlow,
  deleteFolder,
  getFlowDetail,
  getFlowPage,
  getFolderTree,
  getProjectList,
  updateFlow,
  updateFolder,
} from '#/api';

const MOCK_PROJECTS: ProjectVO[] = [
  {
    id: 1,
    projectName: '测试项目A1',
    namespace: 'test-a1',
    description: '测试项目A1',
    createBy: 'admin',
    createTime: new Date().toISOString(),
  },
  {
    id: 2,
    projectName: '测试项目B2',
    namespace: 'test-b2',
    description: '测试项目B2',
    createBy: 'admin',
    createTime: new Date().toISOString(),
  },
];

const MOCK_FOLDERS: WorkflowFolder[] = [
  { id: 1, name: '默认文件夹', parentId: 0, sort: 1, children: [] },
];

export const useWorkflowStore = defineStore('workflow', () => {
  const workflows = ref<Workflow[]>([]);
  const folders = ref<WorkflowFolder[]>([]);
  const projects = ref<ProjectVO[]>([]);
  const currentWorkflow = ref<null | Workflow>(null);
  const selectedNodeId = ref<null | string>(null);
  const selectedFolderId = ref<null | number>(null);
  const selectedWorkflowId = ref<null | string>(null);
  const projectId = ref<number>(1);
  const searchKeyword = ref('');
  const totalWorkflows = ref(0);
  const isWorkflowsLoading = ref(false);

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
      // backendId 留空，saveWorkflowToBackend 据此走 addFlow 分支
      flowId: `flow-${timestamp}`,
    };
    workflows.value.push(workflow);
    return workflow;
  }

  function findWorkflowById(id: string): undefined | Workflow {
    return workflows.value.find((w) => w.id === id);
  }

  async function loadProjects() {
    try {
      const data = await getProjectList();
      if (data && data.length > 0) {
        projects.value = data;
        const found = projects.value.find((p) => p.id === projectId.value);
        if (!found && projects.value[0]) {
          projectId.value = projects.value[0].id;
        }
      } else {
        projects.value = [...MOCK_PROJECTS];
        projectId.value = projects.value[0]?.id ?? 1;
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      projects.value = [...MOCK_PROJECTS];
      projectId.value = projects.value[0]?.id ?? 1;
    }
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
    try {
      const data = await getFolderTree(projectId.value);
      folders.value =
        data && data.length > 0
          ? data.map((item: any) => transformFolder(item))
          : [...MOCK_FOLDERS];
    } catch (error) {
      console.error('Failed to load folders:', error);
      folders.value = [...MOCK_FOLDERS];
    }
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
          const status: 'normal' | 'disabled' | 'deleted' = item.deleted
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
        if (response && response.data && typeof response.data.id === 'number') {
          current.backendId = response.data.id;
          current.id = `workflow-${response.data.id}`;
        }
      } else {
        await updateFlow(current.backendId, data);
      }
      return true;
    } catch (error) {
      console.error('Failed to save workflow:', error);
      return false;
    }
  }

  async function loadWorkflowDetail(id: string): Promise<any | null> {
    try {
      const numericId = Number.parseInt(id.replace('workflow-', ''));
      if (!Number.isNaN(numericId)) {
        const result = await getFlowDetail(numericId);
        if (result && typeof result === 'object') {
          if ('data' in result && result.data) {
            return result.data;
          }
        }
        return result;
      }
      return null;
    } catch (error) {
      console.error('Failed to load workflow detail:', error);
      return null;
    }
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
    searchKeyword,
    totalWorkflows,
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
  };
});
