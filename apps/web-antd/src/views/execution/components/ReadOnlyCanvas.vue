<script lang="ts" setup>
import type { WorkflowEdge, WorkflowNode } from '#/types/workflow';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { resolveNodeIcon } from '../../workflow/utils/nodeIcon';
import { useExecutionCanvas } from '../composables/useExecutionCanvas';

const props = defineProps<{
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  taskStates?: Record<string, string>;
  selectedNodeId?: null | string;
}>();

const emit = defineEmits<{
  (e: 'selectNode', nodeId: string): void;
}>();

// 将 props 包装为 computed ref 供 composable 使用
const nodesRef = computed(() => props.nodes);
const edgesRef = computed(() => props.edges);

const {
  containerNodes,
  getConnectionPath,
  getGroupBounds,
  getStatusBorderColor,
  getStatusBadgeIcon,
  getStatusBadgeColor,
  NODE_WIDTH,
  NODE_HEIGHT,
} = useExecutionCanvas(nodesRef, edgesRef);

// 画布交互：平移和缩放（只保留导航，无拖拽/连线/删除）
const canvasRef = ref<HTMLElement | null>(null);
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0 });
const panOffset = ref({ x: 0, y: 0 });
const scale = ref(1);
const canvasSize = ref({ width: 4000, height: 4000 });

function startPan(event: MouseEvent) {
  if (event.button !== 0) return;
  const target = event.target as HTMLElement;
  if (target.closest('.ro-node-container')) return;
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
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'default';
  }
  document.removeEventListener('mousemove', onPan);
  document.removeEventListener('mouseup', stopPan);
}

function handleWheel(event: WheelEvent) {
  if (!event.ctrlKey) return;
  event.preventDefault();
  const delta = event.deltaY > 0 ? 0.9 : 1.1;
  scale.value = Math.max(0.25, Math.min(2, scale.value * delta));
}

function centerCanvas() {
  if (!canvasRef.value || props.nodes.length === 0) return;
  const rect = canvasRef.value.getBoundingClientRect();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of props.nodes) {
    const x = node.position.x || 0;
    const y = node.position.y || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + NODE_WIDTH);
    maxY = Math.max(maxY, y + NODE_HEIGHT);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  panOffset.value = {
    x: rect.width / 2 - centerX,
    y: rect.height / 2 - centerY,
  };
}

onMounted(() => {
  centerCanvas();
  window.addEventListener('resize', centerCanvas);
});

onUnmounted(() => {
  window.removeEventListener('resize', centerCanvas);
  document.removeEventListener('mousemove', onPan);
  document.removeEventListener('mouseup', stopPan);
});

watch(
  () => props.nodes,
  () => {
    setTimeout(centerCanvas, 100);
  },
);
</script>

