import type { FlowModel, FlowTask } from '#/api/core/workflow';
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType } from '#/types/workflow';

import { getFlowControlConfig } from '../config/workflow-node-config';

function collectAllTasks(tasks: FlowTask[], result: FlowTask[] = []): FlowTask[] {
  for (const task of tasks) {
    result.push(task);
    const flowControlConfig = getFlowControlConfig(task.type);
    if (flowControlConfig && flowControlConfig.taskFields) {
      for (const field of flowControlConfig.taskFields) {
        const fieldValue = task[field];
        if (Array.isArray(fieldValue)) {
          for (const item of fieldValue) {
            if (item.id && item.type) {
              collectAllTasks([item], result);
            }
          }
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          for (const caseKey of Object.keys(fieldValue)) {
            const caseItems = fieldValue[caseKey];
            if (Array.isArray(caseItems)) {
              for (const item of caseItems) {
                if (item.id && item.type) {
                  collectAllTasks([item], result);
                }
              }
            }
          }
        }
      }
    }
  }
  return result;
}

function buildEdges(tasks: FlowTask[], parentId?: string): WorkflowEdge[] {
  const edges: WorkflowEdge[] = [];
  for (const task of tasks) {
    if (parentId) {
      edges.push({
        id: `edge-${parentId}-${task.id}`,
        source: parentId,
        target: task.id,
      });
    }
    const flowControlConfig = getFlowControlConfig(task.type);
    if (flowControlConfig && flowControlConfig.taskFields) {
      for (const field of flowControlConfig.taskFields) {
        const fieldValue = task[field];
        if (Array.isArray(fieldValue)) {
          const childTasks = fieldValue.filter((item: any) => item.id && item.type);
          const childEdges = buildEdges(childTasks, task.id);
          edges.push(...childEdges);
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          for (const caseKey of Object.keys(fieldValue)) {
            const caseItems = fieldValue[caseKey];
            if (Array.isArray(caseItems)) {
              const childTasks = caseItems.filter((item: any) => item.id && item.type);
              const childEdges = buildEdges(childTasks, task.id);
              edges.push(...childEdges);
            }
          }
        }
      }
    }
  }
  return edges;
}

export function convertFlowModelToWorkflow(
  flowModel: FlowModel,
  workflowId: string,
  name: string,
  folderId?: number,
  flowId?: string,
): Workflow {
  const allTasks = collectAllTasks(flowModel.tasks || []);
  const edges = buildEdges(flowModel.tasks || []);

  let x = 200;
  let y = 100;
  const spacing = 120;

  const nodes: WorkflowNode[] = allTasks.map((task) => {
    const node: WorkflowNode = {
      id: task.id,
      type: task.type,
      position: { x, y },
      data: {
        label: task.description || task.id,
        type: task.type as WorkflowNodeType,
        config: {},
      },
    };

    const flowControlConfig = getFlowControlConfig(task.type);
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
    node.data.config = config;

    x += spacing;
    if (x > 800) {
      x = 200;
      y += spacing;
    }

    return node;
  });

  return {
    id: workflowId,
    name,
    description: name,
    folderId,
    nodes,
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
