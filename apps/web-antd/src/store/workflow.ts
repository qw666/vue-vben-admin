import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowFolder } from '#/types/workflow';
import { addFolder, updateFolder, deleteFolder, getFolderTree, getProjectList } from '#/api';

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
  const projectId = ref<number>(1);

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
        currentWorkflow.value.nodes[index] = {
          id: currentNode.id,
          type: updates.type ?? currentNode.type,
          position: updates.position ?? currentNode.position,
          data: updates.data ?? currentNode.data,
        };
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
      const response = await getProjectList();
      projects.value = response || [];
      if (projects.value.length > 0 && projectId.value === 1) {
        projectId.value = projects.value[0].id;
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      projects.value = [];
    }
  }

  async function loadFolders() {
    try {
      const response = await getFolderTree(projectId.value);
      if (response && response.length > 0) {
        folders.value = response.map((item: any) => ({
          id: item.id,
          name: item.folderName,
          parentId: item.parentId,
          sort: item.sort,
          children: item.children ? item.children.map((child: any) => ({
            id: child.id,
            name: child.folderName,
            parentId: child.parentId,
            sort: child.sort,
            children: child.children,
          })) : undefined,
        }));
      } else {
        folders.value = [];
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
      folders.value = [];
    }
  }

  async function createFolder(name: string, parentId?: number, selectedProjectId?: number): Promise<WorkflowFolder | null> {
    try {
      const response = await addFolder({
        projectId: selectedProjectId ?? projectId.value,
        parentId: parentId ?? 0,
        folderName: name,
      });
      await loadFolders();
      return response || null;
    } catch (error) {
      console.error('Failed to create folder:', error);
      return null;
    }
  }

  async function updateFolderById(folderId: number, name: string): Promise<boolean> {
    try {
      await updateFolder(folderId, {
        projectId: projectId.value,
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

  function findFolderById(folderId: number, searchFolders?: WorkflowFolder[]): WorkflowFolder | undefined {
    const targetFolders = searchFolders || folders.value;
    for (const folder of targetFolders) {
      if (folder.id === folderId) return folder;
      if (folder.children) {
        const found = findFolderById(folderId, folder.children);
        if (found) return found;
      }
    }
    return undefined;
  }

  function initMockData() {
    if (workflows.value.length === 0 && folders.value.length === 0) {
      const now = new Date().toISOString();
      folders.value = [
        {
          id: 1,
          name: '默认文件夹',
          parentId: 0,
          sort: 1,
          children: [],
        },
        {
          id: 2,
          name: 'AI 流程',
          parentId: 0,
          sort: 2,
          children: [
            {
              id: 3,
              name: '问答流程',
              parentId: 2,
              sort: 1,
              children: [],
            },
          ],
        },
      ];

      workflows.value = [
        {
          id: 'workflow-1',
          name: '示例流程',
          description: '一个简单的示例流程',
          folderId: 1,
          nodes: [],
          edges: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'workflow-2',
          name: 'AI问答流程',
          description: '基于LLM的问答流程',
          folderId: 3,
          nodes: [],
          edges: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'workflow-3',
          name: '数据处理流程',
          description: '数据清洗和转换流程',
          folderId: 1,
          nodes: [],
          edges: [],
          createdAt: now,
          updatedAt: now,
        },
      ];
    }
  }

  return {
    workflows,
    folders,
    projects,
    currentWorkflow,
    selectedNodeId,
    selectedFolderId,
    projectId,
    workflowsByFolder,
    setCurrentWorkflow,
    setSelectedNodeId,
    setSelectedFolderId,
    setProjectId,
    addNode,
    removeNode,
    updateNode,
    addEdge,
    removeEdge,
    createWorkflow,
    saveWorkflow,
    deleteWorkflow,
    getWorkflowById,
    loadProjects,
    loadFolders,
    createFolder,
    updateFolderById,
    deleteFolderById,
    findFolderById,
    initMockData,
  };
});
