import { computed, ref } from 'vue';

import { message } from 'ant-design-vue';

import { useWorkflowStore } from '#/store/workflow';

import { flowControlNodeRegistry } from '../nodes/FlowControlNodeRegistry';

export function useCanvasSelection(
  connections: { value: { source: string; target: string }[] },
  syncConnectionToNodeConfig: (conn: any, isAdd: boolean) => void,
  onNodeDeleted?: (nodeId: string) => void
) {
  const store = useWorkflowStore();
  const selectedNodeId = ref<string | null>(null);
  const multiSelectedIds = ref<string[]>([]);

  const isMultiMode = computed(() => multiSelectedIds.value.length > 1);

  function isStartOrEndNode(nodeId: string): boolean {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    return flowControlNodeRegistry.isCategory(node.data.type, 'start')
      || flowControlNodeRegistry.isCategory(node.data.type, 'end');
  }

  function selectSingleNode(nodeId: string) {
    multiSelectedIds.value.splice(0);
    selectedNodeId.value = nodeId;
    store.setSelectedNodeId(nodeId);
  }

  function toggleMultiNode(nodeId: string) {
    const index = multiSelectedIds.value.indexOf(nodeId);
    if (index > -1) {
      multiSelectedIds.value.splice(index, 1);
    } else {
      multiSelectedIds.value.push(nodeId);
    }
    selectedNodeId.value = multiSelectedIds.value[0] || null;
    store.setSelectedNodeId(selectedNodeId.value);
  }

  function selectNode(nodeId: string, isMulti: boolean = false) {
    if (isMulti) {
      toggleMultiNode(nodeId);
    } else {
      selectSingleNode(nodeId);
    }
  }

  function clearSelection() {
    selectedNodeId.value = null;
    multiSelectedIds.value.splice(0);
    store.setSelectedNodeId(null);
  }

  function deleteSingleNode(nodeId: string) {
    if (isStartOrEndNode(nodeId)) {
      message.error('开始节点和输出节点不能删除');
      return;
    }
    const relatedConns = connections.value.filter(c => c.source === nodeId || c.target === nodeId);
    relatedConns.forEach(c => syncConnectionToNodeConfig(c, false));
    store.removeNode(nodeId);
    connections.value = connections.value.filter(c => c.source !== nodeId && c.target !== nodeId);
    if (selectedNodeId.value === nodeId) {
      selectedNodeId.value = null;
      store.setSelectedNodeId(null);
    }
    const idx = multiSelectedIds.value.indexOf(nodeId);
    if (idx > -1) {
      multiSelectedIds.value.splice(idx, 1);
      selectedNodeId.value = multiSelectedIds.value[0] || null;
      store.setSelectedNodeId(selectedNodeId.value);
    }
    onNodeDeleted?.(nodeId);
  }

  function deleteSelectedNodes() {
    const idsToDelete = [...multiSelectedIds.value];
    if (idsToDelete.length === 0) return;

    let deletedFirstNodeId: string | null = null;

    idsToDelete.forEach(id => {
      if (isStartOrEndNode(id)) return;
      const relatedConns = connections.value.filter(c => c.source === id || c.target === id);
      relatedConns.forEach(c => syncConnectionToNodeConfig(c, false));
      store.removeNode(id);
      if (!deletedFirstNodeId) {
        deletedFirstNodeId = id;
      }
    });

    connections.value = connections.value.filter(c =>
      !idsToDelete.includes(c.source) && !idsToDelete.includes(c.target)
    );

    clearSelection();
    if (deletedFirstNodeId) {
      onNodeDeleted?.(deletedFirstNodeId);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toUpperCase();
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
      return;
    }
    if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (isMultiMode.value) {
        deleteSelectedNodes();
      } else if (selectedNodeId.value) {
        deleteSingleNode(selectedNodeId.value);
      }
    }
  }

  function deleteSelectedNode(nodeId: string) {
    if (isMultiMode.value) {
      deleteSelectedNodes();
    } else {
      deleteSingleNode(nodeId);
    }
  }

  return {
    selectedNodeId,
    multiSelectedIds,
    isMultiMode,
    selectNode,
    selectSingleNode,
    toggleMultiNode,
    clearSelection,
    deleteSelectedNode,
    deleteSelectedNodes,
    handleKeyDown,
  };
}
