import type { Workflow, WorkflowNode, WorkflowEdge } from '#/types/workflow';
import { getFlowControlConfig } from '../config/workflow-node-config';
import type { FlowModel, FlowTask } from '#/api/core/workflow';

export function convertWorkflowToFlowModel(workflow: Workflow): FlowModel {
  const visited = new Set<string>();
  const rootTasks: FlowTask[] = [];

  const edgesMap = new Map<string, WorkflowEdge[]>();
  workflow.edges.forEach(edge => {
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
      Object.keys(node.data.config).forEach(key => {
        const configValue = node.data.config![key];
        
        if (flowControlConfig && flowControlConfig.taskFields?.includes(key)) {
          if (Array.isArray(configValue)) {
            task[key] = configValue.map((item: any) => {
              if (item.nodeId) {
                const childNode = workflow.nodes.find(n => n.id === item.nodeId);
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
            Object.keys(configValue).forEach(caseKey => {
              const caseItems = configValue[caseKey];
              if (Array.isArray(caseItems)) {
                nestedTasks[caseKey] = caseItems.map((item: any) => {
                  if (item.nodeId) {
                    const childNode = workflow.nodes.find(n => n.id === item.nodeId);
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

    if (!flowControlConfig) {
      const sourceEdges = edgesMap.get(node.id) || [];
      sourceEdges.forEach(edge => {
        const targetNode = workflow.nodes.find(n => n.id === edge.target);
        if (targetNode && !visited.has(targetNode.id)) {
          const converted = convertNode(targetNode);
          if (!task.next) {
            task.next = [];
          }
          if (Array.isArray(task.next)) {
            task.next.push(converted);
          }
        }
      });
    }

    return task;
  }

  workflow.nodes.forEach(node => {
    const hasIncoming = workflow.edges.some(e => e.target === node.id);
    if (!visited.has(node.id) && !hasIncoming) {
      rootTasks.push(convertNode(node));
    }
  });

  workflow.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      rootTasks.push(convertNode(node));
    }
  });

  return {
    tasks: rootTasks,
  };
}

export function buildFlowSavePayload(workflow: Workflow, projectId: number, workflowName: string) {
  const flowModel = convertWorkflowToFlowModel(workflow);
  
  return {
    projectId,
    folderId: workflow.folderId || 0,
    description: workflowName,
    flowId: workflow.id.replace('workflow-', ''),
    flowModel,
  };
}
