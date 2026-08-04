import type {
  VarNode,
  VarSourceContext,
  VarSourceProvider,
  WorkflowEdge,
  WorkflowNode,
} from '#/types/workflow';

import { computed, type Ref } from 'vue';

import { useWorkflowStore } from '#/store/workflow';
import { flowControlNodeRegistry } from '../nodes/types';
import { useVarSelect } from './varSelectContext';

// ===== 反向 BFS：找当前节点的所有上游节点 =====

/**
 * 从当前节点出发，沿 edges.target → edges.source 反向遍历，
 * 收集所有能到达当前节点的上游节点。
 * 不包含当前节点自己。
 */
function findUpstreamNodes(ctx: VarSourceContext): WorkflowNode[] {
  const { currentNodeId, nodes, edges } = ctx;
  const visited = new Set<string>([currentNodeId]);
  const queue: string[] = [currentNodeId];
  const result: WorkflowNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    edges.forEach((e) => {
      if (e.target === id && !visited.has(e.source)) {
        visited.add(e.source);
        queue.push(e.source);
        const node = nodes.find((n) => n.id === e.source);
        if (node) result.push(node);
      }
    });
  }
  return result;
}

/**
 * 判断当前节点是否处于某个容器节点（ForEach/Parallel）的子任务作用域内。
 * 简化判定：上游链路中存在 ForEach 节点即视为在循环体内。
 */
function findEnclosingLoopNode(
  ctx: VarSourceContext,
): WorkflowNode | undefined {
  const upstream = findUpstreamNodes(ctx);
  return upstream.find((n) => n.data?.type === 'idp_core_flow_ForEach');
}

/**
 * 获取开始节点的触发器配置（优先从开始节点 config，其次从 workflow 级 triggers）
 */
function getStartNodeTriggers(ctx: VarSourceContext): any[] {
  // 1. 优先从开始节点 config 取
  const startNode = ctx.nodes.find(
    (n) => n.data?.type === 'idp_core_flow_Start',
  );
  if (startNode?.data?.config?.triggers) {
    const triggers = startNode.data.config.triggers;
    if (Array.isArray(triggers) && triggers.length > 0) return triggers;
  }
  // 2. 回退到 workflow 级 triggers
  if (ctx.triggers && ctx.triggers.length > 0) return ctx.triggers;
  return [];
}

// ===== 内置变量来源 providers =====

/** 1. 上游节点输出 */
const upstreamProvider: VarSourceProvider = {
  id: 'upstream',
  label: '上游节点输出',
  group: 'upstream',
  icon: 'mdi:source-branch',
  order: 10,
  getVars(ctx: VarSourceContext): VarNode[] {
    const upstream = findUpstreamNodes(ctx);
    return upstream.map((node) => {
      const outputs = getNodeOutputs(node);
      const children = outputs.map((o) => ({
        key: `upstream-${node.id}-${o.key}`,
        label: o.label || o.key,
        expression: `{{ outputs.${node.id}.${o.key} }}`,
        type: o.type || 'any',
        group: 'upstream' as const,
      }));
      // 即使没有输出变量，也显示节点（占位提示）
      const displayChildren = children.length > 0 ? children : [{
        key: `upstream-${node.id}-placeholder`,
        label: '（暂无输出变量）',
        expression: '',
        type: 'any',
        disabled: true,
        group: 'upstream' as const,
      }];
      return {
        key: `upstream-${node.id}`,
        label: node.data?.label || node.id,
        group: 'upstream' as const,
        icon: 'mdi:cube-outline',
        children: displayChildren,
      } as VarNode;
    });
  },
};

