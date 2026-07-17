<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { IconifyIcon } from '@vben/icons';

const NODE_WIDTH = 176;
const NODE_HEIGHT = 68;

const props = defineProps<{
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
  getGroupBounds: (nodeId: string) => { x: number; y: number; width: number; height: number } | null;
  scale?: number;
  configPanelWidth?: number;
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
  (e: 'panChange', offset: { x: number; y: number }): void;
  (e: 'scaleChange', value: number): void;
}>();

const canvasRef = ref<HTMLElement | null>(null);

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
const canvasSize = ref({ width: 4000, height: 4000 });

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
  if (target.closest('.cursor-move') || target.closest('.node-port') || target.closest('.node-container')) {
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
  emit('panChange', panOffset.value);
}

function stopPan() {
  if (!isPanning.value) return;
  isPanning.value = false;
  document.removeEventListener('mousemove', onPan);
  document.removeEventListener('mouseup', stopPan);
}

function centerCanvas() {
  const canvas = document.querySelector('.workflow-canvas');
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    panOffset.value = {
      x: rect.width / 2 - canvasSize.value.width / 2,
      y: rect.height / 2 - canvasSize.value.height / 2,
    };
    emit('panChange', panOffset.value);
    emit('scaleChange', 1);
  }
}

function zoomAtCenter(delta: number) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  
  const oldScale = props.scale || 1;
  const newScale = Math.max(0.25, Math.min(2, oldScale * delta));
  
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  const worldX = (centerX - panOffset.value.x) / oldScale;
  const worldY = (centerY - panOffset.value.y) / oldScale;
  
  const newPanX = centerX - worldX * newScale;
  const newPanY = centerY - worldY * newScale;
  
  panOffset.value = { x: newPanX, y: newPanY };
  emit('panChange', panOffset.value);
  emit('scaleChange', newScale);
}

function handleWheel(event: WheelEvent) {
  if (!event.ctrlKey) {
    return;
  }
  event.preventDefault();
  
  const delta = event.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.max(0.25, Math.min(2, (props.scale || 1) * delta));
  
  const canvas = canvasRef.value;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const oldScale = props.scale || 1;
    const worldX = (mouseX - panOffset.value.x) / oldScale;
    const worldY = (mouseY - panOffset.value.y) / oldScale;
    
    const newPanX = mouseX - worldX * newScale;
    const newPanY = mouseY - worldY * newScale;
    
    panOffset.value = { x: newPanX, y: newPanY };
    emit('panChange', panOffset.value);
  }
  
  emit('scaleChange', newScale);
}

onMounted(() => {
  centerCanvas();
  window.addEventListener('resize', centerCanvas);
});
</script>

<template>
  <div class="flex-1 relative overflow-hidden">
    <div
      ref="canvasRef"
      class="w-full h-full bg-gray-50 workflow-canvas overflow-hidden"
      @drop="emit('drop', $event)"
      @dragover="emit('dragOver', $event)"
      @mouseleave="() => { emit('mouseLeave'); stopPan(); }"
      @click="emit('canvasClick')"
      @mousedown="startPan"
      @wheel="handleWheel"
      :style="{ cursor: isPanning ? 'grabbing' : 'default' }"
    >
      <div
        class="absolute"
        :style="{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${props.scale || 1})`,
          transformOrigin: '0 0',
          width: canvasSize.width + 'px',
          height: canvasSize.height + 'px',
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

        <div class="absolute inset-0 pointer-events-none" style="z-index: 2;">
          <div
            v-for="node in nodes"
            :key="'group-bg-' + node.id"
            v-show="node.data.description === '条件分支' || node.data.description === '多条件分支' || node.data.description === '循环执行' || node.data.description === '并行分支'"
            class="absolute rounded-xl bg-purple-50/40"
            :style="{
              left: (getGroupBounds(node.id)?.x ?? node.position.x - 24) + 'px',
              top: (getGroupBounds(node.id)?.y ?? node.position.y - 24) + 'px',
              width: (getGroupBounds(node.id)?.width ?? NODE_WIDTH + 48) + 'px',
              height: (getGroupBounds(node.id)?.height ?? NODE_HEIGHT + 80) + 'px',
            }"
          />
        </div>

        <div class="absolute inset-0 pointer-events-none" style="z-index: 15;">
          <div
            v-for="node in nodes"
            :key="'group-border-' + node.id"
            v-show="node.data.description === '条件分支' || node.data.description === '多条件分支' || node.data.description === '循环执行' || node.data.description === '并行分支'"
            class="absolute rounded-xl border-2 border-dashed border-purple-500 shadow-sm"
            :style="{
              left: (getGroupBounds(node.id)?.x ?? node.position.x - 24) + 'px',
              top: (getGroupBounds(node.id)?.y ?? node.position.y - 24) + 'px',
              width: (getGroupBounds(node.id)?.width ?? NODE_WIDTH + 48) + 'px',
              height: (getGroupBounds(node.id)?.height ?? NODE_HEIGHT + 80) + 'px',
            }"
          >
            <div class="absolute -top-3 left-4 px-2 bg-white text-xs text-purple-600 font-medium border border-purple-300 rounded shadow-sm">
              {{ node.data.label }}
            </div>
          </div>
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

        <div class="absolute inset-0 pointer-events-none" style="z-index: 20;">
          <template v-for="node in nodes" :key="'ports-' + node.id">
            <div
              v-for="port in getNodePorts(node.id, node.data.type)"
              :key="port.id"
              class="node-port absolute w-4 h-4 rounded-full border-2 border-white cursor-crosshair hover:scale-125 transition-all shadow-sm flex items-center justify-center pointer-events-auto"
              :style="{
                left: (port.position.x - 8) + 'px',
                top: (port.position.y - 8) + 'px',
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
        </div>
      </div>
    </div>

    <div class="fixed bottom-4 z-40 flex flex-col gap-1.5" :style="{ right: (configPanelWidth + 16) + 'px' }">
      <button
        class="w-8 h-8 rounded-lg bg-white shadow-md hover:shadow-lg flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors"
        title="回到中心"
        @click="centerCanvas"
      >
        <IconifyIcon icon="mdi:target" :size="16" />
      </button>
      <button
        class="w-8 h-8 rounded-lg bg-white shadow-md hover:shadow-lg flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors"
        title="放大"
        @click="() => zoomAtCenter(1.2)"
      >
        <IconifyIcon icon="mdi:plus" :size="16" />
      </button>
      <button
        class="w-8 h-8 rounded-lg bg-white shadow-md hover:shadow-lg flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors"
        title="缩小"
        @click="() => zoomAtCenter(1 / 1.2)"
      >
        <IconifyIcon icon="mdi:minus" :size="16" />
      </button>
      <div class="text-xs font-medium text-gray-600 text-center bg-white px-2 py-1 rounded shadow-md min-w-[50px]">
        {{ Math.round((props.scale || 1) * 100) }}%
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
