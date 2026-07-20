import { ref } from 'vue';
import { useWorkflowStore } from '#/store/workflow';

export function useCanvasSelection(
  connections: { value: { source: string; target: string }[] },
  syncConnectionToNodeConfig: (conn: any, isAdd: boolean) => void,
  onNodeDeleted?: (nodeId: string) => void
) {
  const store = useWorkflowStore();
  const selectedNodeId = ref<string | null>(null);

  function selectNode(nodeId: string) {
    selectedNodeId.value = nodeId;
  }

  function deleteSelectedNode(nodeId: string) {
    const relatedConns = connections.value.filter(c => c.source === nodeId || c.target === nodeId);
    relatedConns.forEach(c => syncConnectionToNodeConfig(c, false));
    store.removeNode(nodeId);
    connections.value = connections.value.filter(c => c.source !== nodeId && c.target !== nodeId);
    if (selectedNodeId.value === nodeId) {
      selectedNodeId.value = null;
    }
    onNodeDeleted?.(nodeId);
  }

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toUpperCase();
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNodeId.value) {
        const nodeId = selectedNodeId.value;
        const relatedConns = connections.value.filter(c => c.source === nodeId || c.target === nodeId);
        relatedConns.forEach(c => syncConnectionToNodeConfig(c, false));
        store.removeNode(nodeId);
        connections.value = connections.value.filter(c => c.source !== nodeId && c.target !== nodeId);
        selectedNodeId.value = null;
        onNodeDeleted?.(nodeId);
      }
    }
  }

  return {
    selectedNodeId,
    selectNode,
    deleteSelectedNode,
    handleKeyDown,
  };
}
