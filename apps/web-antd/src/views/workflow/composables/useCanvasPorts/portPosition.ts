import type { GroupBounds } from '../../types/workflow';
import { UI_CONFIG } from '../../config/ui-config';

const NODE_WIDTH = UI_CONFIG.node.width;
const NODE_HEIGHT = UI_CONFIG.node.height;
const PORT_MARGIN = UI_CONFIG.port.margin;
const PORT_RADIUS = UI_CONFIG.port.radius;

export interface PositionInput {
  nodePosition: { x: number; y: number };
  groupBounds?: GroupBounds | null;
  portIndex?: number;
  portTotal?: number;
}

/**
 * 计算输入端口位置（纯函数，易测试）
 */
export function calculateInputPosition(input: PositionInput): { x: number; y: number } {
  const { nodePosition, groupBounds } = input;

  if (groupBounds) {
    return {
      x: groupBounds.x + groupBounds.width / 2,
      y: groupBounds.y - PORT_MARGIN,
    };
  }

  return {
    x: nodePosition.x + NODE_WIDTH / 2,
    y: nodePosition.y - PORT_MARGIN,
  };
}

/**
 * 计算底部输出端口位置（单个或多个）
 */
export function calculateBottomOutputPosition(input: PositionInput): { x: number; y: number } {
  const { nodePosition, portIndex = 0, portTotal = 1 } = input;

  if (portTotal === 1) {
    return {
      x: nodePosition.x + NODE_WIDTH / 2,
      y: nodePosition.y + NODE_HEIGHT + PORT_MARGIN,
    };
  }

  const spacing = NODE_WIDTH / (portTotal + 1);
  return {
    x: nodePosition.x + spacing * (portIndex + 1),
    y: nodePosition.y + NODE_HEIGHT + PORT_MARGIN,
  };
}

/**
 * 计算 next 输出端口位置
 */
export function calculateNextOutputPosition(input: PositionInput): { x: number; y: number } {
  const { nodePosition, groupBounds } = input;

  if (groupBounds) {
    return {
      x: groupBounds.x + groupBounds.width / 2,
      y: groupBounds.y + groupBounds.height + PORT_MARGIN,
    };
  }

  return {
    x: nodePosition.x + NODE_WIDTH / 2,
    y: nodePosition.y + NODE_HEIGHT + PORT_MARGIN,
  };
}

/**
 * 计算右侧输出端口位置（errors/finally）
 */
export function calculateRightOutputPosition(input: PositionInput): { x: number; y: number } {
  const { nodePosition, groupBounds, portIndex = 0, portTotal = 1 } = input;

  const containerHeight = groupBounds ? groupBounds.height : NODE_HEIGHT;
  const containerY = groupBounds ? groupBounds.y : nodePosition.y;
  const spacing = containerHeight / (portTotal + 1);
  const rightX = groupBounds
    ? groupBounds.x + groupBounds.width + PORT_MARGIN
    : nodePosition.x + NODE_WIDTH + PORT_MARGIN;

  return {
    x: rightX,
    y: containerY + spacing * (portIndex + 1),
  };
}

/**
 * 计算默认输出端口位置（无配置时的降级方案）
 */
export function calculateDefaultOutputPosition(nodePosition: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return {
    x: nodePosition.x + NODE_WIDTH / 2,
    y: nodePosition.y + NODE_HEIGHT + PORT_RADIUS,
  };
}
