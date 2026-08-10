import { useWorkflowStore } from '#/store/workflow';
import type { WorkflowNode } from '#/types/workflow';
import type { GroupBounds } from '../../types/workflow';
import { getFlowControlConfig } from '../../config/workflow-node-config';
import { UI_CONFIG } from '../../config/ui-config';
import { useFlowControlNode } from '../useFlowControlNode';

const NODE_WIDTH = UI_CONFIG.node.width;
const NODE_HEIGHT = UI_CONFIG.node.height;
const GROUP_PADDING = UI_CONFIG.group.padding;
const GROUP_BOTTOM_MARGIN = UI_CONFIG.group.bottomMargin;

function getChildNodeIds(nodeId: string): string[] {
  const { getChildNodeIds: getFlowControlChildIds } = useFlowControlNode();
  return getFlowControlChildIds(nodeId);
}

function getDescendantNodeIds(nodeId: string, visited: Set<string> = new Set()): string[] {
  visited.add(nodeId);
  const childIds = getChildNodeIds(nodeId);
  const allDescendants: string[] = [...childIds];

  childIds.forEach((childId) => {
    if (!visited.has(childId)) {
      const descendants = getDescendantNodeIds(childId, visited);
      allDescendants.push(...descendants);
    }
  });

  return allDescendants;
}

/**
 * 计算容器节点的分组边界
 * 递归遍历所有子节点，计算最小包围框
 */
export function calculateGroupBounds(nodeId: string, visited: Set<string> = new Set()): GroupBounds | null {
  const store = useWorkflowStore();
  const node = store.currentWorkflow?.nodes.find((n) => n.id === nodeId) as WorkflowNode | undefined;
  if (!node) return null;

  const flowControlConfig = getFlowControlConfig(node.data.type);
  if (!flowControlConfig.taskFields || flowControlConfig.taskFields.length === 0) return null;

  if (visited.has(nodeId)) return null;
  visited.add(nodeId);

  const descendantIds = getDescendantNodeIds(nodeId);
  const allNodes = [
    node,
    ...descendantIds
      .map((id) => store.currentWorkflow?.nodes.find((n) => n.id === id))
      .filter(Boolean),
  ];

  let minX = node.position.x;
  let minY = node.position.y;
  let maxX = node.position.x + NODE_WIDTH;
  let maxY = node.position.y + NODE_HEIGHT;

  allNodes.forEach((n) => {
    if (!n) return;

    const childFlowControlConfig = getFlowControlConfig(n.data.type);
    if (childFlowControlConfig.taskFields && childFlowControlConfig.taskFields.length > 0) {
      const childGroupBounds = calculateGroupBounds(n.id, visited);
      if (childGroupBounds) {
        minX = Math.min(minX, childGroupBounds.x);
        minY = Math.min(minY, childGroupBounds.y);
        maxX = Math.max(maxX, childGroupBounds.x + childGroupBounds.width);
        maxY = Math.max(maxY, childGroupBounds.y + childGroupBounds.height);
        return;
      }
    }

    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
    maxY = Math.max(maxY, n.position.y + NODE_HEIGHT);
  });

  return {
    x: minX - GROUP_PADDING,
    y: minY - GROUP_PADDING,
    width: maxX - minX + GROUP_PADDING * 2,
    height: maxY - minY + GROUP_PADDING * 2 + GROUP_BOTTOM_MARGIN,
  };
}
