import { ref } from 'vue';

import { message } from 'ant-design-vue';

import { useWorkflowStore } from '#/store/workflow';

import { getFlowControlConfig, getFlowControlNodes, flowControlNodeRegistry } from '../config/workflow-node-config';
import { resolveNodeIcon } from '../utils/nodeIcon';
import { useEventCleanup } from './useEventCleanup';

export function useCanvasDragging(
  pluginGroupsCache: any,
  pluginMetaCache: any,
  loadPluginMeta: any,
  panOffset: { value: { x: number; y: number } },
  scale: { value: number }
) {
  const store = useWorkflowStore();
  const isDraggingNode = ref(false);
  const draggingNodeId = ref<null | string>(null);
  const dragOffset = ref({ x: 0, y: 0 });

  // Separate cleanup for drag listeners (mousemove, mouseup, mouseleave)
  const { addListener, removeAllListeners: removeAllDragListeners } = useEventCleanup();

  // visibilitychange listener management (separate from drag listeners)
  let isVisibilityListenerRegistered = false;

  function handleVisibilityChange() {
    if (isDraggingNode.value) {
      cleanupDragListeners();
      isDraggingNode.value = false;
      draggingNodeId.value = null;
    }
  }

  function ensureVisibilityListener() {
    if (!isVisibilityListenerRegistered) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      isVisibilityListenerRegistered = true;
    }
  }

  function cleanupVisibilityListener() {
    if (isVisibilityListenerRegistered) {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      isVisibilityListenerRegistered = false;
    }
  }

  function cleanupDragListeners() {
    removeAllDragListeners();
  }

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
      x: (e.clientX - rect.left - 70 - panOffset.value.x) / scale.value,
      y: (e.clientY - rect.top - 30 - panOffset.value.y) / scale.value,
    };

    if (e.dataTransfer) {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const { nodeType } = JSON.parse(data);
        let template: any = null;

        const flowControlConfig = getFlowControlConfig(nodeType);
        if (flowControlNodeRegistry.isFlowControlContainer(nodeType)) {
          template = {
            nodeName: flowControlConfig.nodeName,
            type: nodeType,
            icon: flowControlConfig.icon,
            category: '流程控制',
            description: flowControlConfig.description,
          };
        } else {
          const fcNode = getFlowControlNodes().find((n: any) => n.type === nodeType);
          if (fcNode) {
            template = {
              nodeName: fcNode.nodeName,
              type: nodeType,
              icon: fcNode.icon,
              category: '工具',
              description: fcNode.description,
            };
          }
          if (!template) {
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
          }
        }

        const meta = pluginMetaCache.value[nodeType];
        const nodeTypeParts = nodeType.split('_');
        const nodeTypeSuffix = nodeTypeParts[nodeTypeParts.length - 1] || 'node';
        
        const newNode = {
          id: `${nodeTypeSuffix}_${Date.now()}`,
          type: 'custom',
          position,
          data: {
            label: template?.nodeName || nodeType,
            type: template?.type || nodeType,
            icon: resolveNodeIcon(template?.icon),
            description: template?.description || template?.category || '自定义节点',
            config: meta && meta.parsedSchema ? {} : {},
          },
        };
        store.addNode(newNode);
        message.success(`已添加 ${template?.nodeName || nodeType} 节点`);

        if (!pluginMetaCache.value[nodeType]) {
          loadPluginMeta(nodeType);
        }
      } else {
        message.error('拖拽数据为空');
      }
    } else {
      message.error('未找到拖拽数据');
    }
  }

  function startNodeDrag(e: MouseEvent, nodeId: string) {
    // Clean up any stuck state from previous drag
    if (isDraggingNode.value || draggingNodeId.value) {
      cleanupDragListeners();
      isDraggingNode.value = false;
      draggingNodeId.value = null;
    }

    const target = e.target as HTMLElement;
    if (target.closest('.node-port')) {
      return;
    }

    ensureVisibilityListener();
    e.preventDefault();
    isDraggingNode.value = true;
    draggingNodeId.value = nodeId;

    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (node) {
      dragOffset.value = {
        x: e.clientX - node.position.x * scale.value - panOffset.value.x,
        y: e.clientY - node.position.y * scale.value - panOffset.value.y
      };
    }

    function onMouseMove(event: MouseEvent) {
      if (!isDraggingNode.value || !draggingNodeId.value) return;

      const newX = Math.max(0, (event.clientX - dragOffset.value.x - panOffset.value.x) / scale.value);
      const newY = Math.max(0, (event.clientY - dragOffset.value.y - panOffset.value.y) / scale.value);

      store.updateNode(draggingNodeId.value, {
        position: { x: newX, y: newY }
      });
    }

    function onMouseUp() {
      cleanupDragListeners();
      isDraggingNode.value = false;
      draggingNodeId.value = null;
    }

    function onMouseLeave() {
      if (isDraggingNode.value) {
        onMouseUp();
      }
    }

    addListener(document, 'mousemove', onMouseMove);
    addListener(document, 'mouseup', onMouseUp);
    addListener(document, 'mouseleave', onMouseLeave);
  }

  function cleanup() {
    cleanupDragListeners();
    cleanupVisibilityListener();
    isDraggingNode.value = false;
    draggingNodeId.value = null;
  }

  return {
    isDraggingNode,
    draggingNodeId,
    dragOffset,
    onDragStart,
    onDragOver,
    onDrop,
    startNodeDrag,
    cleanup,
  };
}
