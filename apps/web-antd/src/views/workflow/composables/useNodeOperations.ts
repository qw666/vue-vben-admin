import type { Ref } from 'vue';
import { message } from 'ant-design-vue';
import { useWorkflowStore } from '#/store/workflow';
import type { WorkflowNode } from '#/types/workflow';
import { rewriteVarReferences } from './useVarSources';
import { rewriteNodeIdsInConfig } from '../nodes/containerNodeAccessor';
import type { Connection, NodeConfigForm } from '../types/workflow';

const CONTAINER_TASK_FIELDS = ['tasks', 'then', 'else', 'errors', 'finally', 'next', 'defaults', 'cases'];

export function useNodeOperations(
  selectedNode: Ref<WorkflowNode | null>,
  nodeConfigForm: NodeConfigForm,
  connections: Ref<Connection[]>,
  getParentNodeFieldInfo: (nodeId: string) => { parentId: string; field: string } | null,
) {
  const store = useWorkflowStore();

  function removeNodeFromCase(fieldKey: string, caseKey: string, index: number) {
    const node = store.currentWorkflow?.nodes.find(
      (n) => n.id === selectedNode.value?.id,
    );
    if (node && node.data.config?.[fieldKey]?.[caseKey]) {
      const items = [...node.data.config[fieldKey][caseKey]];
      const removedItem = items.splice(index, 1)[0];
      node.data.config[fieldKey][caseKey] = items;
      node.data.config[fieldKey] = { ...node.data.config[fieldKey] };
      store.updateNode(node.id, { data: { ...node.data } });
      if (nodeConfigForm[fieldKey]) {
        nodeConfigForm[fieldKey] = { ...node.data.config[fieldKey] };
      }
      if (removedItem?.nodeId && store.currentWorkflow) {
        store.currentWorkflow.edges = (store.currentWorkflow.edges || []).filter(
          (conn) =>
            !(conn.source === node.id && conn.target === removedItem.nodeId),
        );
        connections.value = connections.value.filter(
          (conn) =>
            !(conn.source === node.id && conn.target === removedItem.nodeId),
        );
        store.removeNode(removedItem.nodeId);
      }
    }
  }

  function updateNodeLabel(value: string) {
    const node = store.currentWorkflow?.nodes.find(
      (n) => n.id === selectedNode.value?.id,
    );
    if (node) {
      node.data.label = value;
      store.updateNode(node.id, { data: { ...node.data } });

      const parentInfo = getParentNodeFieldInfo(node.id);
      if (parentInfo) {
        const parentNode = store.currentWorkflow?.nodes.find(n => n.id === parentInfo.parentId);
        if (parentNode) {
          const configValue = parentNode.data.config?.[parentInfo.field];
          const updateLabelInItems = (items: any[]) => {
            for (const item of items) {
              if (item.nodeId === node.id) {
                item.label = value;
              }
            }
          };
          if (Array.isArray(configValue)) {
            updateLabelInItems(configValue);
          } else if (typeof configValue === 'object' && configValue !== null) {
            for (const caseKey of Object.keys(configValue)) {
              if (Array.isArray(configValue[caseKey])) {
                updateLabelInItems(configValue[caseKey]);
              }
            }
          }
          parentNode.data.config = { ...parentNode.data.config };
          store.updateNode(parentNode.id, { data: { ...parentNode.data } });

          if (nodeConfigForm[parentInfo.field]) {
            nodeConfigForm[parentInfo.field] = parentNode.data.config[parentInfo.field];
          }
        }
      }

      const freshNode = store.currentWorkflow?.nodes.find(
        (n) => n.id === selectedNode.value?.id,
      );
      if (freshNode) {
        selectedNode.value = freshNode;
      }
    }
  }

  function rewriteTaskItemNodeIds(config: any, oldId: string, newId: string) {
    if (!config || typeof config !== 'object') return;
    rewriteNodeIdsInConfig(config, CONTAINER_TASK_FIELDS, oldId, newId);
  }

  function updateNodeId(value: string) {
    const node = store.currentWorkflow?.nodes.find(
      (n) => n.id === selectedNode.value?.id,
    );
    if (!node) return;

    const sanitized = value.replaceAll(/[^a-zA-Z0-9_-]/g, '');
    if (sanitized !== value) return;

    const oldId = node.id;
    if (oldId === value) return;

    const exists = store.currentWorkflow?.nodes.some((n: any) => n.id === value);
    if (exists) {
      message.warning(`节点ID "${value}" 已存在`);
      return;
    }

    node.id = value;

    if (store.currentWorkflow) {
      store.currentWorkflow.edges.forEach((e: any) => {
        if (e.source === oldId) e.source = value;
        if (e.target === oldId) e.target = value;
        if (e.sourceHandle) {
          e.sourceHandle = e.sourceHandle.replace(`${oldId}-`, `${value}-`);
        }
        if (e.targetHandle) {
          e.targetHandle = e.targetHandle.replace(`${oldId}-`, `${value}-`);
        }
      });
    }

    if (store.currentWorkflow) {
      store.currentWorkflow.nodes.forEach((n: any) => {
        if (n.id === value) return;
        if (n.data?.config) {
          n.data.config = rewriteVarReferences(n.data.config, oldId, value);
          rewriteTaskItemNodeIds(n.data.config, oldId, value);
        }
      });
    }

    if (node.data?.config) {
      rewriteTaskItemNodeIds(node.data.config, oldId, value);
    }

    const freshNode = store.currentWorkflow?.nodes.find(
      (n: any) => n.id === value,
    );
    if (freshNode) {
      selectedNode.value = freshNode;
    }
  }

  return {
    removeNodeFromCase,
    updateNodeLabel,
    updateNodeId,
    rewriteTaskItemNodeIds,
  };
}
