import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowFolder } from '#/types/workflow';
import {
  addFolder,
  updateFolder,
  deleteFolder,
  getFolderTree,
  getProjectList,
  getFlowPage,
  addFlow,
  updateFlow,
  deleteFlow,
  getFlowDetail,
  type FlowSaveDTO,
  type ProjectVO,
} from '#/api';

const MOCK_PROJECTS: ProjectVO[] = [
  { id: 1, projectName: '测试项目A1', namespace: 'test-a1', description: '测试项目A1', createBy: 'admin', createTime: new Date().toISOString() },
  { id: 2, projectName: '测试项目B2', namespace: 'test-b2', description: '测试项目B2', createBy: 'admin', createTime: new Date().toISOString() },
];

const MOCK_FOLDERS: WorkflowFolder[] = [
  { id: 1, name: '默认文件夹', parentId: 0, sort: 1, children: [] },
];

export const useWorkflowStore = defineStore('workflow', () => {
  const workflows = ref<Workflow[]>([]);
  const folders = ref<WorkflowFolder[]>([]);
  const projects = ref<ProjectVO[]>([]);
  const currentWorkflow = ref<Workflow | null>(null);
  const selectedNodeId = ref<string | null>(null);
  const selectedFolderId = ref<number | null>(null);
  const selectedWorkflowId = ref<string | null>(null);
  const projectId = ref<number>(1);
  const searchKeyword = ref('');
  const totalWorkflows = ref(0);
  const isWorkflowsLoading = ref(false);

  function setCurrentWorkflow(workflow: Workflow | null) {
    currentWorkflow.value = workflow;
  }

  function setSelectedNodeId(id: string | null) {
    selectedNodeId.value = id;
  }

  function setSelectedFolderId(id: number | null) {
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
      currentWorkflow.value.nodes = currentWorkflow.value.nodes.filter((n) => n.id !== nodeId);
      currentWorkflow.value.edges = currentWorkflow.value.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
      if (selectedNodeId.value === nodeId) {
        selectedNodeId.value = null;
      }
    }
  }

  function updateNode(nodeId: string, updates: Partial<WorkflowNode>) {
    if (currentWorkflow.value) {
      const index = currentWorkflow.value.nodes.findIndex((n) => n.id === nodeId);
      if (index !== -1) {
        const currentNode = currentWorkflow.value.nodes[index];
        if (currentNode) {
          currentWorkflow.value.nodes[index] = {
            id: currentNode.id,
            type: updates.type ?? currentNode.type,
            position: updates.position ?? currentNode.position,
            data: updates.data ?? currentNode.data,
          };
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
      currentWorkflow.value.edges = currentWorkflow.value.edges.filter((e) => e.id !== edgeId);
    }
  }

  function createWorkflow(name: string, folderId?: number, description?: string): Workflow {
    const now = new Date().toISOString();
    const workflow: Workflow = {
      id: `workflow-${Date.now()}`,
      name,
      description: description || '',
      folderId,
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
    };
    workflows.value.push(workflow);
    return workflow;
  }

  function findWorkflowById(id: string): Workflow | undefined {
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
      children: folder.children ? folder.children.map((child: any) => transformFolder(child)) : undefined,
    };
  }

  function findFolderById(id: number, foldersList: WorkflowFolder[] = folders.value): WorkflowFolder | undefined {
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
      if (data && data.length > 0) {
        folders.value = data.map((item: any) => transformFolder(item));
      } else {
        folders.value = [...MOCK_FOLDERS];
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
      folders.value = [...MOCK_FOLDERS];
    }
  }

  async function createFolder(name: string, parentId?: number, selectedProjectId?: number): Promise<WorkflowFolder | null> {
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

  async function updateFolderById(folderId: number, name: string, newProjectId?: number, newParentId?: number): Promise<boolean> {
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

  async function loadWorkflows(folderId?: number, keyword?: string) {
    isWorkflowsLoading.value = true;
    try {
      const data = await getFlowPage({
        projectId: projectId.value,
        folderId: folderId ?? undefined,
        description: keyword || searchKeyword.value || undefined,
        pageNum: 1,
        pageSize: 100,
      });
      if (data && data.records) {
        workflows.value = data.records.map((item: any) => ({
          id: `workflow-${item.id}`,
          name: item.description,
          description: item.description,
          folderId: item.folderId,
          nodes: [],
          edges: [],
          createdAt: item.createTime || new Date().toISOString(),
          updatedAt: item.createTime || new Date().toISOString(),
        }));
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
        workflows.value[index] = { ...workflow, updatedAt: new Date().toISOString() };
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
        const numericId = parseInt(id.replace('workflow-', ''));
        if (!isNaN(numericId)) {
          await deleteFlow(numericId);
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

  async function saveWorkflowToBackend(id: string, data: FlowSaveDTO): Promise<boolean> {
    try {
      const numericId = parseInt(id.replace('workflow-', ''));
      if (!isNaN(numericId)) {
        await updateFlow(numericId, data);
      } else {
        await addFlow(data);
      }
      await loadWorkflows(selectedFolderId.value || undefined);
      return true;
    } catch (error) {
      console.error('Failed to save workflow:', error);
      return false;
    }
  }

  async function loadWorkflowDetail(id: string): Promise<any | null> {
    try {
      const numericId = parseInt(id.replace('workflow-', ''));
      if (!isNaN(numericId)) {
        const data = await getFlowDetail(numericId);
        if (data) {
          return data;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to load workflow detail:', error);
      return null;
    }
  }

  function selectFolder(id: number | null) {
    selectedFolderId.value = id;
  }

  function selectWorkflow(id: string | null) {
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
