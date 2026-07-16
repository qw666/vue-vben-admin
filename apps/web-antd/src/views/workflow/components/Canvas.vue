<script lang="ts" setup>
import { ref } from 'vue';
import { IconifyIcon } from '@vben/icons';

defineProps<{
  nodes: any[];
  isDraggingNode: boolean;
  draggingNodeId: string | null;
  isConnecting: boolean;
  connections: any[];
  selectedConnectionId: string | null;
  selectedNodeId: string | null;
  contextMenu: { show: boolean; x: number; y: number; type: 'node' | 'connection' | null; targetId: string | null };
  getNodePorts: (nodeId: string, nodeType: string) => any[];
  getConnectionPath: (sourceId: string, targetId: string, sourcePortId?: string, targetPortId?: string) => string;
  getConnectionColor: (conn: any) => string;
  getTempLinePath: () => string;
}>();

const emit = defineEmits<{
  (e: 'drop', event: DragEvent): void;
  (e: 'dragOver', event: DragEvent): void;
  (e: 'mouseLeave'): void;
  (e: 'canvasClick'): void;
  (e: 'startNodeDrag', event: MouseEvent, nodeId: string): void;
  (e: 'selectNode', nodeId: string): void;
  (e: 'nodeDoubleClick', node: any): void;
  (e: 'nodeContextMenu', event: MouseEvent, nodeId: string): void;
  (e: 'startConnection', event: MouseEvent, nodeId: string, portId: string): void;
  (e: 'selectConnection', connId: string): void;
  (e: 'connectionContextMenu', event: MouseEvent, connId: string): void;
  (e: 'deleteSelectedNode'): void;
  (e: 'deleteSelectedConnection'): void;
  (e: 'closeContextMenu'): void;
}>();

const categoryColors: Record<string, string> = {
  '流程控制': 'bg-purple-500',
  'HTTP操作': 'bg-blue-500',
  '输出操作': 'bg-green-500',
  '触发器': 'bg-orange-500',
  '基础': 'bg-gray-500',
};

function getCategoryColor(category: string): string {
  return categoryColors[category] || 'bg-gray-500';
}

const tooltip = ref({ show: false, x: 0, y: 0, text: '' });
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0 });
const panOffset = ref({ x: 0, y: 0 });

function showTooltip(event: MouseEvent, text: string) {
  tooltip.value = {
    show: true,
    x: event.clientX + 10,
    y: event.clientY + 10,
    text,
  };
}

function hideTooltip() {
  tooltip.value.show = false;
}

function startPan(event: MouseEvent) {
  if (event.button !== 0) return;
  const target = event.target as HTMLElement;
  if (target.closest('.cursor-move') || target.closest('.node-port')) {
    return;
  }
  isPanning.value = true;
  panStart.value = { x: event.clientX, y: event.clientY };
  (event.currentTarget as HTMLElement).style.cursor = 'grabbing';
  event.preventDefault();
  document.addEventListener('mousemove', onPan);
  document.addEventListener('mouseup', stopPan);
}

function onPan(event: MouseEvent) {
  if (!isPanning.value) return;
  const dx = event.clientX - panStart.value.x;
  const dy = event.clientY - panStart.value.y;
  panOffset.value = {
    x: panOffset.value.x + dx,
    y: panOffset.value.y + dy,
  };
  panStart.value = { x: event.clientX, y: event.clientY };
}

function stopPan() {
  if (!isPanning.value) return;
  isPanning.value = false;
  document.removeEventListener('mousemove', onPan);
  document.removeEventListener('mouseup', stopPan);
}
</script>

