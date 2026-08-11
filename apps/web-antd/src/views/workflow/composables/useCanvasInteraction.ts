import { useWorkflowStore } from '#/store/workflow';
import { UI_CONFIG } from '../config/ui-config';
import { getNodePorts, getPortPosition, getConnectionPath, getConnectionColor, getGroupBounds } from './useCanvasPorts';
import { useCanvasConnections } from './useCanvasConnections';
import { useCanvasDragging } from './useCanvasDragging';
import { useMultiNodeDragging } from './useMultiNodeDragging';
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
    cleanup: cleanupSingleDrag,
  } = useCanvasDragging(pluginGroupsCache, pluginMetaCache, loadPluginMeta, panOffset, scale);

  const {
    isMultiDragging,
    multiDragNodeId,
    multiDragIds,
    startMultiDrag,
    cleanup: cleanupMultiDrag,
  } = useMultiNodeDragging(panOffset, scale);

  function cleanup() {
    cleanupConnections();
    cleanupSingleDrag();
    cleanupMultiDrag();
  }

  const {
    selectedNodeId,
    multiSelectedIds,
    isMultiMode,
    selectNode,
    clearSelection,
    deleteSelectedNode,
    deleteSelectedNodes,
    handleKeyDown,
  } = useCanvasSelection(connections, syncConnectionToNodeConfig, onNodeDeleted);

  const {
    contextMenu,
    showConnectionContextMenu,
    showNodeContextMenu,
    closeContextMenu,
    deleteSelectedConnection,
    deleteSelectedNode: deleteSelectedNodeFromMenu,
    handleCanvasClick: handleCanvasClickFromContextMenu,
  } = useCanvasContextMenu(deleteSelectedNode, deleteConnection, selectedConnectionId);

  function handleCanvasClick() {
    handleCanvasClickFromContextMenu();
    clearSelection();
  }

  function startDrag(e: MouseEvent, nodeId: string) {
    // Clean up any stuck drag state from previous interactions
    if (isDraggingNode.value) {
      cleanupSingleDrag();
    }
    if (isMultiDragging.value) {
      cleanupMultiDrag();
    }

    // Ctrl held → skip drag entirely, let @click handle multi-selection toggle
    if (e.ctrlKey) {
      return;
    }

    // Node is part of current multi-selection → preserve it, start multi-drag
    if (isMultiMode.value && multiSelectedIds.value.includes(nodeId)) {
      startMultiDrag(e, nodeId, multiSelectedIds.value);
      return;
    }

    // Node is NOT part of multi-selection → clear multi-selection, single-select, start single drag
    if (isMultiMode.value) {
      clearSelection();
    }
    selectNode(nodeId, false);
    startNodeDrag(e, nodeId);
  }

  const {
    updateSwitchCaseKey,
    removeSwitchCaseKey,
    addSwitchCaseKey,
  } = useSwitchNode(nodeConfigForm, selectedNode);

  function getNodeCenter(nodeId: string): { x: number; y: number } {
    const NODE_WIDTH = UI_CONFIG.node.width;
    const NODE_HEIGHT = UI_CONFIG.node.height;
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
    multiSelectedIds,
    isMultiMode,
    isMultiDragging,
    multiDragNodeId,
    multiDragIds,
    contextMenu,
    onDragStart,
    onDragOver,
    onDrop,
    startNodeDrag,
    startMultiDrag,
    startDrag,
    startConnection,
    deleteConnection,
    selectConnection,
    selectNode,
    clearSelection,
    deleteSelectedNodes,
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
