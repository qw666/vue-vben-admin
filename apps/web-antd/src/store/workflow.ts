import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowFolder } from '#/types/workflow';

export const useWorkflowStore = defineStore('workflow', () => {
  const workflows = ref<Workflow[]>([]);
  const folders = ref<WorkflowFolder[]>([]);
  const currentWorkflow = ref<Workflow | null>(null);
  const selectedNodeId = ref<string | null>(null);
  const selectedFolderId = ref<string | null>(null);

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

  function setSelectedFolderId(id: string | null) {
    selectedFolderId.value = id;
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

  function createWorkflow(name: string, folderId?: string, description?: string): Workflow {
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

  function createFolder(name: string, parentId?: string): WorkflowFolder {
    const now = new Date().toISOString();
    const folder: WorkflowFolder = {
      id: `folder-${Date.now()}`,
      name,
      parentId,
      children: [],
      createdAt: now,
    };
    if (parentId) {
      const parent = findFolderById(parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(folder);
      }
    } else {
      folders.value.push(folder);
    }
    return folder;
  }

  function updateFolder(folderId: string, updates: Partial<WorkflowFolder>) {
    const folder = findFolderById(folderId);
    if (folder) {
      Object.assign(folder, updates);
    }
  }

  function deleteFolder(folderId: string) {
    workflows.value = workflows.value.filter((w) => w.folderId !== folderId);
    deleteFolderRecursive(folderId, folders.value);
    if (selectedFolderId.value === folderId) {
      selectedFolderId.value = null;
    }
  }

  function findFolderById(folderId: string, searchFolders?: WorkflowFolder[]): WorkflowFolder | undefined {
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

  function deleteFolderRecursive(folderId: string, targetFolders: WorkflowFolder[]) {
    const index = targetFolders.findIndex((f) => f.id === folderId);
    if (index !== -1) {
      targetFolders.splice(index, 1);
    } else {
      for (const folder of targetFolders) {
        if (folder.children) {
          deleteFolderRecursive(folderId, folder.children);
        }
      }
    }
  }

  function initMockData() {
    if (workflows.value.length === 0 && folders.value.length === 0) {
      const now = new Date().toISOString();
      folders.value = [
        {
          id: 'folder-1',
          name: '默认文件夹',
          children: [],
          createdAt: now,
        },
        {
          id: 'folder-2',
          name: 'AI 流程',
          children: [
            {
              id: 'folder-2-1',
              name: '问答流程',
              parentId: 'folder-2',
              children: [],
              createdAt: now,
            },
          ],
          createdAt: now,
        },
      ];

      workflows.value = [
        {
          id: 'workflow-1',
          name: '示例流程',
          description: '一个简单的示例流程',
          folderId: 'folder-1',
          nodes: [],
          edges: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'workflow-2',
          name: 'AI问答流程',
          description: '基于LLM的问答流程',
          folderId: 'folder-2-1',
          nodes: [],
          edges: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'workflow-3',
          name: '数据处理流程',
          description: '数据清洗和转换流程',
          folderId: 'folder-1',
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
    currentWorkflow,
    selectedNodeId,
    selectedFolderId,
    workflowsByFolder,
    setCurrentWorkflow,
    setSelectedNodeId,
    setSelectedFolderId,
    addNode,
    removeNode,
    updateNode,
    addEdge,
    removeEdge,
    createWorkflow,
    saveWorkflow,
    deleteWorkflow,
    getWorkflowById,
    createFolder,
    updateFolder,
    deleteFolder,
    findFolderById,
    initMockData,
  };
});
