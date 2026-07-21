import type { FlowModel, FlowTask } from '#/api/core/workflow';
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType } from '#/types/workflow';

import { getFlowControlConfig } from '../config/workflow-node-config';
import { generateFlowId } from './idGenerator';
import { flowControlNodeRegistry, mapTaskField, forEachTaskField } from '../nodes/types';

function convertTaskToConfig(task: FlowTask, flowControlConfig: any, allTasks: FlowTask[]): Record<string, any> {
  const config: Record<string, any> = {};
  for (const key of Object.keys(task)) {
    if (key === 'id' || key === 'type' || key === 'description') {
      continue;
    }
    if (flowControlConfig && flowControlConfig.taskFields?.includes(key)) {
      const fieldValue = task[key];
      const mapped = mapTaskField(fieldValue, (item) => {
        if (item.id && item.type) {
          const fullTask = allTasks.find(t => t.id === item.id);
          if (fullTask) {
            const childFlowControlConfig = getFlowControlConfig(fullTask.type);
            const childConfig = convertTaskToConfig(fullTask, childFlowControlConfig, allTasks);
            return {
              type: fullTask.type,
              nodeId: fullTask.id,
              label: fullTask.description || fullTask.id,
              ...childConfig,
            };
          }
          return { nodeId: item.id };
        }
        return item;
      });
      if (mapped !== undefined) {
        config[key] = mapped;
      } else {
        config[key] = fieldValue;
      }
    } else {
      config[key] = task[key];
    }
  }
  return flowControlNodeRegistry.deserializeConfig(task.type, config);
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
        forEachTaskField(fieldValue, (item) => {
          if (item.id && item.type) {
            extractAllTasks([item], allTasks);
          }
        });
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
          let prevItem: FlowTask | null = null;
          for (const item of fieldValue) {
            if (item.id && item.type) {
              if (!prevItem) {
                buildEdges([item], task, edges, field, undefined);
              } else {
                const prevFlowControlConfig = getFlowControlConfig(prevItem.type);
                const sourceHandle = prevFlowControlConfig
                  ? `${prevItem.id}-output-next`
                  : `${prevItem.id}-output`;
                edges.push({
                  id: `edge-${prevItem.id}-${item.id}`,
                  source: prevItem.id,
                  target: item.id,
                  sourceHandle,
                  targetHandle: `${item.id}-input`,
                });
                buildEdges([item], undefined, edges, field, undefined);
              }
              prevItem = item;
            }
          }
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          for (const caseKey of Object.keys(fieldValue)) {
            const caseItems = fieldValue[caseKey];
            if (Array.isArray(caseItems)) {
              let prevItem: FlowTask | null = null;
              for (const item of caseItems) {
                if (item.id && item.type) {
                  if (!prevItem) {
                    buildEdges([item], task, edges, field, caseKey);
                  } else {
                    const prevFlowControlConfig = getFlowControlConfig(prevItem.type);
                    const sourceHandle = prevFlowControlConfig
                      ? `${prevItem.id}-output-next`
                      : `${prevItem.id}-output`;
                    edges.push({
                      id: `edge-${prevItem.id}-${item.id}`,
                      source: prevItem.id,
                      target: item.id,
                      sourceHandle,
                      targetHandle: `${item.id}-input`,
                    });
                    buildEdges([item], undefined, edges, field, caseKey);
                  }
                  prevItem = item;
                }
              }
            }
          }
        }
      }
    }
  }
}

interface NodePosition {
  x: number;
  y: number;
}

