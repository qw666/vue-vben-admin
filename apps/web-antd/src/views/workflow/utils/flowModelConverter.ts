import type { FlowModel, FlowTask } from '#/api/core/workflow';
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType } from '#/types/workflow';

import { getFlowControlConfig } from '../config/workflow-node-config';

function convertTaskToConfig(task: FlowTask, flowControlConfig: any): Record<string, any> {
  const config: Record<string, any> = {};
  for (const key of Object.keys(task)) {
    if (key === 'id' || key === 'type' || key === 'description') {
      continue;
    }
    if (flowControlConfig && flowControlConfig.taskFields?.includes(key)) {
      const fieldValue = task[key];
      if (Array.isArray(fieldValue)) {
        config[key] = fieldValue.map((item: any) => {
          if (item.id && item.type) {
            return { nodeId: item.id };
          }
          return item;
        });
      } else if (typeof fieldValue === 'object' && fieldValue !== null) {
        const nestedConfig: Record<string, any[]> = {};
        for (const caseKey of Object.keys(fieldValue)) {
          const caseItems = fieldValue[caseKey];
          if (Array.isArray(caseItems)) {
            nestedConfig[caseKey] = caseItems.map((item: any) => {
              if (item.id && item.type) {
                return { nodeId: item.id };
              }
              return item;
            });
          }
        }
        config[key] = nestedConfig;
      } else {
        config[key] = fieldValue;
      }
    } else {
      config[key] = task[key];
    }
  }
  return config;
}

function extractAllTasks(tasks: FlowTask[], allTasks: FlowTask[] = []): FlowTask[] {
  for (const task of tasks) {
    if (!allTasks.find(t => t.id === task.id)) {
      allTasks.push(task);
    }
    const flowControlConfig = getFlowControlConfig(task.type);
    if (flowControlConfig && flowControlConfig.taskFields) {
      for (const field of flowControlConfig.taskFields) {
        const fieldValue = task[field];
        if (Array.isArray(fieldValue)) {
          extractAllTasks(fieldValue.filter((item: any) => item.id && item.type), allTasks);
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          for (const caseKey of Object.keys(fieldValue)) {
            const caseItems = fieldValue[caseKey];
            if (Array.isArray(caseItems)) {
              extractAllTasks(caseItems.filter((item: any) => item.id && item.type), allTasks);
            }
          }
        }
      }
    }
  }
  return allTasks;
}

function buildEdges(tasks: FlowTask[], parentTask?: FlowTask, edges: WorkflowEdge[] = [], parentField?: string, parentCaseKey?: string): void {
  for (const task of tasks) {
    if (parentTask) {
      const sourceHandle = parentCaseKey
        ? `${parentTask.id}-output-${parentField}-${parentCaseKey}`
        : `${parentTask.id}-output-${parentField}`;
      edges.push({
        id: `edge-${parentTask.id}-${task.id}`,
        source: parentTask.id,
        target: task.id,
        sourceHandle,
        targetHandle: `${task.id}-input`,
      });
    }
    const flowControlConfig = getFlowControlConfig(task.type);
    if (flowControlConfig && flowControlConfig.taskFields) {
      for (const field of flowControlConfig.taskFields) {
        const fieldValue = task[field];
        if (Array.isArray(fieldValue)) {
          buildEdges(fieldValue.filter((item: any) => item.id && item.type), task, edges, field);
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          for (const caseKey of Object.keys(fieldValue)) {
            const caseItems = fieldValue[caseKey];
            if (Array.isArray(caseItems)) {
              buildEdges(caseItems.filter((item: any) => item.id && item.type), task, edges, field, caseKey);
            }
          }
        }
      }
    }
  }
}

export function convertFlowModelToWorkflow(
  flowModel: FlowModel,
  workflowId: string,
  name: string,
  folderId?: number,
  flowId?: string,
  pluginGroupsCache: Record<string, any[]> = {},
): Workflow {
  const tasks = flowModel.tasks || [];

  const allTasks = extractAllTasks(tasks);

  const edges: WorkflowEdge[] = [];
  buildEdges(tasks, undefined, edges);

  for (let i = 0; i < tasks.length - 1; i++) {
    const currentTask = tasks[i];
    const nextTask = tasks[i + 1];
    if (currentTask && nextTask) {
      const currentFlowControlConfig = getFlowControlConfig(currentTask.type);
      const sourceHandle = currentFlowControlConfig
        ? `${currentTask.id}-output-next`
        : `${currentTask.id}-output`;
      edges.push({
        id: `edge-${currentTask.id}-${nextTask.id}`,
        source: currentTask.id,
        target: nextTask.id,
        sourceHandle,
        targetHandle: `${nextTask.id}-input`,
      });
    }
  }

  const NODE_WIDTH = 176;
  const NODE_HEIGHT = 68;
  const HORIZONTAL_SPACING = 24;
  const VERTICAL_SPACING = 80;

  let x = 0;
  let y = 0;

  const nodes: WorkflowNode[] = allTasks.map((task) => {
    const flowControlConfig = getFlowControlConfig(task.type);
    const config = convertTaskToConfig(task, flowControlConfig);

    let icon = flowControlConfig?.icon || 'mdi:circle';
    let description = flowControlConfig?.description || '基础';

    if (!flowControlConfig) {
      for (const category of Object.values(pluginGroupsCache)) {
        for (const group of category) {
          if (group.pluginList) {
            const template = group.pluginList.find((p: any) => p.type === task.type);
            if (template) {
              icon = template.icon || icon;
              description = template.description || template.category || description;
              break;
            }
          }
        }
      }
    }

    const node: WorkflowNode = {
      id: task.id,
      type: task.type,
      position: { x, y },
      data: {
        label: task.description || task.id,
        type: task.type as WorkflowNodeType,
        icon,
        description,
        config,
      },
    };

    x += NODE_WIDTH + HORIZONTAL_SPACING;
    if (x > 2000) {
      x = 0;
      y += NODE_HEIGHT + VERTICAL_SPACING;
    }

    return node;
  });

  const CANVAS_WIDTH = 4000;
  const CANVAS_HEIGHT = 4000;
  const maxX = Math.min(x, 2000);
  const maxY = y + NODE_HEIGHT;
  const offsetX = (CANVAS_WIDTH - maxX) / 2;
  const offsetY = (CANVAS_HEIGHT - maxY) / 2;

  const positionedNodes = nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }));

  return {
    id: workflowId,
    name,
    description: name,
    folderId,
    nodes: positionedNodes,
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flowId: flowId || `flow-${Date.now()}`,
  };
}

