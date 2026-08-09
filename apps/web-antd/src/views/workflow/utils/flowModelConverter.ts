import type { FlowModel, FlowTask } from '#/api/core/workflow';
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType } from '#/types/workflow';

import { getFlowControlConfig } from '../config/workflow-node-config';
import { generateFlowId } from './idGenerator';
import { flowControlNodeRegistry, mapTaskField, forEachTaskField } from '../nodes/types';

/**
 * 获取节点默认输出端口的 field 名称
 * 容器节点(If/Switch/ForEach/Parallel)的默认端口是 next，普通节点是 output
 */
export function getDefaultOutputPortField(nodeType: string): string {
  const config = getFlowControlConfig(nodeType);
  const outputPorts: any[] = config?.ports?.output || [];
  if (outputPorts.length > 0) {
    // 优先返回 next 端口（容器节点的下游出口）
    const nextPort = outputPorts.find(p => p.field === 'next');
    if (nextPort) return 'next';
    // 否则返回第一个端口的 field
    return outputPorts[0].field;
  }
  return 'output'; // 默认回退
}

/**
 * 预处理：将透明容器节点展开为子任务
 * 
 * 功能：在加载流程模型到画布之前，将 Sequential 等透明容器节点
 *       就地展开为其子任务数组
 * 
 * 规则：
 *   - 只对 connectionMode 为 sequential/cases 的字段执行展开
 *   - 对 parallel 模式的字段不展开（保留 Sequential 节点以保持分支内的链式关系）
 *   - 后续的 extractAllTasks/buildEdges/convertTaskToConfig 会基于
 *     transparentContainer 标志处理保留的 Sequential 节点
 */
function flattenTransparentContainers(tasks: FlowTask[]): FlowTask[] {
  return tasks.map((task) => {
    const config = getFlowControlConfig(task.type);
    if (!config?.taskFields) return task;

    const result = { ...task };
    for (const field of config.taskFields) {
      const fieldValue = task[field];
      if (!fieldValue) continue;

      // 获取该字段对应的 port 配置，判断 connectionMode
      const port = config.ports?.output?.find((p: any) => p.field === field);
      const connectionMode = port?.connectionMode || 'sequential';

      // 只对 sequential/cases 模式执行展开
      // parallel 模式下每个数组元素是独立分支，展开会丢失链式关系
      if (connectionMode === 'parallel') {
        continue;
      }

      const processItems = (items: any[]): any[] => {
        return items.flatMap((item) => {
          if (!item?.id || !item?.type) return [item];

          const itemConfig = getFlowControlConfig(item.type);
          if (itemConfig?.transparentContainer && itemConfig.taskFields) {
            for (const subField of itemConfig.taskFields) {
              const subItems = item[subField];
              if (Array.isArray(subItems)) {
                return flattenTransparentContainers(subItems);
              }
            }
            return [item];
          }
          return [item];
        });
      };

      if (Array.isArray(fieldValue)) {
        result[field] = processItems(fieldValue);
      } else if (typeof fieldValue === 'object' && fieldValue !== null) {
        const mapped: Record<string, any[]> = {};
        for (const caseKey of Object.keys(fieldValue)) {
          const caseItems = fieldValue[caseKey];
          if (Array.isArray(caseItems)) {
            mapped[caseKey] = processItems(caseItems);
          }
        }
        if (Object.keys(mapped).length > 0) {
          result[field] = mapped;
        }
      }
    }
    return result;
  });
}