<template>
  <div class="relative overflow-hidden bg-gray-50 rounded-lg border border-border">
    <div
      ref="canvasRef"
      class="w-full overflow-hidden"
      style="height: 400px"
      @mousedown="startPan"
      @wheel="handleWheel"
    >
      <div
        class="absolute"
        :style="{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          width: `${canvasSize.width}px`,
          height: `${canvasSize.height}px`,
        }"
      >
        <!-- 网格背景 -->
        <div class="absolute inset-0 pointer-events-none">
          <svg class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="ro-grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="gray"
                  stroke-width="0.5"
                  opacity="0.3"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ro-grid)" />
          </svg>
        </div>

        <!-- 容器节点分组背景 -->
        <div class="absolute inset-0 pointer-events-none" style="z-index: 2">
          <div
            v-for="node in containerNodes"
            :key="`ro-bg-${node.id}`"
            class="absolute rounded-xl bg-purple-50/40"
            :style="{
              left: `${getGroupBounds(node.id)?.x ?? node.position.x - 24}px`,
              top: `${getGroupBounds(node.id)?.y ?? node.position.y - 24}px`,
              width: `${getGroupBounds(node.id)?.width ?? NODE_WIDTH + 48}px`,
              height: `${getGroupBounds(node.id)?.height ?? NODE_HEIGHT + 80}px`,
            }"
          ></div>
        </div>

        <!-- 容器节点分组边框 -->
        <div class="absolute inset-0 pointer-events-none" style="z-index: 15">
          <div
            v-for="node in containerNodes"
            :key="`ro-border-${node.id}`"
            class="absolute rounded-xl border-2 border-dashed border-purple-500 shadow-sm"
            :style="{
              left: `${getGroupBounds(node.id)?.x ?? node.position.x - 24}px`,
              top: `${getGroupBounds(node.id)?.y ?? node.position.y - 24}px`,
              width: `${getGroupBounds(node.id)?.width ?? NODE_WIDTH + 48}px`,
              height: `${getGroupBounds(node.id)?.height ?? NODE_HEIGHT + 80}px`,
            }"
          >
            <div
              class="absolute -top-3 left-4 px-2 bg-white text-xs text-purple-600 font-medium border border-purple-300 rounded shadow-sm"
            >
              {{ node.data.label }}
            </div>
          </div>
        </div>

        <!-- 连线 -->
        <div class="absolute inset-0 pointer-events-none" style="z-index: 12">
          <svg class="w-full h-full">
            <defs>
              <marker
                id="ro-arrowhead"
                markerWidth="7"
                markerHeight="5"
                refX="6"
                refY="2.5"
                orient="auto"
              >
                <polygon points="0 0, 7 2.5, 0 5" fill="#64748b" />
              </marker>
            </defs>
            <g>
              <path
                v-for="conn in edges"
                :key="conn.id"
                :d="getConnectionPath(conn)"
                fill="none"
                stroke="#64748b"
                stroke-width="1.5"
                marker-end="url(#ro-arrowhead)"
                style="pointer-events: none"
              />
            </g>
          </svg>
        </div>

        <!-- 空状态 -->
        <div
          v-if="nodes.length === 0"
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div class="text-center">
            <IconifyIcon
              icon="mdi:file-outline"
              :size="48"
              class="text-gray-400 mx-auto mb-2"
            />
            <p class="text-gray-400 text-sm">暂无流程数据</p>
          </div>
        </div>

        <!-- 节点 -->
        <div
          v-for="node in nodes"
          :key="node.id"
          class="absolute cursor-pointer select-none z-10 ro-node-container"
          :class="{ 'z-30': selectedNodeId === node.id }"
          :style="{ left: `${node.position.x}px`, top: `${node.position.y}px` }"
          @click.stop="emit('selectNode', node.id)"
        >
          <div
            class="flex flex-col items-center justify-center px-2 py-0.5 rounded-lg border-2 bg-white shadow-md transition-shadow relative"
            :style="{
              width: `${NODE_WIDTH}px`,
              height: `${NODE_HEIGHT}px`,
              borderColor: getStatusBorderColor(node.id, taskStates) || undefined,
            }"
            :class="{ 'ring-2 ring-blue-200': selectedNodeId === node.id }"
          >
            <div class="flex items-center gap-1.5">
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center bg-primary text-primary-foreground flex-shrink-0"
              >
                <IconifyIcon :icon="resolveNodeIcon(node.data.icon)" :size="14" />
              </div>
              <span
                class="font-medium text-xs text-card-foreground truncate block overflow-hidden text-ellipsis whitespace-nowrap max-w-[100px]"
              >{{ node.data.label }}</span>
            </div>
          </div>

          <!-- 执行状态角标 -->
          <div
            v-if="getStatusBadgeIcon(node.id, taskStates)"
            class="absolute -top-2 -right-2 flex items-center justify-center w-4 h-4 rounded-full text-white shadow-sm"
            :style="{ backgroundColor: getStatusBadgeColor(node.id, taskStates) }"
          >
            <IconifyIcon
              :icon="getStatusBadgeIcon(node.id, taskStates)!"
              :size="10"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
