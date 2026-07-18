import type { FlowModel, FlowTask } from '#/api/core/workflow';
import type { Workflow, WorkflowEdge, WorkflowNode } from '#/types/workflow';

import { getFlowControlConfig } from '../config/workflow-node-config';

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
    if (!edgesMap.has(edge.source)) {
      edgesMap.set(edge.source, []);
    }
    edgesMap.get(edge.source)!.push(edge);
  });

  function convertNode(node: WorkflowNode): FlowTask {
    visited.add(node.id);

    const flowControlConfig = getFlowControlConfig(node.data.type);
    const task: FlowTask = {
      id: node.id,
      type: node.data.type,
    };

    if (node.data.config) {
      Object.keys(node.data.config).forEach((key) => {
        const configValue = node.data.config![key];

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
    const node = queue.shift()!;
    sortedNodes.push(node);

    const sourceEdges = edgesMap.get(node.id) || [];
    sourceEdges.forEach((edge) => {
      const currentDegree = inDegree.get(edge.target)! - 1;
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
    flowId: workflow.id.replace('workflow-', ''),
    flowModel,
  };
}
