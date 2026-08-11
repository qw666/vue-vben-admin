import type {
  VarNode,
  VarSourceContext,
  VarSourceProvider,
  WorkflowNode,
} from '#/types/workflow';

import { flowControlNodeRegistry } from '../nodes/types';
import { evalCondition } from '../utils/conditionEval';
import { findUpstreamNodes, findEnclosingLoopNode, getStartNodeTriggers } from './varSourceTraversal';

/** 获取节点的输出声明 */
export function getNodeOutputs(
  node: WorkflowNode,
  pluginMetaCache?: Record<string, any>,
): Array<{
  key: string;
  label?: string;
  type?: any;
  path?: string;
}> {
  const nodeType = node.data?.type;
  if (!nodeType) return [];

  // 优先使用节点策略的 getOutputs 方法（包括 OutputValues 等前端策略节点）
  if (flowControlNodeRegistry.hasNodeOutputs(nodeType)) {
    const strategy = flowControlNodeRegistry.get(nodeType);
    let config = node.data?.config || {};
    // 关键：先反序列化配置（后端格式 → 前端格式）
    // OutputValues 等节点的 getOutputs 期望前端数组格式
    if (strategy?.deserializeConfig) {
      config = strategy.deserializeConfig(config);
    }
    return flowControlNodeRegistry.getOutputs(nodeType, config);
  }

  // 从插件元数据获取动态节点的 outputs 声明
  // parseMetaSchema 已保证 meta.outputs 是数组，这里只读取不写入
  if (pluginMetaCache) {
    const meta = pluginMetaCache[nodeType];
    if (meta?.outputs && Array.isArray(meta.outputs)) {
      const config = node.data?.config || {};
      return meta.outputs
        .filter((o: any) => o?.key && evalCondition(o.condition, config))
        .map((o: any) => ({
          key: o.key,
          label: o.label || o.key,
          type: o.type || 'any',
          path: o.path,
        }));
    }
  }

  // 动态插件节点：从 _declaredOutputs 或 outputKeys 配置获取（向后兼容）
  const declared = node.data?.config?._declaredOutputs;
  if (Array.isArray(declared) && declared.length > 0) {
    return declared.filter((d: any) => d?.key);
  }
  const outputKeys = node.data?.config?.outputKeys;
  if (Array.isArray(outputKeys) && outputKeys.length > 0) {
    return outputKeys.map((k: any) => {
      if (typeof k === 'string') return { key: k, label: k };
      return {
        key: k.key || k.id || '',
        label: k.label || k.key || k.id || '',
        type: k.type,
        path: k.path,
      };
    }).filter((o) => o.key);
  }
  return [];
}

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
    return upstream
      .map((node) => {
        const outputs = getNodeOutputs(node, ctx.pluginMetaCache);
        // Skip nodes without output variables
        if (outputs.length === 0) return null;
        const children = outputs.map((o) => ({
          key: `upstream-${node.id}-${o.key}`,
          label: o.label || o.key,
          expression: `{{ outputs.${node.id}.${o.path || o.key} }}`,
          type: o.type || 'any',
          group: 'upstream' as const,
        }));
        return {
          key: `upstream-${node.id}`,
          label: node.data?.label || node.id,
          group: 'upstream' as const,
          icon: 'mdi:cube-outline',
          children,
        } as VarNode;
      })
      .filter((node): node is VarNode => node !== null);
  },
};

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

export const providers: VarSourceProvider[] = [
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
