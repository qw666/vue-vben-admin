/**
 * VarSelectContext - 变量选择器上下文的 provide/inject 实现
 *
 * 架构设计：
 * ┌───────────────────────────────────────────────────────┐
 * │  ConfigPanel (provideVarSelect)                       │
 * │  - 从 store 获取 currentNodeId, nodes, edges         │
 * │  - 通过 Vue provide 向所有后代组件暴露                │
 * └───────────────────────┬──────────────────────────────┘
 *                         │ inject (自动)
 * ┌───────────────────────▼──────────────────────────────┐
 * │  VarPicker (useVarSelect)                            │
 * │  - 无需任何 props（除 v-model）                     │
 * │  - 自动获取上下文，自包含组件                        │
 * └───────────────────────────────────────────────────────┘
 *
 * 优势：
 * - 新增节点类型时，只需在 ConfigPanel 提供一次上下文
 * - VarPicker 完全解耦，任何组件都能使用
 * - 避免 prop drilling，单一数据源
 */
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import { inject, provide } from 'vue';

export interface VarSelectContextValue {
  /** 当前编辑的节点 ID */
  currentNodeId: ComputedRef<string>;
  /** 当前工作流的所有节点 */
  nodes: ComputedRef<any[]>;
  /** 当前工作流的所有连线 */
  edges: ComputedRef<any[]>;
}

const KEY: InjectionKey<VarSelectContextValue> = Symbol('var-select-context');

/**
 * ConfigPanel 层调用，向所有后代提供上下文。
 * 通常在 onMounted 或 setup 中调用一次。
 */
export function provideVarSelect(context: VarSelectContextValue): void {
  provide(KEY, context);
}

/**
 * VarPicker 内部调用，获取上下文。
 * 如果父组件未 provide，返回空上下文（降级处理）。
 */
export function useVarSelect(): VarSelectContextValue {
  const injected = inject(KEY, null);
  if (injected) return injected;

  // 降级空上下文 - 不会显示变量
  return createEmptyContext();
}

function createEmptyContext(): VarSelectContextValue {
  const noopComputed = <T>(value: T): ComputedRef<T> => ({
    get value() { return value; },
    set value(_: T) { throw new Error('read-only'); },
  } as ComputedRef<T>);

  return {
    currentNodeId: noopComputed(''),
    nodes: noopComputed([]),
    edges: noopComputed([]),
  };
}

/**
 * 便捷工厂：从现有 computed/ref 创建上下文对象。
 *
 * 使用示例（ConfigPanel 中）：
 * ```ts
 * const store = useWorkflowStore();
 * const selectedNodeId = computed(() => store.selectedNodeId || '');
 * const nodes = computed(() => store.currentWorkflow?.nodes || []);
 * const edges = computed(() => store.currentWorkflow?.edges || []);
 * provideVarSelect(createVarSelectContext({ selectedNodeId, nodes, edges }));
 * ```
 */
export function createVarSelectContext(params: {
  selectedNodeId: Ref<string | null | undefined> | ComputedRef<string | null | undefined>;
  nodes: ComputedRef<any[]>;
  edges: ComputedRef<any[]>;
}): VarSelectContextValue {
  return {
    currentNodeId: computed(() => params.selectedNodeId.value || ''),
    nodes: params.nodes,
    edges: params.edges,
  };
}

// 简单 computed 实现（仅用于 createVarSelectContext）
function computed<T>(fn: () => T): ComputedRef<T> {
  return {
    get value() { return fn(); },
    set value(_: T) { throw new Error('read-only'); },
  } as ComputedRef<T>;
}