function calculateLayout(tasks: FlowTask[], nodesMap: Map<string, NodePosition>): { height: number; width: number } {
  const NODE_WIDTH = 176;
  const NODE_HEIGHT = 68;
  const VERTICAL_SPACING = 80;
  const BRANCH_SPACING = 200;

  let currentX = 0;
  let currentY = 0;
  let maxWidth = NODE_WIDTH;
  let maxHeight = NODE_HEIGHT;

  const processed = new Set<string>();

  function processTask(task: FlowTask, x: number, y: number): { height: number; width: number } {
    if (!task || processed.has(task.id)) return { height: 0, width: 0 };

    processed.add(task.id);
    nodesMap.set(task.id, { x, y });

    let nodeWidth = NODE_WIDTH;
    let nodeHeight = NODE_HEIGHT;

    const flowControlConfig = getFlowControlConfig(task.type);
    if (flowControlConfig && flowControlConfig.taskFields) {
      const childY = y + NODE_HEIGHT + VERTICAL_SPACING;
      const branchItems: FlowTask[][] = [];

      for (const field of flowControlConfig.taskFields) {
        const fieldValue = task[field];
        forEachTaskField(fieldValue, (item) => {
          if (item.id && item.type) {
            branchItems.push([item]);
          }
        });
      }

      const numBranches = branchItems.length;
      if (numBranches > 0) {
        const totalBranchWidth = numBranches * NODE_WIDTH + (numBranches - 1) * BRANCH_SPACING;
        const startBranchX = x + NODE_WIDTH / 2 - totalBranchWidth / 2;

        let branchMaxHeight = 0;
        for (let i = 0; i < numBranches; i++) {
          const childTasks = branchItems[i];
          if (!childTasks) continue;

          const branchX = startBranchX + i * (NODE_WIDTH + BRANCH_SPACING);
          for (const childTask of childTasks) {
            const result = processTask(childTask, branchX, childY);
            branchMaxHeight = Math.max(branchMaxHeight, result.height);
          }
        }

        nodeWidth = Math.max(nodeWidth, startBranchX + totalBranchWidth - x);
        nodeHeight = NODE_HEIGHT + VERTICAL_SPACING + branchMaxHeight;
      }
    }

    return { height: nodeHeight, width: nodeWidth };
  }

  for (const task of tasks) {
    if (!task || processed.has(task.id)) continue;

    const result = processTask(task, currentX, currentY);
    maxWidth = Math.max(maxWidth, currentX + result.width);
    maxHeight = Math.max(maxHeight, currentY + result.height);

    currentY += result.height + VERTICAL_SPACING;
  }

  return { height: maxHeight, width: maxWidth };
}

export function convertFlowModelToWorkflow(
  flowModel: FlowModel,
  workflowId: string,
  name: string,
  folderId?: number,
  flowId?: string,
  pluginGroupsCache: Record<string, any[]> = {},
  flowLayout?: string,
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

  const nodesMap = new Map<string, NodePosition>();

  let layoutWidth = 0;
  let layoutHeight = 0;

  if (flowLayout) {
    try {
      const parsedLayout = JSON.parse(flowLayout);
      if (parsedLayout && parsedLayout.nodes) {
        const layoutNodes = parsedLayout.nodes as Record<string, { x: number; y: number }>;
        let maxX = 0;
        let maxY = 0;
        for (const task of allTasks) {
          const pos = layoutNodes[task.id];
          if (pos) {
            nodesMap.set(task.id, pos);
            maxX = Math.max(maxX, pos.x + 176);
            maxY = Math.max(maxY, pos.y + 68);
          }
        }
        if (nodesMap.size > 0) {
          layoutWidth = maxX;
          layoutHeight = maxY;
        }
      }
    } catch {
    }
  }

  if (nodesMap.size === 0) {
    const { width, height } = calculateLayout(tasks, nodesMap);
    layoutWidth = width;
    layoutHeight = height;
  }

  const nodes: WorkflowNode[] = allTasks.map((task) => {
    const flowControlConfig = getFlowControlConfig(task.type);
    const config = convertTaskToConfig(task, flowControlConfig, allTasks);

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

    const position = nodesMap.get(task.id) || { x: 0, y: 0 };

    return {
      id: task.id,
      type: task.type,
      position,
      data: {
        label: task.description || task.id,
        type: task.type as WorkflowNodeType,
        icon,
        description,
        config,
      },
    };
  });

  let positionedNodes = nodes;

  if (!flowLayout && nodes.length > 0) {
    const CANVAS_WIDTH = 4000;
    const CANVAS_HEIGHT = 4000;
    const offsetX = (CANVAS_WIDTH - layoutWidth) / 2;
    const offsetY = (CANVAS_HEIGHT - layoutHeight) / 2;
    positionedNodes = nodes.map((node) => ({
      ...node,
      position: {
        x: node.position.x + offsetX,
        y: node.position.y + offsetY,
      },
    }));
  }

  return {
    id: workflowId,
    name,
    description: name,
    folderId,
    nodes: positionedNodes,
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flowId: flowId || generateFlowId(),
  };
}

export function generateFlowLayout(nodes: WorkflowNode[]): string {
  const layoutNodes: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    layoutNodes[node.id] = { x: node.position.x, y: node.position.y };
  }
  return JSON.stringify({ nodes: layoutNodes });
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
      const serializedConfig = flowControlNodeRegistry.serializeConfig(node.data.type, config);

      Object.keys(serializedConfig).forEach((key) => {
        const configValue = serializedConfig[key];

        if (flowControlConfig && key === 'next') {
          return;
        }

        if (flowControlConfig && flowControlConfig.taskFields?.includes(key)) {
          const mapped = mapTaskField(configValue, (item) => {
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
          if (mapped !== undefined) {
            task[key] = mapped;
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
  const flowLayout = generateFlowLayout(workflow.nodes);

  return {
    projectId,
    folderId: workflow.folderId || 0,
    description: workflowName,
    flowId: workflow.flowId,
    flowModel,
    flowLayout,
  };
}
