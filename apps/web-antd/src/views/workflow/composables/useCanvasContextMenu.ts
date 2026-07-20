import { ref } from 'vue';

type ContextMenuType = { show: boolean; x: number; y: number; type: 'node' | 'connection' | null; targetId: string | null };

export function useCanvasContextMenu(
  deleteSelectedNode: (nodeId: string) => void,
  deleteSelectedConnection: (connId: string) => void,
  _selectedConnectionId: { value: string | null }
) {
  const contextMenu = ref<ContextMenuType>({ show: false, x: 0, y: 0, type: null, targetId: null });

  function showConnectionContextMenu(e: MouseEvent, connId: string) {
    contextMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      type: 'connection',
      targetId: connId
    };
  }

  function showNodeContextMenu(e: MouseEvent, nodeId: string) {
    e.preventDefault();
    contextMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      type: 'node',
      targetId: nodeId
    };
  }

  function closeContextMenu() {
    contextMenu.value = { show: false, x: 0, y: 0, type: null, targetId: null };
  }

  function deleteConnectionFromMenu() {
    if (contextMenu.value.type === 'connection' && contextMenu.value.targetId) {
      deleteSelectedConnection(contextMenu.value.targetId as string);
    }
    closeContextMenu();
  }

  function deleteSelectedNodeFromMenu() {
    if (contextMenu.value.type === 'node' && contextMenu.value.targetId) {
      deleteSelectedNode(contextMenu.value.targetId as string);
    }
    closeContextMenu();
  }

  function handleCanvasClick() {
    closeContextMenu();
  }

  return {
    contextMenu,
    showConnectionContextMenu,
    showNodeContextMenu,
    closeContextMenu,
    deleteSelectedConnection: deleteConnectionFromMenu,
    deleteSelectedNode: deleteSelectedNodeFromMenu,
    handleCanvasClick,
  };
}
