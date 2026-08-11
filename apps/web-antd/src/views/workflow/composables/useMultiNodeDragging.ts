import { ref } from 'vue';

import { useWorkflowStore } from '#/store/workflow';

import { useEventCleanup } from './useEventCleanup';

export function useMultiNodeDragging(
  panOffset: { value: { x: number; y: number } },
  scale: { value: number }
) {
  const store = useWorkflowStore();
  const isMultiDragging = ref(false);
  const multiDragNodeId = ref<null | string>(null);
  const multiDragIds = ref<string[]>([]);
  const dragSnapshots = ref<Map<string, {x: number, y: number}>>(new Map());
  const dragOffset = ref({ x: 0, y: 0 });

  // Separate cleanup for drag listeners (mousemove, mouseup, mouseleave)
  const { addListener, removeAllListeners: removeAllDragListeners } = useEventCleanup();

  // visibilitychange listener management (separate from drag listeners)
  let isVisibilityListenerRegistered = false;

  function handleVisibilityChange() {
    if (isMultiDragging.value) {
      cleanupDragListeners();
      isMultiDragging.value = false;
      multiDragNodeId.value = null;
      multiDragIds.value = [];
      dragSnapshots.value.clear();
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

  function startMultiDrag(e: MouseEvent, dragNodeId: string, selectedIds: string[]) {
    // Clean up any stuck state from previous drag operations
    if (isMultiDragging.value || multiDragNodeId.value || multiDragIds.value.length > 0) {
      cleanupDragListeners();
      isMultiDragging.value = false;
      multiDragNodeId.value = null;
      multiDragIds.value = [];
      dragSnapshots.value.clear();
    }

    const target = e.target as HTMLElement;
    if (target.closest('.node-port')) {
      return;
    }

    ensureVisibilityListener();
    e.preventDefault();
    isMultiDragging.value = true;
    multiDragNodeId.value = dragNodeId;
    multiDragIds.value = [...selectedIds];

    dragSnapshots.value.clear();
    selectedIds.forEach(id => {
      const node = store.currentWorkflow?.nodes.find(n => n.id === id);
      if (node) {
        dragSnapshots.value.set(id, { ...node.position });
      }
    });

    const node = store.currentWorkflow?.nodes.find(n => n.id === dragNodeId);
    if (node) {
      dragOffset.value = {
        x: e.clientX - node.position.x * scale.value - panOffset.value.x,
        y: e.clientY - node.position.y * scale.value - panOffset.value.y
      };
    }

    function onMouseMove(event: MouseEvent) {
      if (!isMultiDragging.value) return;

      const newX = Math.max(0, (event.clientX - dragOffset.value.x - panOffset.value.x) / scale.value);
      const newY = Math.max(0, (event.clientY - dragOffset.value.y - panOffset.value.y) / scale.value);

      const initialPos = dragSnapshots.value.get(dragNodeId);
      if (!initialPos) return;

      const deltaX = newX - initialPos.x;
      const deltaY = newY - initialPos.y;

      for (const [id, pos] of dragSnapshots.value) {
        store.updateNode(id, {
          position: {
            x: Math.max(0, pos.x + deltaX),
            y: Math.max(0, pos.y + deltaY)
          }
        });
      }
    }

    function onMouseUp() {
      cleanupDragListeners();
      isMultiDragging.value = false;
      multiDragNodeId.value = null;
      multiDragIds.value = [];
      dragSnapshots.value.clear();
    }

    function onMouseLeave() {
      if (isMultiDragging.value) {
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
    isMultiDragging.value = false;
    multiDragNodeId.value = null;
    multiDragIds.value = [];
    dragSnapshots.value.clear();
  }

  return {
    isMultiDragging,
    multiDragNodeId,
    multiDragIds,
    startMultiDrag,
    cleanup,
  };
}