/** 获取节点的输出声明 */
function getNodeOutputs(node: WorkflowNode): Array<{
  key: string;
  label?: string;
  type?: any;
}> {
  const nodeType = node.data?.type;
  if (!nodeType) return [];
  if (flowControlNodeRegistry.isFlowControlNode(nodeType)) {
    return flowControlNodeRegistry.getOutputs(nodeType, node.data?.config || {});
  }
  const declared = node.data?.config?._declaredOutputs;
  if (Array.isArray(declared) && declared.length > 0) {
    return declared.filter((d: any) => d?.key);
  }
  // 对于 Code/HTTP 等节点，从 outputKeys 配置获取
  const outputKeys = node.data?.config?.outputKeys;
  if (Array.isArray(outputKeys) && outputKeys.length > 0) {
    return outputKeys.map((k: any) => {
      if (typeof k === 'string') return { key: k, label: k };
      return {
        key: k.key || k.id || '',
        label: k.label || k.key || k.id || '',
        type: k.type,
      };
    }).filter((o) => o.key);
  }
  return [];
}

/** 2. 流程输入 */
const inputsProvider: VarSourceProvider = {
  id: 'inputs',
  label: '流程输入',
  group: 'inputs',
  icon: 'mdi:login-variant',
  order: 20,
  enabled(ctx) {
    return (ctx.inputs || []).length > 0;
  },
  getVars(ctx: VarSourceContext): VarNode[] {
    const inputs = ctx.inputs || [];
    return inputs.map((inp) => ({
      key: `inputs-${inp.id}`,
      label: inp.id + (inp.displayName ? `（${inp.displayName}）` : ''),
      expression: `{{ inputs.${inp.id} }}`,
      type: mapInputType(inp.type),
      group: 'inputs' as const,
    }));
  },
};

function mapInputType(type?: string): VarNode['type'] {
  switch (type) {
    case 'INT':
    case 'FLOAT': return 'number';
    case 'BOOLEAN': return 'boolean';
    case 'ARRAY': return 'array';
    case 'JSON': return 'object';
    default: return 'string';
  }
}

/** 3. 触发器（仅当开始节点配置了触发器时可见） */
const triggerProvider: VarSourceProvider = {
  id: 'trigger',
  label: '触发器',
  group: 'trigger',
  icon: 'mdi:bell-outline',
  order: 30,
  enabled(ctx) {
    return getStartNodeTriggers(ctx).length > 0;
  },
  getVars(ctx: VarSourceContext): VarNode[] {
    const triggers = getStartNodeTriggers(ctx);
    if (triggers.length === 0) return [];

    const result: VarNode[] = [];
    triggers.forEach((t, idx) => {
      const isSchedule = t.type?.includes('Schedule') || t.type?.includes('schedule');
      const isFlow = t.type?.includes('Flow') || t.type?.includes('flow');
      const label = t.id || `trigger-${idx}`;

      if (isSchedule) {
        result.push(
          {
            key: `trigger-${idx}-date`,
            label: `${label}.date（触发时间）`,
            expression: `{{ trigger.date }}`,
            type: 'string',
            group: 'trigger',
          },
          {
            key: `trigger-${idx}-next`,
            label: `${label}.next（下次触发）`,
            expression: `{{ trigger.next }}`,
            type: 'string',
            group: 'trigger',
          },
          {
            key: `trigger-${idx}-previous`,
            label: `${label}.previous（上次触发）`,
            expression: `{{ trigger.previous }}`,
            type: 'string',
            group: 'trigger',
          },
        );
      } else if (isFlow) {
        result.push(
          {
            key: `trigger-${idx}-executionId`,
            label: `${label}.executionId（触发源执行ID）`,
            expression: `{{ trigger.executionId }}`,
            type: 'string',
            group: 'trigger',
          },
          {
            key: `trigger-${idx}-namespace`,
            label: `${label}.namespace（触发源命名空间）`,
            expression: `{{ trigger.namespace }}`,
            type: 'string',
            group: 'trigger',
          },
          {
            key: `trigger-${idx}-flowId`,
            label: `${label}.flowId（触发源流程ID）`,
            expression: `{{ trigger.flowId }}`,
            type: 'string',
            group: 'trigger',
          },
        );
      } else {
        result.push({
          key: `trigger-${idx}-context`,
          label: `${label}（触发器上下文）`,
          expression: `{{ trigger }}`,
          type: 'object',
          group: 'trigger',
        });
      }
    });
    return result;
  },
};

