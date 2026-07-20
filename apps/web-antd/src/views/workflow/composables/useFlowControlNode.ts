import { useWorkflowStore } from '#/store/workflow';
import type { WorkflowNode } from '#/types/workflow';
import { getFlowControlConfig } from '../config/workflow-node-config';
import type { NodeConfigForm, SelectedNode, TaskItem } from '../types/workflow';

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
    if (!flowControlConfig) return [];

    const childIds: string[] = [];
    const taskFields = flowControlConfig.taskFields || [];
    const excludeFields = getExcludeFields(flowControlConfig);

    taskFields.forEach(field => {
      if (excludeFields.includes(field)) return;
      const configValue = node.data.config?.[field];
      if (Array.isArray(configValue)) {
        configValue.forEach((item: any) => {
          if (item.nodeId && !childIds.includes(item.nodeId)) {
            childIds.push(item.nodeId);
          }
        });
      } else if (typeof configValue === 'object' && configValue !== null) {
        Object.values(configValue).forEach((caseItems: any) => {
          if (Array.isArray(caseItems)) {
            caseItems.forEach((item: any) => {
              if (item.nodeId && !childIds.includes(item.nodeId)) {
                childIds.push(item.nodeId);
              }
            });
          }
        });
      }
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
    if (!flowControlConfig) return;

    const taskFields = flowControlConfig.taskFields || [];
    if (!taskFields.includes(fieldKey)) return;

    const taskItem: TaskItem = {
      type: childNode.data.type,
      nodeId: childNode.id,
      label: childNode.data.label,
      ...(childNode.data.config || {}),
    };

    const currentValue = node.data.config[fieldKey];
    if (Array.isArray(currentValue)) {
      const existing = currentValue.find((item: any) => item.nodeId === childNode.id);
      if (!existing) {
        node.data.config[fieldKey] = [...currentValue, taskItem];
      }
    } else if (typeof currentValue === 'object' && currentValue !== null) {
      Object.keys(currentValue).forEach(key => {
        const caseItems = currentValue[key];
        if (Array.isArray(caseItems)) {
          const existing = caseItems.find((item: any) => item.nodeId === childNode.id);
          if (!existing) {
            caseItems.push(taskItem);
          }
        }
      });
    } else {
      node.data.config[fieldKey] = [taskItem];
    }

    if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
      const formValue = nodeConfigForm[fieldKey];
      if (Array.isArray(formValue)) {
        const existing = formValue.find((item: any) => item.nodeId === childNode.id);
        if (!existing) {
          nodeConfigForm[fieldKey] = [...formValue, taskItem];
        }
      } else if (typeof formValue === 'object' && formValue !== null) {
        Object.keys(formValue).forEach(key => {
          const caseItems = formValue[key];
          if (Array.isArray(caseItems)) {
            const existing = caseItems.find((item: any) => item.nodeId === childNode.id);
            if (!existing) {
              caseItems.push(taskItem);
            }
          }
        });
      } else {
        nodeConfigForm[fieldKey] = [taskItem];
      }
    }
  }

  function removeChildNode(nodeId: string, fieldKey: string, childNodeId: string) {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const currentValue = node.data.config?.[fieldKey];
    if (!node.data.config) {
      node.data.config = {};
    }
    if (Array.isArray(currentValue)) {
      node.data.config[fieldKey] = currentValue.filter((item: any) => item.nodeId !== childNodeId);
    } else if (typeof currentValue === 'object' && currentValue !== null) {
      Object.keys(currentValue).forEach(key => {
        const caseItems = currentValue[key];
        if (Array.isArray(caseItems)) {
          currentValue[key] = caseItems.filter((item: any) => item.nodeId !== childNodeId);
        }
      });
      node.data.config[fieldKey] = { ...currentValue };
    }

    if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
      const formValue = nodeConfigForm[fieldKey];
      if (Array.isArray(formValue)) {
        nodeConfigForm[fieldKey] = formValue.filter((item: any) => item.nodeId !== childNodeId);
      } else if (typeof formValue === 'object' && formValue !== null) {
        Object.keys(formValue).forEach(key => {
          const caseItems = formValue[key];
          if (Array.isArray(caseItems)) {
            formValue[key] = caseItems.filter((item: any) => item.nodeId !== childNodeId);
          }
        });
        nodeConfigForm[fieldKey] = { ...formValue };
      }
    }

    store.currentWorkflow!.edges = (store.currentWorkflow?.edges || []).filter(
      conn => !(conn.target === childNodeId && conn.source === nodeId)
    );
  }

  function updateChildNodeLabel(nodeId: string, fieldKey: string, childNodeId: string, newLabel: string) {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const currentValue = node.data.config?.[fieldKey];
    if (Array.isArray(currentValue)) {
      const item = currentValue.find((item: any) => item.nodeId === childNodeId);
      if (item) {
        item.label = newLabel;
      }
    } else if (typeof currentValue === 'object' && currentValue !== null) {
      Object.keys(currentValue).forEach(key => {
        const caseItems = currentValue[key];
        if (Array.isArray(caseItems)) {
          const item = caseItems.find((item: any) => item.nodeId === childNodeId);
          if (item) {
            item.label = newLabel;
          }
        }
      });
    }

    if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
      const formValue = nodeConfigForm[fieldKey];
      if (Array.isArray(formValue)) {
        const item = formValue.find((item: any) => item.nodeId === childNodeId);
        if (item) {
          item.label = newLabel;
        }
      } else if (typeof formValue === 'object' && formValue !== null) {
        Object.keys(formValue).forEach(key => {
          const caseItems = formValue[key];
          if (Array.isArray(caseItems)) {
            const item = caseItems.find((item: any) => item.nodeId === childNodeId);
            if (item) {
              item.label = newLabel;
            }
          }
        });
      }
    }
  }

  return {
    getChildNodeIds,
    addChildNode,
    removeChildNode,
    updateChildNodeLabel,
  };
}
