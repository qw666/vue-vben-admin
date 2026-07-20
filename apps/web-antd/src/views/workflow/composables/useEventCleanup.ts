export function useEventCleanup() {
  const listeners: {
    target: EventTarget;
    type: string;
    handler: (...args: any[]) => void;
  }[] = [];

  function addListener(target: EventTarget, type: string, handler: (...args: any[]) => void) {
    target.addEventListener(type, handler as EventListener);
    listeners.push({ target, type, handler });
  }

  function removeAllListeners() {
    listeners.forEach(({ target, type, handler }) => {
      target.removeEventListener(type, handler as EventListener);
    });
    listeners.length = 0;
  }

  function removeListener(target: EventTarget, type: string, handler: (...args: any[]) => void) {
    target.removeEventListener(type, handler as EventListener);
    const index = listeners.findIndex(
      l => l.target === target && l.type === type && l.handler === handler
    );
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  return {
    addListener,
    removeAllListeners,
    removeListener,
  };
}
