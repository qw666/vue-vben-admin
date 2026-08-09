import type {
  VarSourceContext,
  WorkflowEdge,
  WorkflowNode,
} from '#/types/workflow';

// ===== 反向 BFS：找当前节点的所有上游节点 =====

/**
 * 从当前节点出发，沿 edges.target → edges.source 反向遍历，
 * 收集所有能到达当前节点的上游节点。
 * 包括容器节点（Switch/If/ForEach/Parallel）的子节点配置中的节点。
 * 不包含当前节点自己。
 * 
 * 关键逻辑：分支隔离 - 容器节点内的子节点只能看到同一分支内的上游节点。
 * 当处理容器节点时，只提取当前节点所在分支的子节点，不提取兄弟分支的子节点。
 */
export interface ContainerBranch {
  branchKey: string;
  nodeIds: string[];
}

/**
 * 通过 edges 扩展分支节点列表，包含链式后代节点。
 * 给定分支的起始节点 ID 列表，沿 edges 出边方向收集所有可达的节点。
 * 注意：并行分支间不会有 edges 相连，所以不会越界。
 */
export function expandBranchWithEdges(
  branchNodeIds: string[],
  edges: WorkflowEdge[],
): string[] {
  const expandedIds = new Set<string>(branchNodeIds);
  const queue = [...branchNodeIds];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const downstreamEdges = edges.filter((e) => e.source === currentId);

    for (const edge of downstreamEdges) {
      const targetId = edge.target;
      if (!expandedIds.has(targetId)) {
        expandedIds.add(targetId);
        queue.push(targetId);
      }
    }
  }

  return Array.from(expandedIds);
}

/**
 * 从容器配置中提取所有分支及其子节点 ID。
 * 统一处理对象字段（cases/parallel）和数组字段（then/else/tasks/foreach/defaults/errors/finally）。
 * 对于数组字段中的每个元素，创建独立分支（branchKey 包含索引）。
 * 如果提供了 edges，会扩展每个分支的链式后代节点。
 */
export function getContainerBranches(config: any, edges?: WorkflowEdge[]): ContainerBranch[] {
  if (!config || typeof config !== 'object') return [];
  const branches: ContainerBranch[] = [];

  // 对象类型字段: cases (Switch), parallel
  for (const field of ['cases', 'parallel'] as const) {
    const value = config[field];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, tasks] of Object.entries(value)) {
        if (Array.isArray(tasks)) {
          const nodeIds = tasks.filter((t: any) => t?.nodeId).map((t: any) => t.nodeId);
          if (nodeIds.length > 0) {
            branches.push({ branchKey: `${field}.${key}`, nodeIds });
          }
        }
      }
    }
  }

  // 数组类型字段: then, else, tasks, foreach, defaults, errors, finally
  // 每个数组元素是独立分支（并行、顺序容器的每个子节点都是独立分支）
  for (const field of ['then', 'else', 'tasks', 'foreach', 'defaults', 'errors', 'finally'] as const) {
    const value = config[field];
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item?.nodeId) {
          branches.push({
            branchKey: `${field}.${i}`,
            nodeIds: [item.nodeId],
          });
        }
      }
    }
  }

  // 如果提供了 edges，扩展每个分支的链式后代节点
  if (edges && edges.length > 0) {
    for (const branch of branches) {
      branch.nodeIds = expandBranchWithEdges(branch.nodeIds, edges);
    }
  }

  return branches;
}

/** 找到某个 nodeId 在容器配置中所属的分支 */
export function findBranchInContainer(config: any, nodeId: string, edges?: WorkflowEdge[]): ContainerBranch | null {
  return getContainerBranches(config, edges).find((b) => b.nodeIds.includes(nodeId)) || null;
}

/** 从容器配置中获取所有子节点 ID 及其所属分支 */
export function getAllBranchChildIds(config: any, edges?: WorkflowEdge[]): { nodeId: string; branchKey: string }[] {
  const result: { nodeId: string; branchKey: string }[] = [];
  for (const branch of getContainerBranches(config, edges)) {
    for (const nodeId of branch.nodeIds) {
      result.push({ nodeId, branchKey: branch.branchKey });
    }
  }
  return result;
}

