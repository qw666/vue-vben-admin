export interface ViewportPosition {
  x: number;
  y: number;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface TransformState {
  panX: number;
  panY: number;
  scale: number;
}

export function viewportToCanvas(
  viewportPos: ViewportPosition,
  transform: TransformState
): CanvasPosition {
  return {
    x: (viewportPos.x - transform.panX) / transform.scale,
    y: (viewportPos.y - transform.panY) / transform.scale,
  };
}

export function canvasToViewport(
  canvasPos: CanvasPosition,
  transform: TransformState
): ViewportPosition {
  return {
    x: canvasPos.x * transform.scale + transform.panX,
    y: canvasPos.y * transform.scale + transform.panY,
  };
}

export function getElementCanvasPosition(
  element: HTMLElement,
  canvasElement: HTMLElement,
  transform: TransformState
): CanvasPosition {
  const canvasRect = canvasElement.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  
  const viewportX = elementRect.left - canvasRect.left + elementRect.width / 2;
  const viewportY = elementRect.top - canvasRect.top + elementRect.height / 2;
  
  return viewportToCanvas({ x: viewportX, y: viewportY }, transform);
}

export function getMouseCanvasPosition(
  event: MouseEvent,
  canvasElement: HTMLElement,
  transform: TransformState
): CanvasPosition {
  const canvasRect = canvasElement.getBoundingClientRect();
  
  const viewportX = event.clientX - canvasRect.left;
  const viewportY = event.clientY - canvasRect.top;
  
  return viewportToCanvas({ x: viewportX, y: viewportY }, transform);
}