function convertTaskToConfig(task: FlowTask, flowControlConfig: any, allTasks: FlowTask[]): Record<string, any> {
  const config: Record<string, any> = {};
  for (const key of Object.keys(task)) {
    if (key === 'id' || key === 'type' || key === 'description') {
      continue;
    }
    if (flowControlConfig.taskFields?.includes(key)) {
      const fieldValue = task[key];
      const mapped = mapTaskField(fieldValue, (item) => {
        if (item.id && item.type) {
          const itemConfig = getFlowControlConfig(item.type);
          
          // 透明容器：替换为首个子任务的引用
          if (itemConfig?.transparentContainer && itemConfig.taskFields) {
            for (const subField of itemConfig.taskFields) {
              const subItems = item[subField];
              if (Array.isArray(subItems) && subItems.length > 0) {
                const firstChild = subItems[0];
                if (firstChild?.id && firstChild?.type) {
                  return {
                    type: firstChild.type,
                    nodeId: firstChild.id,
                    label: firstChild.description || firstChild.id,
                  };
                }
              }
            }
            return { nodeId: item.id };
          }
          
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
    const flowControlConfig = getFlowControlConfig(task.type);
    
    // 透明容器：跳过自身，但递归处理子任务
    if (flowControlConfig?.transparentContainer) {
      if (flowControlConfig.taskFields) {
        for (const field of flowControlConfig.taskFields) {
          const fieldValue = task[field];
          forEachTaskField(fieldValue, (item) => {
            if (item.id && item.type) {
              extractAllTasks([item], allTasks);
            }
          });
        }
      }
      continue;
    }
    
    if (!allTasks.find(t => t.id === task.id)) {
      allTasks.push(task);
    }
    if (flowControlConfig.taskFields) {
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
    if (flowControlConfig.taskFields) {
      for (const field of flowControlConfig.taskFields) {
        const fieldValue = task[field];
        
        const port = flowControlConfig.ports.output?.find((p: any) => p.field === field);
        const connectionMode = port?.connectionMode || 'sequential';
        
        if (Array.isArray(fieldValue)) {
          if (connectionMode === 'parallel') {
            fieldValue.forEach(item => {
              if (item.id && item.type) {
                const itemConfig = getFlowControlConfig(item.type);
                
                if (itemConfig?.transparentContainer && itemConfig.taskFields) {
                  // 透明容器：连接父节点→首个子节点 + 子节点间链式边
                  for (const subField of itemConfig.taskFields) {
                    const subItems = item[subField];
                    if (Array.isArray(subItems) && subItems.length > 0) {
                      const firstChild = subItems[0];
                      if (firstChild?.id && firstChild?.type) {
                        // 父节点→首个子节点
                        buildEdges([firstChild], task, edges, field, undefined);
                        // 子节点间链式边
                        for (let i = 1; i < subItems.length; i++) {
                          const prevItem = subItems[i - 1];
                          const currItem = subItems[i];
                          if (prevItem.id && currItem.id) {
                            const portField = getDefaultOutputPortField(prevItem.type);
                            edges.push({
                              id: `edge-${prevItem.id}-${currItem.id}`,
                              source: prevItem.id,
                              target: currItem.id,
                              sourceHandle: `${prevItem.id}-output-${portField}`,
                              targetHandle: `${currItem.id}-input`,
                            });
                            buildEdges([currItem], undefined, edges, field, undefined);
                          }
                        }
                      }
                    }
                  }
                } else {
                  buildEdges([item], task, edges, field, undefined);
                }
              }
            });
          } else {
            let prevItem: FlowTask | null = null;
            for (const item of fieldValue) {
              if (item.id && item.type) {
                if (!prevItem) {
                  buildEdges([item], task, edges, field, undefined);
                } else {
                  const portField = getDefaultOutputPortField(prevItem.type);
                  const sourceHandle = `${prevItem.id}-output-${portField}`;
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
                    const portField = getDefaultOutputPortField(prevItem.type);
                    const sourceHandle = `${prevItem.id}-output-${portField}`;
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
  const NODE_WIDTH = 144;
  const NODE_HEIGHT = 48;
  const VERTICAL_SPACING = 40;
  const BRANCH_SPACING = 150;

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
    if (flowControlConfig.taskFields) {
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
  const tasks = flattenTransparentContainers(flowModel.tasks || []);

  const allTasks = extractAllTasks(tasks);

  const edges: WorkflowEdge[] = [];
  buildEdges(tasks, undefined, edges);

  for (let i = 0; i < tasks.length - 1; i++) {
    const currentTask = tasks[i];
    const nextTask = tasks[i + 1];
    if (currentTask && nextTask) {
      const portField = getDefaultOutputPortField(currentTask.type);
      const sourceHandle = `${currentTask.id}-output-${portField}`;
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
        if (layoutNodes['start']) {
          maxX = Math.max(maxX, layoutNodes['start'].x + 176);
          maxY = Math.max(maxY, layoutNodes['start'].y + 68);
        }
        if (layoutNodes['end']) {
          maxX = Math.max(maxX, layoutNodes['end'].x + 176);
          maxY = Math.max(maxY, layoutNodes['end'].y + 68);
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

    let icon = flowControlConfig.icon || 'mdi:circle';
    let description = flowControlConfig.description || '基础';

    if (!flowControlNodeRegistry.isFlowControlContainer(task.type)) {
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
    outputs: flowModel.outputs || [],
    inputs: flowModel.inputs || [],
    triggers: (flowModel.triggers || []).map((t: any) => ({
      ...t,
      disabled: t.disabled !== undefined ? t.disabled : false,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flowId: flowId || generateFlowId(),
    flowLayout,
    enabled: !flowModel.disabled,
  };
}

export function generateFlowLayout(nodes: WorkflowNode[]): string {
  const layoutNodes: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    let key = node.id;
    if (node.data.type === 'idp_core_flow_Start') {
      key = 'start';
    } else if (node.data.type === 'idp_core_flow_End') {
      key = 'end';
    }
    layoutNodes[key] = { x: node.position.x, y: node.position.y };
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

  // Convert a single node to FlowTask (handles nested flow control children)
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
      // 统一通过策略的 serializeConfig 序列化（OutputValues 等所有策略节点都走此路径）
      const serializedConfig = flowControlNodeRegistry.serializeConfig(node.data.type, config);

      const childFlowConfig = getFlowControlConfig(node.data.type);

      Object.keys(serializedConfig).forEach((key) => {
        if (key === 'next') return;

        const configValue = serializedConfig[key];

        if (childFlowConfig.taskFields?.includes(key)) {
          const port = childFlowConfig.ports?.output?.find((p: any) => p.field === key);
          const mode = port?.connectionMode || 'sequential';

          if (mode === 'parallel') {
            // Parallel: 优先委托给策略的 serializeTaskFieldItems 方法
            const strategy = flowControlNodeRegistry.get(node.data.type);
            if (strategy?.serializeTaskFieldItems && Array.isArray(configValue)) {
              task[key] = strategy.serializeTaskFieldItems(key, configValue, {
                collectChain: collectChain,
              });
            } else {
              // 默认行为：直接转换（保持向后兼容）
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
            // Sequential: collect chain via edges
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

  // Collect a chain of nodes starting from startNodeId, following edges (sequential mode)
  function collectChain(startNodeId: string): FlowTask[] {
    const chain: FlowTask[] = [];
    let currentId: string | undefined = startNodeId;

    while (currentId) {
      const task = convertSingleNode(currentId);
      if (!task) break;
      chain.push(task);

      // Find next node in chain: directly filter edges by source
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
    model.triggers = workflow.triggers;
  }

  return removeEmptyValues(model);
}

export function buildFlowSavePayload(
  workflow: Workflow,
  projectId: number,
  workflowName: string,
) {
  const flowModel = convertWorkflowToFlowModel(workflow);
  const flowLayout = generateFlowLayout(workflow.nodes);

  flowModel.disabled = !workflow.enabled;

  return {
    projectId,
    folderId: workflow.folderId || 0,
    description: workflowName,
    flowId: workflow.flowId,
    flowModel,
    flowLayout,
  };
}