export function findUpstreamNodes(ctx: VarSourceContext): WorkflowNode[] {
  const { currentNodeId, nodes, edges } = ctx;
  const visited = new Set<string>([currentNodeId]);
  const queue: string[] = [currentNodeId];
  const result: WorkflowNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    
    // Find nodes connected via edges
    edges.forEach((e) => {
      if (e.target === id && !visited.has(e.source)) {
        visited.add(e.source);
        queue.push(e.source);
        const node = nodes.find((n) => n.id === e.source);
        if (node) result.push(node);
      }
    });
    
    // Handle container node's child nodes (branch-aware)
    const currentNode = nodes.find((n) => n.id === id);
    if (currentNode && currentNode.data?.config) {
      const config = currentNode.data.config;
      
      // Case 1: 当前节点是容器节点
      const allChildren = getAllBranchChildIds(config, edges);
      if (allChildren.length > 0) {
        // 找出哪些子节点已在visited中
        const visitedChildBranchKeys = new Set<string>();
        for (const child of allChildren) {
          if (visited.has(child.nodeId)) {
            visitedChildBranchKeys.add(child.branchKey);
          }
        }

        // 找出当前节点沿出边可达的下游节点（用于过滤）
        const downstreamIds = new Set<string>();
        {
          const dfsStack = [id];
          while (dfsStack.length > 0) {
            const dfsId = dfsStack.pop()!;
            for (const e of edges) {
              if (e.source === dfsId) {
                if (!downstreamIds.has(e.target)) {
                  downstreamIds.add(e.target);
                  dfsStack.push(e.target);
                }
              }
            }
          }
        }

        if (visitedChildBranchKeys.size > 0) {
          // 1a. 当前节点在容器内部：只提取已访问分支的兄弟节点（分支隔离）
          for (const child of allChildren) {
            if (visitedChildBranchKeys.has(child.branchKey) && !visited.has(child.nodeId) && !downstreamIds.has(child.nodeId)) {
              visited.add(child.nodeId);
              queue.push(child.nodeId);
              const childNode = nodes.find((n) => n.id === child.nodeId);
              if (childNode) result.push(childNode);
            }
          }
        } else if (id !== currentNodeId) {
          // 1b. 当前节点在容器外部（不是起点）：提取所有分支的子节点
          for (const child of allChildren) {
            if (!visited.has(child.nodeId)) {
              visited.add(child.nodeId);
              queue.push(child.nodeId);
              const childNode = nodes.find((n) => n.id === child.nodeId);
              if (childNode) result.push(childNode);
            }
          }
        }
        // 1c. 当前节点是容器且是起点：跳过，子节点是容器的下游
      }
    }

    // Case 2: 当前节点可能是容器节点的子节点 - 检查其父容器
    // 通过边连接找父容器（反向）
    const parentEdges = edges.filter((e) => e.target === id);
    for (const parentEdge of parentEdges) {
      const parentNode = nodes.find((n) => n.id === parentEdge.source);
      if (parentNode && parentNode.data?.config) {
        const branchInfo = findBranchInContainer(parentNode.data.config, id, edges);
        if (branchInfo) {
          // 当前节点在父容器的某个分支中
          // 找出当前节点沿出边可达的下游节点（同分支内）
          const downstreamIds = new Set<string>();
          const dfsStack = [id];
          while (dfsStack.length > 0) {
            const dfsId = dfsStack.pop()!;
            for (const e of edges) {
              if (e.source === dfsId && branchInfo.nodeIds.includes(e.target)) {
                if (!downstreamIds.has(e.target)) {
                  downstreamIds.add(e.target);
                  dfsStack.push(e.target);
                }
              }
            }
          }

          // 将同分支的兄弟节点中 非下游 的节点添加到队列
          for (const siblingId of branchInfo.nodeIds) {
            if (!visited.has(siblingId) && siblingId !== id && !downstreamIds.has(siblingId)) {
              visited.add(siblingId);
              queue.push(siblingId);
              const siblingNode = nodes.find((n) => n.id === siblingId);
              if (siblingNode) result.push(siblingNode);
            }
          }
        }
      }
    }
  }
  return result;
}

/**
 * 判断当前节点是否处于某个容器节点（ForEach/Parallel）的子任务作用域内。
 * 简化判定：上游链路中存在 ForEach 节点即视为在循环体内。
 */
export function findEnclosingLoopNode(
  ctx: VarSourceContext,
): WorkflowNode | undefined {
  const upstream = findUpstreamNodes(ctx);
  return upstream.find((n) => n.data?.type === 'idp_core_flow_ForEach');
}

/**
 * 获取开始节点的触发器配置（优先从开始节点 config，其次从 workflow 级 triggers）
 */
export function getStartNodeTriggers(ctx: VarSourceContext): any[] {
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