<template>
  <div
    class="flex-1 relative bg-gray-50 workflow-canvas overflow-hidden"
    @drop="emit('drop', $event)"
    @dragover="emit('dragOver', $event)"
    @mouseleave="() => { emit('mouseLeave'); stopPan(); }"
    @click="emit('canvasClick')"
    @mousedown="startPan"
    :style="{ cursor: isPanning ? 'grabbing' : 'default' }"
  >
    <div
      class="absolute"
      :style="{
        transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
        width: '4000px',
        height: '4000px',
      }"
    >
      <div class="absolute inset-0 pointer-events-none">
        <svg class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="gray" stroke-width="0.5" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div class="absolute inset-0 pointer-events-none" style="z-index: 5;">
        <svg class="w-full h-full">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
            </marker>
          </defs>
          <g>
            <path
              v-for="conn in connections"
              :key="conn.id"
              :d="getConnectionPath(conn.source, conn.target, conn.sourceHandle, conn.targetHandle)"
              fill="none"
              stroke="transparent"
              stroke-width="6"
              stroke-linecap="round"
              class="cursor-pointer"
              @click="emit('selectConnection', conn.id)"
              @contextmenu.prevent="(e) => emit('connectionContextMenu', e, conn.id)"
              style="pointer-events: stroke;"
            />
            <path
              v-for="conn in connections"
              :key="'line-' + conn.id"
              :d="getConnectionPath(conn.source, conn.target, conn.sourceHandle, conn.targetHandle)"
              fill="none"
              :stroke="getConnectionColor(conn)"
              stroke-width="1.5"
              marker-end="url(#arrowhead)"
              style="pointer-events: none;"
            />
          </g>
          <path
            v-if="isConnecting"
            :d="getTempLinePath()"
            fill="none"
            stroke="#3b82f6"
            stroke-width="2"
            stroke-dasharray="5,5"
            style="pointer-events: none;"
          />
        </svg>
      </div>

      <div v-if="nodes.length === 0" class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="text-center">
          <div class="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
            <IconifyIcon icon="mdi:mouse-pointer-click" :size="48" class="text-gray-400" />
          </div>
          <h3 class="text-xl font-medium text-gray-600 mb-2">从左侧拖拽节点到这里</h3>
          <p class="text-gray-400">双击节点可编辑配置</p>
        </div>
      </div>

      <div
        v-for="node in nodes"
        :key="node.id"
        class="absolute cursor-move select-none z-10"
        :class="{ 'z-30': isDraggingNode && draggingNodeId === node.id }"
        :style="{ left: node.position.x + 'px', top: node.position.y + 'px' }"
        @mousedown="(e) => emit('startNodeDrag', e, node.id)"
        @click="emit('selectNode', node.id)"
        @dblclick="() => { emit('selectNode', node.id); emit('nodeDoubleClick', node); }"
        @contextmenu.prevent="(e) => emit('nodeContextMenu', e, node.id)"
      >
        <div class="flex flex-col items-center justify-center px-4 py-3 rounded-lg border-2 bg-white shadow-md hover:shadow-lg transition-shadow relative w-44"
             :class="{ 'border-blue-500 ring-2 ring-blue-200': selectedNodeId === node.id }">
          <template v-for="port in getNodePorts(node.id, node.data.type)" :key="port.id">
            <div
              class="node-port absolute w-4 h-4 rounded-full border-2 border-white cursor-crosshair hover:scale-125 transition-all z-20 shadow-sm flex items-center justify-center"
              :style="{
                left: (port.position.x - node.position.x - 8) + 'px',
                top: (port.position.y - node.position.y - 8) + 'px',
                backgroundColor: port.color || '#3b82f6'
              }"
              :data-node-id="node.id"
              :data-port-id="port.id"
              :data-port-type="port.type"
              @mousedown="port.type === 'output' ? emit('startConnection', $event, node.id, port.id) : null"
              @mouseenter="showTooltip($event, port.label)"
              @mouseleave="hideTooltip"
            />
          </template>
          <div class="flex items-center gap-2 mb-1">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center text-white"
              :class="getCategoryColor(node.data.description || '基础')"
            >
              <IconifyIcon :icon="node.data.icon" :size="16" />
            </div>
            <span class="font-medium text-sm text-gray-700">{{ node.data.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="contextMenu.show"
    class="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[120px]"
    :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    @click.stop
  >
    <div
      v-if="contextMenu.type === 'node'"
      class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
      @click="emit('deleteSelectedNode')"
    >
      删除节点
    </div>
    <div
      v-if="contextMenu.type === 'connection'"
      class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
      @click="emit('deleteSelectedConnection')"
    >
      删除连线
    </div>
  </div>

  <div
    v-if="tooltip.show"
    class="fixed z-50 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg pointer-events-none"
    :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
  >
    {{ tooltip.text }}
  </div>
</template>
