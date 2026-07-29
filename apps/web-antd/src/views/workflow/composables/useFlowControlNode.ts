import { useWorkflowStore } from '#/store/workflow';
import type { WorkflowNode } from '#/types/workflow';
import { getFlowControlConfig, flowControlNodeRegistry } from '../config/workflow-node-config';
import type { NodeConfigForm, SelectedNode, TaskItem } from '../types/workflow';
import { forEachTaskField, filterTaskField, findTaskField } from '../nodes/types';

export function useFlowControlNode(
  nodeConfigForm?: NodeConfigForm,
  selectedNode?: SelectedNode
) {
  const store = useWorkflowStore();

  function getExcludeFields(flowControlConfig: any): string[] {
    const excludeFields: string[] = ['next'];
    if (flowControlConfig.ports?.output) {
      flowControlConfig.ports.output.forEach((port: any) => {
        if (port.excludeFromBounds) {
          excludeFields.push(port.field);
        }
      });
    }
    return excludeFields;
  }

  function getChildNodeIds(nodeId: string): string[] {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId) as WorkflowNode | undefined;
    if (!node) return [];

    const flowControlConfig = getFlowControlConfig(node.data.type);

    const childIds: string[] = [];
    const taskFields = flowControlConfig.taskFields || [];
    const excludeFields = getExcludeFields(flowControlConfig);

    taskFields.forEach(field => {
      if (excludeFields.includes(field)) return;
      const configValue = node.data.config?.[field];
      forEachTaskField(configValue, (item) => {
        if (item.nodeId) {
          if (!childIds.includes(item.nodeId)) {
            childIds.push(item.nodeId);
          }
          const nestedChildIds = getChildNodeIds(item.nodeId);
          nestedChildIds.forEach(nestedId => {
            if (!childIds.includes(nestedId)) {
              childIds.push(nestedId);
            }
          });
        }
      });
    });

    return childIds;
  }

  function getParentNodeId(nodeId: string): string | null {
    if (!store.currentWorkflow) return null;

    for (const node of store.currentWorkflow.nodes) {
      if (!flowControlNodeRegistry.isFlowControlNode(node.data.type)) continue;

      const directChildIds = getDirectChildNodeIds(node.id);
      if (directChildIds.includes(nodeId)) {
        return node.id;
      }
    }

    return null;
  }

  function getParentNodeFieldInfo(nodeId: string): { parentId: string; field: string } | null {
    if (!store.currentWorkflow) return null;

    for (const node of store.currentWorkflow.nodes) {
      if (!flowControlNodeRegistry.isFlowControlNode(node.data.type)) continue;

      const flowControlConfig = getFlowControlConfig(node.data.type);
      const taskFields = flowControlConfig.taskFields || [];

      for (const field of taskFields) {
        const configValue = node.data.config?.[field];
        let found = false;

        if (Array.isArray(configValue)) {
          found = configValue.some((item: any) => item.nodeId === nodeId);
        } else if (typeof configValue === 'object' && configValue !== null) {
          for (const caseKey of Object.keys(configValue)) {
            const caseItems = configValue[caseKey];
            if (Array.isArray(caseItems) && caseItems.some((item: any) => item.nodeId === nodeId)) {
              found = true;
              break;
            }
          }
        }

        if (found) {
          return { parentId: node.id, field };
        }
      }
    }

    return null;
  }

  function getDirectChildNodeIds(nodeId: string): string[] {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId) as WorkflowNode | undefined;
    if (!node) return [];

    const flowControlConfig = getFlowControlConfig(node.data.type);

    const childIds: string[] = [];
    const taskFields = flowControlConfig.taskFields || [];
    const excludeFields = getExcludeFields(flowControlConfig);

    taskFields.forEach(field => {
      if (excludeFields.includes(field)) return;
      const configValue = node.data.config?.[field];
      forEachTaskField(configValue, (item) => {
        if (item.nodeId) {
          if (!childIds.includes(item.nodeId)) {
            childIds.push(item.nodeId);
          }
        }
      });
    });

    return childIds;
  }

  function addChildNode(nodeId: string, fieldKey: string, childNode: WorkflowNode) {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId) as WorkflowNode | undefined;
    if (!node) return;

    if (!node.data.config) {
      node.data.config = {};
    }

    const flowControlConfig = getFlowControlConfig(node.data.type);

    const taskFields = flowControlConfig.taskFields || [];
    if (!taskFields.includes(fieldKey)) return;

    const taskItem: TaskItem = {
      type: childNode.data.type,
      nodeId: childNode.id,
      label: childNode.data.label,
      ...(childNode.data.config || {}),
    };

    const addToField = (target: any) => {
      const currentValue = target[fieldKey];
      if (Array.isArray(currentValue)) {
        const existing = currentValue.find((item: any) => item.nodeId === childNode.id);
        if (!existing) {
          target[fieldKey] = [...currentValue, taskItem];
        }
      } else if (typeof currentValue === 'object' && currentValue !== null) {
        forEachTaskField(currentValue, (item) => {
          if (item.nodeId === childNode.id) {
            throw new Error('already_exists');
          }
        });
        Object.keys(currentValue).forEach(key => {
          const caseItems = currentValue[key];
          if (Array.isArray(caseItems)) {
            caseItems.push(taskItem);
          }
        });
      } else {
        target[fieldKey] = [taskItem];
      }
    };

    try {
      addToField(node.data.config);
      if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
        addToField(nodeConfigForm);
      }
    } catch {
    }
  }

  function removeChildNode(nodeId: string, fieldKey: string, childNodeId: string) {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (!node.data.config) {
      node.data.config = {};
    }

    const removeFromField = (target: any) => {
      const currentValue = target[fieldKey];
      const filtered = filterTaskField(currentValue, (item) => item.nodeId !== childNodeId);
      if (filtered !== undefined) {
        target[fieldKey] = filtered;
      }
    };

    removeFromField(node.data.config);

    if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
      removeFromField(nodeConfigForm);
    }

    store.currentWorkflow!.edges = (store.currentWorkflow?.edges || []).filter(
      conn => !(conn.target === childNodeId && conn.source === nodeId)
    );
  }

  function updateChildNodeLabel(nodeId: string, fieldKey: string, childNodeId: string, newLabel: string) {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const updateInField = (target: any) => {
      const currentValue = target[fieldKey];
      const item = findTaskField(currentValue, (item) => item.nodeId === childNodeId);
      if (item) {
        item.label = newLabel;
      }
    };

    updateInField(node.data.config);

    if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
      updateInField(nodeConfigForm);
    }
  }

  return {
    getChildNodeIds,
    getParentNodeId,
    getParentNodeFieldInfo,
    addChildNode,
    removeChildNode,
    updateChildNodeLabel,
  };
}