function isEmptyValue(value: any): boolean {
  if (value === '' || value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  ) {
    return true;
  }
  return false;
}

function removeEmptyValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    const filtered = obj
      .map((item) => removeEmptyValues(item))
      .filter((item) => !isEmptyValue(item));
    return filtered as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key as keyof typeof obj];
      const cleanedValue = removeEmptyValues(value);
      if (!isEmptyValue(cleanedValue)) {
        result[key] = cleanedValue;
      }
    }
    return result as T;
  }

  return obj;
}

export function convertWorkflowToFlowModel(workflow: Workflow): FlowModel {
  const visited = new Set<string>();
  const rootTasks: FlowTask[] = [];

  const edgesMap = new Map<string, WorkflowEdge[]>();
  workflow.edges.forEach((edge) => {
    const list = edgesMap.get(edge.source) || [];
    if (!edgesMap.has(edge.source)) {
      edgesMap.set(edge.source, list);
    }
    list.push(edge);
  });

  function convertNode(node: WorkflowNode): FlowTask {
    visited.add(node.id);

    const flowControlConfig = getFlowControlConfig(node.data.type);
    const task: FlowTask = {
      id: node.id,
      type: node.data.type,
      description: node.data.label || '',
    };

    const config = node.data.config;
    if (config) {
      Object.keys(config).forEach((key) => {
        const configValue = config[key];

        if (flowControlConfig && key === 'next') {
          return;
        }

        if (flowControlConfig && flowControlConfig.taskFields?.includes(key)) {
          if (Array.isArray(configValue)) {
            task[key] = configValue.map((item: any) => {
              if (item.nodeId) {
                const childNode = workflow.nodes.find(
                  (n) => n.id === item.nodeId,
                );
                if (childNode && !visited.has(childNode.id)) {
                  const converted = convertNode(childNode);
                  const result: FlowTask = { ...converted };
                  delete result.nodeId;
                  delete result.label;
                  return result;
                }
              }
              return item;
            });
          } else if (typeof configValue === 'object' && configValue !== null) {
            const nestedTasks: Record<string, FlowTask[]> = {};
            Object.keys(configValue).forEach((caseKey) => {
              const caseItems = configValue[caseKey];
              if (Array.isArray(caseItems)) {
                nestedTasks[caseKey] = caseItems.map((item: any) => {
                  if (item.nodeId) {
                    const childNode = workflow.nodes.find(
                      (n) => n.id === item.nodeId,
                    );
                    if (childNode && !visited.has(childNode.id)) {
                      const converted = convertNode(childNode);
                      const result: FlowTask = { ...converted };
                      delete result.nodeId;
                      delete result.label;
                      return result;
                    }
                  }
                  return item;
                });
              }
            });
            task[key] = nestedTasks;
          }
        } else {
          task[key] = configValue;
        }
      });
    }

    return task;
  }

  const inDegree = new Map<string, number>();
  workflow.nodes.forEach((node) => {
    inDegree.set(node.id, 0);
  });
  workflow.edges.forEach((edge) => {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  const queue: WorkflowNode[] = [];
  workflow.nodes.forEach((node) => {
    if (inDegree.get(node.id) === 0) {
      queue.push(node);
    }
  });

  const sortedNodes: WorkflowNode[] = [];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) {
      break;
    }
    sortedNodes.push(node);

    const sourceEdges = edgesMap.get(node.id) || [];
    sourceEdges.forEach((edge) => {
      const currentDegree = (inDegree.get(edge.target) || 0) - 1;
      inDegree.set(edge.target, currentDegree);
      if (currentDegree === 0) {
        const targetNode = workflow.nodes.find((n) => n.id === edge.target);
        if (targetNode) {
          queue.push(targetNode);
        }
      }
    });
  }

  sortedNodes.forEach((node) => {
    if (!visited.has(node.id)) {
      rootTasks.push(convertNode(node));
    }
  });

  const model: FlowModel = {
    tasks: rootTasks,
  };

  return removeEmptyValues(model);
}

export function buildFlowSavePayload(
  workflow: Workflow,
  projectId: number,
  workflowName: string,
) {
  const flowModel = convertWorkflowToFlowModel(workflow);

  return {
    projectId,
    folderId: workflow.folderId || 0,
    description: workflowName,
    flowId: workflow.flowId,
    flowModel,
  };
}
