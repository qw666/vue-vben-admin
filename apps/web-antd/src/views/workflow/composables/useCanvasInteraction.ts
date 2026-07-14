import { ref } from 'vue';
import { message } from 'ant-design-vue';
import { useWorkflowStore } from '#/store/workflow';

export function useCanvasInteraction(pluginGroups: any, pluginGroupsCache: any, pluginMetaCache: any, loadPluginMeta: any) {
  const store = useWorkflowStore();

  const isDraggingNode = ref(false);
  const draggingNodeId = ref<string | null>(null);
  const dragOffset = ref({ x: 0, y: 0 });

  const isConnecting = ref(false);
  const connectingFrom = ref<string | null>(null);
  const tempLine = ref({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const connections = ref<{ id: string; source: string; target: string; sourcePort?: string; targetPort?: string }[]>([]);
  const selectedConnectionId = ref<string | null>(null);
  type ContextMenuType = { show: boolean; x: number; y: number; type: 'node' | 'connection' | null; targetId: string | null };
  const contextMenu = ref<ContextMenuType>({ show: false, x: 0, y: 0, type: null, targetId: null });

  function onDragStart(e: DragEvent, nodeType: string) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/json', JSON.stringify({ nodeType }));
      e.dataTransfer.effectAllowed = 'move';
      loadPluginMeta(nodeType);
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    if (!store.currentWorkflow) {
      message.error('请先创建或选择一个流程');
      return;
    }
    const canvas = e.currentTarget as HTMLElement;
    const rect = canvas.getBoundingClientRect();
    const position = {
      x: e.clientX - rect.left - 70 + canvas.scrollLeft,
      y: e.clientY - rect.top - 30 + canvas.scrollTop,
    };

    if (e.dataTransfer) {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const { nodeType } = JSON.parse(data);
        console.log('onDrop - nodeType:', nodeType);
        let template: any = null;
        for (const tabKey of Object.keys(pluginGroupsCache.value)) {
          const groups = pluginGroupsCache.value[tabKey];
          for (const group of groups) {
            template = group.pluginList.find((p: any) => p.type === nodeType);
            if (template) {
              template.category = group.groupName;
              break;
            }
          }
          if (template) break;
        }
        console.log('onDrop - template:', template);
        if (template) {
          const meta = pluginMetaCache.value[nodeType];
          const newNode = {
            id: `node-${Date.now()}`,
            type: 'custom',
            position,
            data: {
              label: template.nodeName,
              type: template.type,
              icon: template.icon,
              description: template.category,
              config: meta && meta.parsedSchema ? {} : {},
            },
          };
          store.addNode(newNode);
          message.success(`已添加 ${template.nodeName} 节点`);
        } else {
          message.error(`未找到节点类型: ${nodeType}`);
        }
      } else {
        message.error('拖拽数据为空');
      }
    } else {
      message.error('未找到拖拽数据');
    }
  }

  function startNodeDrag(e: MouseEvent, nodeId: string) {
    const target = e.target as HTMLElement;
    if (target.closest('.node-port')) {
      return;
    }

    e.preventDefault();
    isDraggingNode.value = true;
    draggingNodeId.value = nodeId;

    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (node) {
      dragOffset.value = {
        x: e.clientX - node.position.x,
        y: e.clientY - node.position.y
      };
    }

    function onMouseMove(event: MouseEvent) {
      if (!isDraggingNode.value || !draggingNodeId.value) return;

      const newX = Math.max(0, event.clientX - dragOffset.value.x);
      const newY = Math.max(0, event.clientY - dragOffset.value.y);

      store.updateNode(draggingNodeId.value, {
        position: { x: newX, y: newY }
      });
    }

    function onMouseUp() {
      isDraggingNode.value = false;
      draggingNodeId.value = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function startConnection(e: MouseEvent, nodeId: string) {
    e.preventDefault();
    e.stopPropagation();
    
    isConnecting.value = true;
    connectingFrom.value = nodeId;

    const canvas = document.querySelector('.workflow-canvas');
    if (!canvas) {
      return;
    }
    
    const canvasRect = canvas.getBoundingClientRect();
    const portElement = e.target as HTMLElement;
    const portRect = portElement.getBoundingClientRect();
    
    tempLine.value = {
      x1: portRect.left - canvasRect.left + portRect.width / 2,
      y1: portRect.top - canvasRect.top + portRect.height / 2,
      x2: e.clientX - canvasRect.left,
      y2: e.clientY - canvasRect.top
    };

    function onMouseMove(event: MouseEvent) {
      if (!isConnecting.value) return;
      const rect = canvas!.getBoundingClientRect();
      tempLine.value.x2 = event.clientX - rect.left;
      tempLine.value.y2 = event.clientY - rect.top;
    }

    function onMouseUp(event: MouseEvent) {
      isConnecting.value = false;
      
      const targetElement = event.target as HTMLElement;
      const targetPort = targetElement.closest('.node-port') as HTMLElement | null;
      
      if (targetPort && connectingFrom.value) {
        const targetNodeId = targetPort.dataset.nodeId;
        const targetPortType = targetPort.dataset.portType;
        
        if (targetNodeId && targetNodeId !== connectingFrom.value && targetPortType === 'input') {
          const newConnection = {
            id: `conn-${Date.now()}`,
            source: connectingFrom.value,
            target: targetNodeId
          };
          connections.value.push(newConnection);
          if (store.currentWorkflow) {
            store.currentWorkflow.edges = [...store.currentWorkflow.edges, newConnection];
          }
        }
      }
      
      connectingFrom.value = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function deleteConnection(connId: string) {
    connections.value = connections.value.filter(c => c.id !== connId);
    if (store.currentWorkflow) {
      store.currentWorkflow.edges = store.currentWorkflow.edges.filter(c => c.id !== connId);
    }
  }

  function selectConnection(connId: string) {
    selectedConnectionId.value = connId;
  }

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

  function deleteSelectedConnection() {
    if (contextMenu.value.type === 'connection' && contextMenu.value.targetId) {
      deleteConnection(contextMenu.value.targetId as string);
    }
    closeContextMenu();
  }

  function deleteSelectedNode() {
    if (contextMenu.value.type === 'node' && contextMenu.value.targetId) {
      const nodeId = contextMenu.value.targetId as string;
      store.removeNode(nodeId);
      connections.value = connections.value.filter(c => c.source !== nodeId && c.target !== nodeId);
    }
    closeContextMenu();
  }

  function handleCanvasClick() {
    closeContextMenu();
  }

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toUpperCase();
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedConnectionId.value) {
        deleteConnection(selectedConnectionId.value);
        selectedConnectionId.value = null;
      }
    }
  }

  function handleCanvasMouseLeave() {
    if (isConnecting.value) {
      isConnecting.value = false;
      connectingFrom.value = null;
    }
  }

  function getNodeCenter(nodeId: string): { x: number; y: number } {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (node) {
      return {
        x: node.position.x + 66,
        y: node.position.y + 34
      };
    }
    return { x: 0, y: 0 };
  }

  function getNodeTop(nodeId: string): number {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    return node ? node.position.y : 0;
  }

  function getNodeBottom(nodeId: string): number {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    return node ? node.position.y + 68 : 0;
  }

  function getConnectionPath(sourceId: string, targetId: string): string {
    const sourceCenter = getNodeCenter(sourceId);
    const sourceBottom = getNodeBottom(sourceId);
    const targetCenter = getNodeCenter(targetId);
    const targetTop = getNodeTop(targetId);
    
    const startX = sourceCenter.x;
    const startY = sourceBottom;
    const endX = targetCenter.x;
    const endY = targetTop;
    
    const midY = (startY + endY) / 2;
    
    return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  }

  function getTempLinePath(): string {
    const { x1, y1, x2, y2 } = tempLine.value;
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  }

  return {
    isDraggingNode,
    draggingNodeId,
    dragOffset,
    isConnecting,
    connectingFrom,
    tempLine,
    connections,
    selectedConnectionId,
    contextMenu,
    onDragStart,
    onDragOver,
    onDrop,
    startNodeDrag,
    startConnection,
    deleteConnection,
    selectConnection,
    showConnectionContextMenu,
    showNodeContextMenu,
    closeContextMenu,
    deleteSelectedConnection,
    deleteSelectedNode,
    handleCanvasClick,
    handleKeyDown,
    handleCanvasMouseLeave,
    getNodeCenter,
    getNodeTop,
    getNodeBottom,
    getConnectionPath,
    getTempLinePath,
  };
}
