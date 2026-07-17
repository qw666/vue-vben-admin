import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowFolder } from '#/types/workflow';
import { addFolder, updateFolder, deleteFolder, getFolderTree, getProjectList, getFlowPage, addFlow, updateFlow, deleteFlow, getFlowDetail, type FlowSaveDTO } from '#/api';

export interface ProjectVO {
  id: number;
  projectName: string;
  namespace: string;
  description: string;
  createBy: string;
  createTime: string;
}

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

  const workflowsByFolder = computed(() => {
    if (!selectedFolderId.value) {
      return workflows.value;
    }
    return workflows.value.filter((w) => w.folderId === selectedFolderId.value);
  });

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

  function saveWorkflow(workflow: Workflow) {
    workflow.updatedAt = new Date().toISOString();
    const index = workflows.value.findIndex((w) => w.id === workflow.id);
    if (index !== -1) {
      workflows.value[index] = workflow;
    } else {
      workflows.value.push(workflow);
    }
    if (currentWorkflow.value?.id === workflow.id) {
      currentWorkflow.value = workflow;
    }
  }

  function deleteWorkflow(workflowId: string) {
    workflows.value = workflows.value.filter((w) => w.id !== workflowId);
    if (currentWorkflow.value?.id === workflowId) {
      currentWorkflow.value = null;
    }
  }

  function getWorkflowById(workflowId: string): Workflow | undefined {
    return workflows.value.find((w) => w.id === workflowId);
  }

  async function loadProjects() {
    try {
      const data = await getProjectList();
      if (data && data.length > 0) {
        projects.value = data;
        const found = projects.value.find(p => p.id === projectId.value);
        if (!found && projects.value[0]) {
          projectId.value = projects.value[0].id;
        }
      } else {
        projects.value = [
          { id: 1, projectName: '测试项目A1', namespace: 'test-a1', description: '测试项目A1', createBy: 'admin', createTime: new Date().toISOString() },
          { id: 2, projectName: '测试项目B2', namespace: 'test-b2', description: '测试项目B2', createBy: 'admin', createTime: new Date().toISOString() },
        ];
        if (projects.value[0]) {
          projectId.value = projects.value[0].id;
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      projects.value = [
        { id: 1, projectName: '测试项目A1', namespace: 'test-a1', description: '测试项目A1', createBy: 'admin', createTime: new Date().toISOString() },
        { id: 2, projectName: '测试项目B2', namespace: 'test-b2', description: '测试项目B2', createBy: 'admin', createTime: new Date().toISOString() },
      ];
      if (projects.value[0]) {
        projectId.value = projects.value[0].id;
      }
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
        folders.value = [
          { id: 1, name: '默认文件夹', parentId: 0, sort: 1, children: [] },
        ];
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
      folders.value = [
        { id: 1, name: '默认文件夹', parentId: 0, sort: 1, children: [] },
      ];
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

  function addWorkflow(workflow: Omit<Workflow, 'id'>): Workflow {
    const id = `workflow-${Date.now()}`;
    const newWorkflow = { ...workflow, id };
    workflows.value.push(newWorkflow);
    return newWorkflow;
  }

  function findWorkflowById(id: string): Workflow | undefined {
    return workflows.value.find((w) => w.id === id);
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

  function initMockData() {
    if (projects.value.length === 0) {
      projects.value = [
        { id: 1, projectName: '测试项目A1', namespace: 'test-a1', description: '测试项目A1', createBy: 'admin', createTime: new Date().toISOString() },
        { id: 2, projectName: '测试项目B2', namespace: 'test-b2', description: '测试项目B2', createBy: 'admin', createTime: new Date().toISOString() },
      ];
    }
    if (workflows.value.length === 0 && folders.value.length === 0) {
      const now = new Date().toISOString();
      folders.value = [
        { id: 1, name: '默认文件夹', parentId: 0, sort: 1, children: [] },
        { id: 2, name: 'AI流程', parentId: 0, sort: 2, children: [] },
      ];
      workflows.value = [
        { id: 'workflow-1', name: '示例流程', description: '这是一个示例流程', folderId: 1, nodes: [], edges: [], createdAt: now, updatedAt: now },
        { id: 'workflow-2', name: 'AI问答流程', description: '基于AI的问答流程', folderId: 2, nodes: [], edges: [], createdAt: now, updatedAt: now },
        { id: 'workflow-3', name: '数据处理流程', description: '数据处理和转换流程', folderId: 1, nodes: [], edges: [], createdAt: now, updatedAt: now },
      ];
    }
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
    addWorkflow,
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
    initMockData,
    setCurrentWorkflow,
    setSelectedNodeId,
    setSelectedFolderId,
    addNode,
    removeNode,
    updateNode,
    addEdge,
    removeEdge,
    saveWorkflow,
    deleteWorkflow,
    getWorkflowById,
  };
})
