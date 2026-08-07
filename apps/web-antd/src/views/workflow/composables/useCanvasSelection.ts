import { ref } from 'vue';
import { message } from 'ant-design-vue';
import { useWorkflowStore } from '#/store/workflow';

export function useCanvasSelection(
  connections: { value: { source: string; target: string }[] },
  syncConnectionToNodeConfig: (conn: any, isAdd: boolean) => void,
  onNodeDeleted?: (nodeId: string) => void
) {
  const store = useWorkflowStore();
  const selectedNodeId = ref<string | null>(null);

  function isStartOrEndNode(nodeId: string): boolean {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    return node.data.type === 'idp_core_flow_Start' || node.data.type === 'idp_core_flow_End';
  }

  function selectNode(nodeId: string) {
    selectedNodeId.value = nodeId;
    // 同步到 store，供 VarPicker 等组件读取
    store.setSelectedNodeId(nodeId);
  }

  function deleteSelectedNode(nodeId: string) {
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
    onNodeDeleted?.(nodeId);
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
      if (selectedNodeId.value) {
        const nodeId = selectedNodeId.value;
        if (isStartOrEndNode(nodeId)) {
          message.error('开始节点和输出节点不能删除');
          return;
        }
        const relatedConns = connections.value.filter(c => c.source === nodeId || c.target === nodeId);
        relatedConns.forEach(c => syncConnectionToNodeConfig(c, false));
        store.removeNode(nodeId);
        connections.value = connections.value.filter(c => c.source !== nodeId && c.target !== nodeId);
        selectedNodeId.value = null;
        store.setSelectedNodeId(null);
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
