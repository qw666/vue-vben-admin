import { useWorkflowStore } from '#/store/workflow';
import { getFlowControlConfig } from '../../config/workflow-node-config';

/**
 * 计算圆角折线路径（Smoothstep/Rounded Orthogonal）
 *
 * 端口布局：
 * - 输入端口：节点顶部中央（y = nodeY - margin）
 * - 输出端口：节点底部中央（y = nodeY + height + margin）
 * - 错误端口：节点右侧
 *
 * 路径规则：
 * 1. 从源端口出发（向下或向右）
 * 2. 垂直/水平路由到目标端口上方
 * 3. 最后一段必须垂直向下进入目标端口（箭头朝下）
 * 4. 每个拐点用 radius 半径的圆角
 */
export function calculateBezierPath(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
): string {
  const startX = sourcePos.x;
  const startY = sourcePos.y;
  const endX = targetPos.x;
  const endY = targetPos.y;

  const offset = 30; // 路由拐点距离端口的偏移
  const radius = 8;  // 圆角半径
  const minSegment = radius * 2;

  const points: { x: number; y: number }[] = [];
  points.push({ x: startX, y: startY });

  // 源在目标上方（主流程：bottom output → top input）
  if (startY < endY) {
    const dy = endY - startY;

    if (Math.abs(startX - endX) < 5) {
      // X 坐标基本对齐，直接垂直连接
      points.push({ x: endX, y: endY });
    } else if (dy > offset * 3) {
      // 充足的垂直空间，标准路由：下→横→下
      const midY = startY + offset;

      points.push({ x: startX, y: midY });
      points.push({ x: endX, y: midY });
      // 最后一段从 midY 到 endY，垂直向下（箭头朝下 ✓）
      points.push({ x: endX, y: endY });
    } else {
      // 垂直空间不足，压缩路由
      const midY = startY + dy / 2;

      points.push({ x: startX, y: midY });
      points.push({ x: endX, y: midY });
      points.push({ x: endX, y: endY });
    }
  } else {
    // 源与目标水平对齐或源在目标下方（错误/异常流程：right output → top input）
    // 从右侧端口出发，先向下再横向
    const midY = Math.max(startY + offset, endY - offset);

    points.push({ x: startX, y: midY });
    points.push({ x: endX, y: midY });
    // 最后一段垂直向下进入目标（箭头朝下 ✓）
    points.push({ x: endX, y: endY });
  }

  return buildRoundedPath(points, radius, minSegment);
}

/**
 * 根据拐点列表生成带圆角的 SVG 路径字符串
 */
function buildRoundedPath(
  points: { x: number; y: number }[],
  radius: number,
  minSegment: number,
): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  let path = `M ${points[0]!.x} ${points[0]!.y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;

    // 计算前一段和后一段的方向向量
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // 计算前一段和后一段的长度
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    // 确定实际可用的圆角半径
    const r = Math.min(radius, len1 / 2, len2 / 2);

    // 如果前一段太短，直接连接到拐点
    if (len1 < minSegment || len2 < minSegment) {
      path += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    // 圆角起点（在前一段上，距离拐点 r 处）
    const startX = curr.x - (dx1 / len1) * r;
    const startY = curr.y - (dy1 / len1) * r;

    // 圆角终点（在后一段上，距离拐点 r 处）
    const endX = curr.x + (dx2 / len2) * r;
    const endY = curr.y + (dy2 / len2) * r;

    // 绘制到圆角起点的直线
    path += ` L ${startX} ${startY}`;

    // 用二次贝塞尔曲线绘制圆角（控制点为拐点本身）
    path += ` Q ${curr.x} ${curr.y} ${endX} ${endY}`;
  }

  // 添加最后一段直线到终点
  const last = points[points.length - 1]!;
  path += ` L ${last.x} ${last.y}`;

  return path;
}

/**
 * 获取连线颜色
 * 根据源节点的输出端口配置确定连线颜色
 */
export function getConnectionColor(conn: { source: string; sourceHandle: string }): string {
  const sourceNode = useWorkflowStore().currentWorkflow?.nodes.find((n) => n.id === conn.source);
  if (sourceNode) {
    const flowControlConfig = getFlowControlConfig(sourceNode.data.type);
    if (flowControlConfig && flowControlConfig.ports.output && conn.sourceHandle) {
      const field = conn.sourceHandle.replace(`${conn.source}-output-`, '');
      let output = flowControlConfig.ports.output.find((o) => o.field === field);
      if (!output) {
        output = flowControlConfig.ports.output.find(
          (o) => o.dynamic && field.startsWith(o.field + '-'),
        );
      }
      if (output) return output.color;
    }
  }
  return '#64748b';
}
