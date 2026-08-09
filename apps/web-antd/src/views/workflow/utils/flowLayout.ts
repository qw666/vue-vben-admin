import type { FlowTask } from '#/api/core/workflow';
import type { WorkflowNode } from '#/types/workflow';

import { getFlowControlConfig } from '../config/workflow-node-config';
import { forEachTaskField } from '../nodes/taskFieldUtils';

/**
 * 获取节点默认输出端口的 field 名称
 * 容器节点(If/Switch/ForEach/Parallel)的默认端口是 next，普通节点是 output
 */
export function getDefaultOutputPortField(nodeType: string): string {
  const config = getFlowControlConfig(nodeType);
  const outputPorts: any[] = config?.ports?.output || [];
  if (outputPorts.length > 0) {
    const nextPort = outputPorts.find(p => p.field === 'next');
    if (nextPort) return 'next';
    return outputPorts[0].field;
  }
  return 'output';
}

interface NodePosition {
  x: number;
  y: number;
}

function calculateLayout(tasks: FlowTask[], nodesMap: Map<string, NodePosition>): { height: number; width: number } {
  const NODE_WIDTH = 144;
  const NODE_HEIGHT = 48;
  const VERTICAL_SPACING = 40;
  const BRANCH_SPACING = 150;

  let currentX = 0;
  let currentY = 0;
  let maxWidth = NODE_WIDTH;
  let maxHeight = NODE_HEIGHT;

  const processed = new Set<string>();

  function processTask(task: FlowTask, x: number, y: number): { height: number; width: number } {
    if (!task || processed.has(task.id)) return { height: 0, width: 0 };

    processed.add(task.id);
    nodesMap.set(task.id, { x, y });

    let nodeWidth = NODE_WIDTH;
    let nodeHeight = NODE_HEIGHT;

    const flowControlConfig = getFlowControlConfig(task.type);
    if (flowControlConfig.taskFields) {
      const childY = y + NODE_HEIGHT + VERTICAL_SPACING;
      const branchItems: FlowTask[][] = [];

      for (const field of flowControlConfig.taskFields) {
        const fieldValue = task[field];
        forEachTaskField(fieldValue, (item) => {
          if (item.id && item.type) {
            branchItems.push([item]);
          }
        });
      }

      const numBranches = branchItems.length;
      if (numBranches > 0) {
        const totalBranchWidth = numBranches * NODE_WIDTH + (numBranches - 1) * BRANCH_SPACING;
        const startBranchX = x + NODE_WIDTH / 2 - totalBranchWidth / 2;

        let branchMaxHeight = 0;
        for (let i = 0; i < numBranches; i++) {
          const childTasks = branchItems[i];
          if (!childTasks) continue;

          const branchX = startBranchX + i * (NODE_WIDTH + BRANCH_SPACING);
          for (const childTask of childTasks) {
            const result = processTask(childTask, branchX, childY);
            branchMaxHeight = Math.max(branchMaxHeight, result.height);
          }
        }

        nodeWidth = Math.max(nodeWidth, startBranchX + totalBranchWidth - x);
        nodeHeight = NODE_HEIGHT + VERTICAL_SPACING + branchMaxHeight;
      }
    }

    return { height: nodeHeight, width: nodeWidth };
  }

  for (const task of tasks) {
    if (!task || processed.has(task.id)) continue;

    const result = processTask(task, currentX, currentY);
    maxWidth = Math.max(maxWidth, currentX + result.width);
    maxHeight = Math.max(maxHeight, currentY + result.height);

    currentY += result.height + VERTICAL_SPACING;
  }

  return { height: maxHeight, width: maxWidth };
}

export function generateFlowLayout(nodes: WorkflowNode[]): string {
  const layoutNodes: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    let key = node.id;
    if (node.data.type === 'idp_core_flow_Start') {
      key = 'start';
    } else if (node.data.type === 'idp_core_flow_End') {
      key = 'end';
    }
    layoutNodes[key] = { x: node.position.x, y: node.position.y };
  }
  return JSON.stringify({ nodes: layoutNodes });
}

export function computeLayout(
  tasks: FlowTask[],
  allTasks: FlowTask[],
  flowLayout?: string,
): { nodesMap: Map<string, NodePosition>; layoutWidth: number; layoutHeight: number } {
  const nodesMap = new Map<string, NodePosition>();
  let layoutWidth = 0;
  let layoutHeight = 0;

  if (flowLayout) {
    try {
      const parsedLayout = JSON.parse(flowLayout);
      if (parsedLayout && parsedLayout.nodes) {
        const layoutNodes = parsedLayout.nodes as Record<string, { x: number; y: number }>;
        let maxX = 0;
        let maxY = 0;
        for (const task of allTasks) {
          const pos = layoutNodes[task.id];
          if (pos) {
            nodesMap.set(task.id, pos);
            maxX = Math.max(maxX, pos.x + 176);
            maxY = Math.max(maxY, pos.y + 68);
          }
        }
        if (layoutNodes['start']) {
          maxX = Math.max(maxX, layoutNodes['start'].x + 176);
          maxY = Math.max(maxY, layoutNodes['start'].y + 68);
        }
        if (layoutNodes['end']) {
          maxX = Math.max(maxX, layoutNodes['end'].x + 176);
          maxY = Math.max(maxY, layoutNodes['end'].y + 68);
        }
        if (nodesMap.size > 0) {
          layoutWidth = maxX;
          layoutHeight = maxY;
        }
      }
    } catch {
    }
  }

  if (nodesMap.size === 0) {
    const { width, height } = calculateLayout(tasks, nodesMap);
    layoutWidth = width;
    layoutHeight = height;
  }

  return { nodesMap, layoutWidth, layoutHeight };
}

export function centerNodesInCanvas(
  nodes: WorkflowNode[],
  layoutWidth: number,
  layoutHeight: number,
): WorkflowNode[] {
  if (nodes.length === 0) return nodes;

  const CANVAS_WIDTH = 4000;
  const CANVAS_HEIGHT = 4000;
  const offsetX = (CANVAS_WIDTH - layoutWidth) / 2;
  const offsetY = (CANVAS_HEIGHT - layoutHeight) / 2;
  return nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }));
}
