import type {
  NodeTemplate,
  Workflow,
  WorkflowEdge,
  WorkflowFolder,
  WorkflowNode,
} from '#/types/workflow';

import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

export const useWorkflowStore = defineStore('workflow', () => {
  const workflows = ref<Workflow[]>([]);
  const folders = ref<WorkflowFolder[]>([]);
  const currentWorkflow = ref<null | Workflow>(null);
  const selectedNodeId = ref<null | string>(null);
  const selectedFolderId = ref<null | string>(null);

  const nodeTemplates: NodeTemplate[] = [
    {
      type: 'start',
      label: '开始',
      icon: 'mdi:play-circle',
      category: '基础',
      description: '流程的起始节点',
    },
    {
      type: 'end',
      label: '结束',
      icon: 'mdi:stop-circle',
      category: '基础',
      description: '流程的结束节点',
    },
    {
      type: 'llm',
      label: 'LLM',
      icon: 'mdi:brain',
      category: 'AI',
      description: '调用大语言模型',
    },
    {
      type: 'prompt',
      label: '提示词',
      icon: 'mdi:file-text',
      category: 'AI',
      description: '定义提示词模板',
    },
    {
      type: 'code',
      label: '代码',
      icon: 'mdi:code',
      category: '工具',
      description: '执行自定义代码',
    },
    {
      type: 'condition',
      label: '条件',
      icon: 'mdi:git-branch',
      category: '控制',
      description: '条件分支判断',
    },
    {
      type: 'webhook',
      label: 'Webhook',
      icon: 'mdi:webhook',
      category: '工具',
      description: '发送HTTP请求',
    },
    {
      type: 'data',
      label: '数据',
      icon: 'mdi:database',
      category: '数据',
      description: '数据处理节点',
    },
    {
      type: 'input',
      label: '输入',
      icon: 'mdi:input',
      category: '数据',
      description: '流程输入参数',
    },
    {
      type: 'output',
      label: '输出',
      icon: 'mdi:output',
      category: '数据',
      description: '流程输出结果',
    },
  ];

  const categories = computed(() => {
    const cats = new Set(nodeTemplates.map((t) => t.category));
    return [...cats];
  });

  const nodesByCategory = computed(() => {
    const map: Record<string, NodeTemplate[]> = {};
    nodeTemplates.forEach((t) => {
      const category = t.category;
      if (!map[category]) {
        map[category] = [];
      }
      map[category].push(t);
    });
    return map;
  });

  const workflowsByFolder = computed(() => {
    if (!selectedFolderId.value) {
      return workflows.value;
    }
    return workflows.value.filter((w) => w.folderId === selectedFolderId.value);
  });

  function setCurrentWorkflow(workflow: null | Workflow) {
    currentWorkflow.value = workflow;
  }

  function setSelectedNodeId(id: null | string) {
    selectedNodeId.value = id;
  }

  function setSelectedFolderId(id: null | string) {
    selectedFolderId.value = id;
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
      currentWorkflow.value.edges = currentWorkflow.value.edges.filter(
        (e) => e.id !== edgeId,
      );
    }
  }

  function createWorkflow(
    name: string,
    folderId?: string,
    description?: string,
  ): Workflow {
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

  function getWorkflowById(workflowId: string): undefined | Workflow {
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

  function findFolderById(
    folderId: string,
    searchFolders?: WorkflowFolder[],
  ): undefined | WorkflowFolder {
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

  function deleteFolderRecursive(
    folderId: string,
    targetFolders: WorkflowFolder[],
  ) {
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
    nodeTemplates,
    categories,
    nodesByCategory,
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
