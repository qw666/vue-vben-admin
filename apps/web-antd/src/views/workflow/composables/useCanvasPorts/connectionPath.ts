import { useWorkflowStore } from '#/store/workflow';
import { getFlowControlConfig } from '../../config/workflow-node-config';

/**
 * 计算贝塞尔曲线路径
 */
export function calculateBezierPath(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
): string {
  const startX = sourcePos.x;
  const startY = sourcePos.y;
  const endX = targetPos.x;
  const endY = targetPos.y;
  const midY = (startY + endY) / 2;

  return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
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