/** 4. 循环作用域 */
const loopProvider: VarSourceProvider = {
  id: 'loop',
  label: '循环作用域',
  group: 'loop',
  icon: 'mdi:sync',
  order: 40,
  enabled(ctx) {
    return !!findEnclosingLoopNode(ctx);
  },
  getVars(ctx: VarSourceContext): VarNode[] {
    const loopNode = findEnclosingLoopNode(ctx);
    if (!loopNode) return [];
    return [
      {
        key: 'parent-taskrun-value',
        label: '父级迭代值',
        expression: `{{ parent.taskrun.value }}`,
        type: 'any',
        group: 'loop',
      },
    ];
  },
};

/** 5. 系统变量（流程执行信息） */
const systemProvider: VarSourceProvider = {
  id: 'system',
  label: '系统变量',
  group: 'system',
  icon: 'mdi:settings-outline',
  order: 50,
  getVars(ctx: VarSourceContext): VarNode[] {
    const loopNode = findEnclosingLoopNode(ctx);
    const items: VarNode[] = [
      {
        key: 'execution-id',
        label: '流程执行ID',
        expression: `{{ execution.id }}`,
        type: 'string',
        group: 'system',
      },
      {
        key: 'execution-startDate',
        label: '流程开始执行时间',
        expression: `{{ execution.startDate }}`,
        type: 'string',
        group: 'system',
      },
      {
        key: 'flow-id',
        label: '流程ID',
        expression: `{{ flow.id }}`,
        type: 'string',
        group: 'system',
      },
      {
        key: 'task-id',
        label: '当前节点任务ID',
        expression: `{{ task.id }}`,
        type: 'string',
        group: 'system',
      },
      {
        key: 'taskrun-id',
        label: '当前节点运行ID',
        expression: `{{ taskrun.id }}`,
        type: 'string',
        group: 'system',
      },
      {
        key: 'taskrun-startDate',
        label: '当前节点开始时间',
        expression: `{{ taskrun.startDate }}`,
        type: 'string',
        group: 'system',
      },
    ];
    if (loopNode) {
      items.push(
        {
          key: 'taskrun-value',
          label: '当前迭代值',
          expression: `{{ taskrun.value }}`,
          type: 'any',
          group: 'system',
        },
        {
          key: 'taskrun-iteration',
          label: '当前迭代序号',
          expression: `{{ taskrun.iteration }}`,
          type: 'number',
          group: 'system',
        },
      );
    }
    return items;
  },
};

/** 11. 流程变量（vars.*） */
const varsProvider: VarSourceProvider = {
  id: 'vars',
  label: '流程变量',
  group: 'vars',
  icon: 'mdi:variable',
  order: 60,
  enabled(ctx) {
    return (ctx.vars || []).length > 0;
  },
  getVars(ctx: VarSourceContext): VarNode[] {
    const vars = ctx.vars || [];
    return vars.map((v) => ({
      key: `vars-${v.key}`,
      label: v.key + (v.label ? `（${v.label}）` : ''),
      expression: `{{ vars.${v.key} }}`,
      type: 'any',
      group: 'vars' as const,
    }));
  },
};

/** 12. 标签（labels.*） */
const labelsProvider: VarSourceProvider = {
  id: 'labels',
  label: '标签',
  group: 'labels',
  icon: 'mdi:tag-outline',
  order: 70,
  enabled(ctx) {
    return (ctx.labels || []).length > 0;
  },
  getVars(ctx: VarSourceContext): VarNode[] {
    const labels = ctx.labels || [];
    return labels.map((l) => ({
      key: `labels-${l.key}`,
      label: l.key + (l.label ? `（${l.label}）` : ''),
      expression: `{{ labels.${l.key} }}`,
      type: 'string',
      group: 'labels' as const,
    }));
  },
};

