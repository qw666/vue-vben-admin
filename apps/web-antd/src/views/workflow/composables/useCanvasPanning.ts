import { ref } from 'vue';

export function useCanvasPanning() {
  const panOffset = ref({ x: 0, y: 0 });
  const scale = ref(1);

  function updatePanOffset(offset: { x: number; y: number }) {
    panOffset.value = offset;
  }

  function updateScale(value: number) {
    scale.value = value;
  }

  return {
    panOffset,
    scale,
    updatePanOffset,
    updateScale,
  };
}