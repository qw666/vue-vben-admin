import { useWorkflowStore } from '#/store/workflow';
import { getNodePorts, getPortPosition, getConnectionPath, getConnectionColor, getGroupBounds } from './useCanvasPorts';
import { useCanvasConnections } from './useCanvasConnections';
import { useCanvasDragging } from './useCanvasDragging';
import { useCanvasPanning } from './useCanvasPanning';
import { useSwitchNode } from './useSwitchNode';
import { useCanvasSelection } from './useCanvasSelection';
import { useCanvasContextMenu } from './useCanvasContextMenu';

export interface Port {
  id: string;
  nodeId: string;
  type: 'input' | 'output';
  label?: string;
  position: { x: number; y: number };
  color?: string;
  portGroup?: string;
}

export interface Connection {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface GroupBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useCanvasInteraction(
  pluginGroupsCache: any, 
  pluginMetaCache: any, 
  loadPluginMeta: any, 
  onNodeDeleted?: (nodeId: string) => void,
  nodeConfigForm?: any,
  selectedNode?: { value: any },
  onNodeConnected?: (node: any) => void
) {
  const { panOffset, scale, updatePanOffset, updateScale } = useCanvasPanning();

  const {
    connections,
    isConnecting,
    connectingFrom,
    connectingFromPortId,
    tempLine,
    selectedConnectionId,
    startConnection,
    deleteConnection,
    selectConnection,
    getTempLinePath,
    handleCanvasMouseLeave,
    syncConnectionToNodeConfig,
    cleanup: cleanupConnections,
  } = useCanvasConnections(nodeConfigForm, selectedNode, onNodeConnected, panOffset, scale);

  const {
    isDraggingNode,
    draggingNodeId,
    dragOffset,
    onDragStart,
    onDragOver,
    onDrop,
    startNodeDrag,
    cleanup: cleanupDragging,
  } = useCanvasDragging(pluginGroupsCache, pluginMetaCache, loadPluginMeta, panOffset, scale);

  function cleanup() {
    cleanupConnections();
    cleanupDragging();
  }

  const {
    selectedNodeId,
    selectNode,
    deleteSelectedNode,
    handleKeyDown,
  } = useCanvasSelection(connections, syncConnectionToNodeConfig, onNodeDeleted);

  const {
    contextMenu,
    showConnectionContextMenu,
    showNodeContextMenu,
    closeContextMenu,
    deleteSelectedConnection,
    deleteSelectedNode: deleteSelectedNodeFromMenu,
    handleCanvasClick,
  } = useCanvasContextMenu(deleteSelectedNode, deleteConnection, selectedConnectionId);

  const {
    updateSwitchCaseKey,
    removeSwitchCaseKey,
    addSwitchCaseKey,
  } = useSwitchNode(nodeConfigForm, selectedNode);

  function getNodeCenter(nodeId: string): { x: number; y: number } {
    const NODE_WIDTH = 144;
    const NODE_HEIGHT = 56;
    const store = useWorkflowStore();
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (node) {
      return {
        x: node.position.x + NODE_WIDTH / 2,
        y: node.position.y + NODE_HEIGHT / 2
      };
    }
    return { x: 0, y: 0 };
  }

  return {
    isDraggingNode,
    draggingNodeId,
    dragOffset,
    panOffset,
    scale,
    isConnecting,
    connectingFrom,
    connectingFromPortId,
    tempLine,
    connections,
    selectedConnectionId,
    selectedNodeId,
    contextMenu,
    onDragStart,
    onDragOver,
    onDrop,
    startNodeDrag,
    startConnection,
    deleteConnection,
    selectConnection,
    selectNode,
    showConnectionContextMenu,
    showNodeContextMenu,
    closeContextMenu,
    deleteSelectedConnection,
    deleteSelectedNode: deleteSelectedNodeFromMenu,
    handleCanvasClick,
    handleKeyDown,
    handleCanvasMouseLeave,
    getNodeCenter,
    getPortPosition,
    getConnectionPath,
    getGroupBounds,
    getConnectionColor,
    getTempLinePath,
    getNodePorts,
    syncConnectionToNodeConfig,
    updateSwitchCaseKey,
    removeSwitchCaseKey,
    addSwitchCaseKey,
    updatePanOffset,
    updateScale,
    cleanup,
  };
}
