import { useWorkflowStore } from '#/store/workflow';
import type { WorkflowNode } from '#/types/workflow';
import { getFlowControlConfig, flowControlNodeRegistry } from '../config/workflow-node-config';
import type { NodeConfigForm, SelectedNode, TaskItem } from '../types/workflow';
import {
  getAllChildIds,
  forEachChild,
  addChildToConfig,
  removeChildFromConfig,
  updateChildInConfig,
  getExcludeFields,
  findChildLocation,
} from '../nodes/containerNodeAccessor';

export function useFlowControlNode(
  nodeConfigForm?: NodeConfigForm,
  selectedNode?: SelectedNode
) {
  const store = useWorkflowStore();

  function getChildNodeIds(nodeId: string): string[] {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId) as WorkflowNode | undefined;
    if (!node) return [];

    const flowControlConfig = getFlowControlConfig(node.data.type);
    const taskFields = flowControlConfig.taskFields || [];
    const excludeFields = getExcludeFields(taskFields, flowControlConfig.ports?.output);
    const edges = store.currentWorkflow?.edges || [];

    // Follow edges to collect chain descendants (sequential mode only)
    const collectChainDescendants = (startNodeId: string, collected: string[]) => {
      const downstreamEdges = edges.filter(e => e.source === startNodeId);
      for (const edge of downstreamEdges) {
        const targetNode = store.currentWorkflow?.nodes.find(n => n.id === edge.target);
        if (!targetNode) continue;
        if (flowControlNodeRegistry.isFlowControlContainer(targetNode.data.type)) continue;
        if (targetNode.data.type === 'idp_core_flow_End') continue;
        if (!collected.includes(targetNode.id)) {
          collected.push(targetNode.id);
          collectChainDescendants(targetNode.id, collected);
          const nestedChildIds = getChildNodeIds(targetNode.id);
          nestedChildIds.forEach(id => {
            if (!collected.includes(id)) collected.push(id);
          });
        }
      }
    };

    // Use getAllChildIds for direct children (with exclude filter)
    const config = node.data.config || {};
    const activeFields = taskFields.filter(f => !excludeFields.includes(f));
    const directChildIds = getAllChildIds(config, activeFields);

    // Collect chain descendants for each direct child
    const result = [...directChildIds];
    for (const childId of directChildIds) {
      collectChainDescendants(childId, result);
      // Also recursively get nested flow control children (e.g. Switch inside Parallel)
      const nestedChildIds = getChildNodeIds(childId);
      nestedChildIds.forEach(id => {
        if (!result.includes(id)) result.push(id);
      });
    }

    return result;
  }

  function getParentNodeId(nodeId: string): string | null {
    if (!store.currentWorkflow) return null;

    for (const node of store.currentWorkflow.nodes) {
      if (!flowControlNodeRegistry.isFlowControlContainer(node.data.type)) continue;

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
      if (!flowControlNodeRegistry.isFlowControlContainer(node.data.type)) continue;

      const flowControlConfig = getFlowControlConfig(node.data.type);
      const taskFields = flowControlConfig.taskFields || [];

      // Check if nodeId is a direct child
      const location = findChildLocation(node.data.config || {}, taskFields, nodeId);
      if (location) {
        return { parentId: node.id, field: location.field };
      }

      // Check if nodeId is a descendant of any direct child
      for (const field of taskFields) {
        let found = false;
        forEachChild(node.data.config || {}, [field], [], (item) => {
          if (item.nodeId) {
            const descendants = getChildNodeIds(item.nodeId);
            if (descendants.includes(nodeId)) {
              found = true;
            }
          }
        });
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
    const taskFields = flowControlConfig.taskFields || [];
    const excludeFields = getExcludeFields(taskFields, flowControlConfig.ports?.output);

    const config = node.data.config || {};
    const activeFields = taskFields.filter(f => !excludeFields.includes(f));
    return getAllChildIds(config, activeFields);
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

    addChildToConfig(node.data.config, taskFields, fieldKey, taskItem);

    if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
      addChildToConfig(nodeConfigForm as Record<string, any>, taskFields, fieldKey, taskItem);
    }
  }

  function removeChildNode(nodeId: string, _fieldKey: string, childNodeId: string) {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (!node.data.config) {
      node.data.config = {};
    }

    const flowControlConfig = getFlowControlConfig(node.data.type);
    const taskFields = flowControlConfig.taskFields || [];

    removeChildFromConfig(node.data.config, taskFields, childNodeId);

    if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
      removeChildFromConfig(nodeConfigForm as Record<string, any>, taskFields, childNodeId);
    }

    store.currentWorkflow!.edges = (store.currentWorkflow?.edges || []).filter(
      conn => !(conn.target === childNodeId && conn.source === nodeId)
    );
  }

  function updateChildNodeLabel(nodeId: string, _fieldKey: string, childNodeId: string, newLabel: string) {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const flowControlConfig = getFlowControlConfig(node.data.type);
    const taskFields = flowControlConfig.taskFields || [];

    updateChildInConfig(node.data.config, taskFields, childNodeId, (item) => {
      item.label = newLabel;
    });

    if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
      updateChildInConfig(nodeConfigForm as Record<string, any>, taskFields, childNodeId, (item) => {
        item.label = newLabel;
      });
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
