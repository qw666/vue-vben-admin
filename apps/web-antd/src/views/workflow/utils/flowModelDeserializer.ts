import type { FlowModel, FlowTask } from '#/api/core/workflow';
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType } from '#/types/workflow';

import { getFlowControlConfig } from '../config/workflow-node-config';
import { generateFlowId } from './idGenerator';
import { flowControlNodeRegistry } from '../nodes/types';
import { mapTaskField, forEachTaskField } from '../nodes/taskFieldUtils';
import { getDefaultOutputPortField, computeLayout, centerNodesInCanvas } from './flowLayout';

/**
 * 预处理：将透明容器节点展开为子任务
 */
function flattenTransparentContainers(tasks: FlowTask[]): FlowTask[] {
  return tasks.map((task) => {
    const config = getFlowControlConfig(task.type);
    if (!config?.taskFields) return task;

    const result = { ...task };
    for (const field of config.taskFields) {
      const fieldValue = task[field];
      if (!fieldValue) continue;

      const port = config.ports?.output?.find((p: any) => p.field === field);
      const connectionMode = port?.connectionMode || 'sequential';

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
                  for (const subField of itemConfig.taskFields) {
                    const subItems = item[subField];
                    if (Array.isArray(subItems) && subItems.length > 0) {
                      const firstChild = subItems[0];
                      if (firstChild?.id && firstChild?.type) {
                        buildEdges([firstChild], task, edges, field, undefined);
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

  const { nodesMap, layoutWidth, layoutHeight } = computeLayout(tasks, allTasks, flowLayout);

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
    positionedNodes = centerNodesInCanvas(nodes, layoutWidth, layoutHeight);
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
