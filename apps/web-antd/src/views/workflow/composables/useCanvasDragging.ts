import { ref } from 'vue';

import { message } from 'ant-design-vue';

import { useWorkflowStore } from '#/store/workflow';

import { getFlowControlConfig } from '../config/workflow-node-config';
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
  const { addListener, removeAllListeners, removeListener } = useEventCleanup();

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
        if (flowControlConfig) {
          template = {
            nodeName: flowControlConfig.nodeName,
            type: nodeType,
            icon: flowControlConfig.icon,
            category: '流程控制',
            description: flowControlConfig.description,
          };
        } else {
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
            icon: template?.icon || 'mdi:circle',
            description: template?.description || template?.category || '自定义节点',
            config: meta && meta.parsedSchema ? {} : {},
          },
        };
        store.addNode(newNode);
        message.success(`已添加 ${template?.nodeName || nodeType} 节点`);
      } else {
        message.error('拖拽数据为空');
      }
    } else {
      message.error('未找到拖拽数据');
    }
  }

  function startNodeDrag(e: MouseEvent, nodeId: string) {
    if (isDraggingNode.value) return;

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
      isDraggingNode.value = false;
      draggingNodeId.value = null;
      removeListener(document, 'mousemove', onMouseMove);
      removeListener(document, 'mouseup', onMouseUp);
      removeListener(document, 'mouseleave', onMouseLeave);
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
    removeAllListeners();
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
