import type { FlowModel, FlowTask } from '#/api/core/workflow';
import type { Workflow, WorkflowEdge, WorkflowNode } from '#/types/workflow';

import { getFlowControlConfig } from '../config/workflow-node-config';
import { flowControlNodeRegistry } from '../nodes/types';

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

  function convertSingleNode(nodeId: string): FlowTask | null {
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node || visited.has(node.id)) return null;
    visited.add(nodeId);

    const task: FlowTask = {
      id: node.id,
      type: node.data.type,
      description: node.data.label || '',
    };

    const config = node.data.config;
    if (config) {
      const serializedConfig = flowControlNodeRegistry.serializeConfig(node.data.type, config);

      const childFlowConfig = getFlowControlConfig(node.data.type);

      Object.keys(serializedConfig).forEach((key) => {
        if (key === 'next') return;

        const configValue = serializedConfig[key];

        if (childFlowConfig.taskFields?.includes(key)) {
          const port = childFlowConfig.ports?.output?.find((p: any) => p.field === key);
          const mode = port?.connectionMode || 'sequential';

          if (mode === 'parallel') {
            const strategy = flowControlNodeRegistry.get(node.data.type);
            if (strategy?.serializeTaskFieldItems && Array.isArray(configValue)) {
              task[key] = strategy.serializeTaskFieldItems(key, configValue, {
                collectChain: collectChain,
              });
            } else {
              if (Array.isArray(configValue)) {
                task[key] = configValue.map((item: any) => {
                  if (item.nodeId) {
                    const converted = convertSingleNode(item.nodeId);
                    if (converted) return converted;
                  }
                  const cleaned: any = { ...item };
                  delete cleaned.nodeId;
                  delete cleaned.label;
                  return cleaned;
                }).filter((t: any) => t !== null);
              }
            }
          } else {
            if (Array.isArray(configValue)) {
              const result: FlowTask[] = [];
              for (const item of configValue) {
                if (item.nodeId) {
                  result.push(...collectChain(item.nodeId));
                } else {
                  const cleaned: any = { ...item };
                  delete cleaned.nodeId;
                  delete cleaned.label;
                  result.push(cleaned);
                }
              }
              task[key] = result;
            } else if (typeof configValue === 'object' && configValue !== null) {
              const mapped: Record<string, FlowTask[]> = {};
              for (const caseKey of Object.keys(configValue)) {
                const caseItems = configValue[caseKey];
                if (Array.isArray(caseItems)) {
                  const caseResult: FlowTask[] = [];
                  for (const item of caseItems) {
                    if (item.nodeId) {
                      caseResult.push(...collectChain(item.nodeId));
                    } else {
                      const cleaned: any = { ...item };
                      delete cleaned.nodeId;
                      delete cleaned.label;
                      caseResult.push(cleaned);
                    }
                  }
                  mapped[caseKey] = caseResult;
                }
              }
              if (Object.keys(mapped).length > 0) {
                task[key] = mapped;
              }
            }
          }
        } else {
          task[key] = configValue;
        }
      });
    }

    return task;
  }

  function collectChain(startNodeId: string): FlowTask[] {
    const chain: FlowTask[] = [];
    let currentId: string | undefined = startNodeId;

    while (currentId) {
      const task = convertSingleNode(currentId);
      if (!task) break;
      chain.push(task);

      const downstreamEdges = workflow.edges.filter(e => e.source === currentId);
      let nextId: string | undefined;

      for (const edge of downstreamEdges) {
        const targetNode = workflow.nodes.find((n) => n.id === edge.target);
        if (!targetNode) continue;
        if (visited.has(targetNode.id)) continue;
        if (targetNode.data.type === 'idp_core_flow_End') continue;
        if (flowControlNodeRegistry.isFlowControlContainer(targetNode.data.type)) continue;

        nextId = targetNode.id;
        break;
      }
      currentId = nextId;
    }

    return chain;
  }

  function convertNode(node: WorkflowNode): FlowTask {
    const task = convertSingleNode(node.id);
    return task || { id: node.id, type: node.data.type, description: node.data.label || '' };
  }

  const inDegree = new Map<string, number>();
  workflow.nodes.forEach((node) => {
    if (node.data.type !== 'idp_core_flow_Start' && node.data.type !== 'idp_core_flow_End') {
      inDegree.set(node.id, 0);
    }
  });
  workflow.edges.forEach((edge) => {
    const sourceNode = workflow.nodes.find((n) => n.id === edge.source);
    const targetNode = workflow.nodes.find((n) => n.id === edge.target);
    if (sourceNode && sourceNode.data.type !== 'idp_core_flow_Start' &&
        targetNode && targetNode.data.type !== 'idp_core_flow_End') {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  });

  const queue: WorkflowNode[] = [];
  workflow.nodes.forEach((node) => {
    if (node.data.type !== 'idp_core_flow_Start' && node.data.type !== 'idp_core_flow_End') {
      if (inDegree.get(node.id) === 0) {
        queue.push(node);
      }
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
      const targetNode = workflow.nodes.find((n) => n.id === edge.target);
      if (targetNode && targetNode.data.type !== 'idp_core_flow_End') {
        const currentDegree = (inDegree.get(edge.target) || 0) - 1;
        inDegree.set(edge.target, currentDegree);
        if (currentDegree === 0) {
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

  if (workflow.outputs && workflow.outputs.length > 0) {
    model.outputs = workflow.outputs;
  }

  if (workflow.inputs && workflow.inputs.length > 0) {
    model.inputs = workflow.inputs;
  }

  if (workflow.triggers && workflow.triggers.length > 0) {
    model.triggers = workflow.triggers.map((t: any) => {
      if (t.type === 'idp_core_trigger_Schedule' && t.cron) {
        const parts = t.cron.trim().split(/\s+/);
        if (parts.length === 5) {
          return { ...t, cron: `0 ${t.cron}`, withSeconds: true };
        }
        if (parts.length === 6) {
          return { ...t, withSeconds: true };
        }
      }
      return t;
    });
  }

  return removeEmptyValues(model);
}