/** 13. 环境变量（envs.*） */
const envsProvider: VarSourceProvider = {
  id: 'envs',
  label: '环境变量',
  group: 'envs',
  icon: 'mdi:environment-outline',
  order: 80,
  enabled(ctx) {
    return (ctx.envs || []).length > 0;
  },
  getVars(ctx: VarSourceContext): VarNode[] {
    const envs = ctx.envs || [];
    return envs.map((e) => ({
      key: `envs-${e.key}`,
      label: e.key + (e.label ? `（${e.label}）` : ''),
      expression: `{{ envs.${e.key} }}`,
      type: 'string',
      group: 'envs' as const,
    }));
  },
};

/** 14. 全局配置（globals.*） */
const globalsProvider: VarSourceProvider = {
  id: 'globals',
  label: '全局配置',
  group: 'globals',
  icon: 'mdi:earth',
  order: 90,
  enabled(ctx) {
    return (ctx.globals || []).length > 0;
  },
  getVars(ctx: VarSourceContext): VarNode[] {
    const globals = ctx.globals || [];
    return globals.map((g) => ({
      key: `globals-${g.key}`,
      label: g.key + (g.label ? `（${g.label}）` : ''),
      expression: `{{ globals.${g.key} }}`,
      type: 'string',
      group: 'globals' as const,
    }));
  },
};

// ===== provider 注册表 =====

const providers: VarSourceProvider[] = [
  upstreamProvider,
  systemProvider,
  inputsProvider,
  triggerProvider,
  loopProvider,
  varsProvider,
  labelsProvider,
  envsProvider,
  globalsProvider,
];

/** 注册新的变量来源 */
export function registerVarSource(provider: VarSourceProvider): void {
  if (!providers.some((p) => p.id === provider.id)) {
    providers.push(provider);
  }
}

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

// ===== 表达式反解析工具 =====

const SINGLE_VAR_PATTERN = /^\s*\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}\s*$/;

export interface ParsedVarRef {
  expression: string;
  segments: string[];
}

export function tryParseVarRef(expression: string): ParsedVarRef | null {
  if (!expression) return null;
  const match = expression.match(SINGLE_VAR_PATTERN);
  if (!match || match[1] === undefined) return null;
  const path = match[1];
  const segments = path.split('.');
  if (segments.length < 2) return null;
  return { expression, segments };
}

export function isSingleVarRef(expression: string): boolean {
  return SINGLE_VAR_PATTERN.test(expression);
}

// ===== 引用重构 =====

function rewriteExprString(input: string, oldId: string, newId: string): string {
  if (!input || typeof input !== 'string') return input;
  const pattern = new RegExp(`outputs\\.${escapeRegExp(oldId)}\\.`, 'g');
  return input.replace(pattern, `outputs.${newId}.`);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rewriteVarReferences(
  obj: any,
  oldNodeId: string,
  newNodeId: string,
): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return rewriteExprString(obj, oldNodeId, newNodeId);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => rewriteVarReferences(item, oldNodeId, newNodeId));
  }
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      result[key] = rewriteVarReferences(obj[key], oldNodeId, newNodeId);
    }
    return result;
  }
  return obj;
}

export function countNodeReferences(
  nodes: WorkflowNode[],
  nodeId: string,
): number {
  const pattern = new RegExp(`outputs\\.${escapeRegExp(nodeId)}\\.`);
  let count = 0;
  const walk = (val: any) => {
    if (val === null || val === undefined) return;
    if (typeof val === 'string') {
      if (pattern.test(val)) count++;
      return;
    }
    if (Array.isArray(val)) {
      val.forEach(walk);
      return;
    }
    if (typeof val === 'object') {
      for (const k of Object.keys(val)) walk(val[k]);
    }
  };
  nodes.forEach((n) => {
    if (n.id === nodeId) return;
    walk(n.data?.config);
  });
  return count;
}
