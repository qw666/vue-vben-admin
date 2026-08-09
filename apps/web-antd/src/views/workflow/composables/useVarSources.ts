import type {
  VarNode,
  VarSourceContext,
  WorkflowEdge,
  WorkflowNode,
} from '#/types/workflow';

import { computed, type Ref } from 'vue';

import { useWorkflowStore } from '#/store/workflow';
import { useVarSelect } from './varSelectContext';
import { usePluginMeta } from './usePluginMeta';
import { evalCondition } from '../utils/conditionEval';

import {
  providers,
} from './varSourceProviders';

// ===== Barrel re-exports: maintain backward compatibility =====
export { evalCondition };
export {
  // Expression parsing & reference rewriting
  tryParseVarRef,
  isSingleVarRef,
  rewriteVarReferences,
  countNodeReferences,
  type ParsedVarRef,
} from './varSourceExpression';

export { registerVarSource } from './varSourceProviders';
export { getNodeOutputs } from './varSourceProviders';
export {
  // Traversal
  findUpstreamNodes,
  findEnclosingLoopNode,
  getStartNodeTriggers,
  expandBranchWithEdges,
  getContainerBranches,
  findBranchInContainer,
  getAllBranchChildIds,
  type ContainerBranch,
} from './varSourceTraversal';

// ===== composable 主体 =====

/**
 * 变量数据源 composable。
 *
 * 支持两种使用模式：
 * 1. 传入显式 ref（旧模式，兼容）
 * 2. 不传参数，自动从 VarSelectContext (provide/inject) 获取
 *
 * 推荐使用模式 2：在 ConfigPanel 层 provide，
 * 所有 VarPicker 自动获得上下文，无需 prop drilling。
 */
export function useVarSources(
  currentNodeIdRef?: Ref<string | null | undefined>,
  extraEdgesRef?: Ref<WorkflowEdge[] | undefined>,
  extraNodesRef?: Ref<WorkflowNode[] | undefined>,
) {
  const store = useWorkflowStore();
  const injected = useVarSelect();
  const { pluginMetaCache } = usePluginMeta();

  const availableVars = computed<VarNode[]>(() => {
    const id = currentNodeIdRef?.value || injected?.currentNodeId.value || '';
    const wf = store.currentWorkflow;

    // 数据优先级：传入的 ref > injected > store
    const extraNodes = extraNodesRef?.value;
    const extraEdges = extraEdgesRef?.value;
    const injectedNodes = injected?.nodes.value;
    const injectedEdges = injected?.edges.value;

    const nodes = 
      (extraNodes && extraNodes.length > 0) ? extraNodes :
      (injectedNodes && injectedNodes.length > 0) ? injectedNodes :
      (wf?.nodes || []);
    const edges = 
      (extraEdges && extraEdges.length > 0) ? extraEdges :
      (injectedEdges && injectedEdges.length > 0) ? injectedEdges :
      (wf?.edges || []);

    const ctx: VarSourceContext = {
      currentNodeId: id,
      nodes,
      edges,
      inputs: wf?.inputs || [],
      triggers: wf?.triggers || [],
      outputs: wf?.outputs,
      vars: (wf as any)?.variables || [],
      labels: (wf as any)?.labels || [],
      envs: (wf as any)?.envs || [],
      globals: (wf as any)?.globals || [],
      pluginMetaCache: pluginMetaCache.value,
    };

    return providers
      .filter((p) => {
        const alwaysVisible = ['system'];
        if (alwaysVisible.includes(p.id)) return true;
        if (!wf && !injected) return false;
        if (p.enabled) return p.enabled(ctx);
        return true;
      })
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
      .map((p) => {
        const children = p.getVars(ctx);
        return {
          key: p.id,
          label: p.label,
          group: p.group,
          icon: p.icon,
          children,
        } as VarNode;
      })
      .filter((g) => (g.children?.length ?? 0) > 0);
  });

  return { availableVars };
}
