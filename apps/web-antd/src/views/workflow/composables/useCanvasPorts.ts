import { useWorkflowStore } from '#/store/workflow';
import type { WorkflowNode } from '#/types/workflow';
import { getFlowControlConfig, flowControlNodeRegistry } from '../config/workflow-node-config';
import { UI_CONFIG } from '../config/ui-config';
import type { NodePort, GroupBounds } from '../types/workflow';
import { useFlowControlNode } from './useFlowControlNode';

const NODE_WIDTH = UI_CONFIG.node.width;
const NODE_HEIGHT = UI_CONFIG.node.height;
const GROUP_PADDING = UI_CONFIG.group.padding;
const GROUP_BOTTOM_MARGIN = UI_CONFIG.group.bottomMargin;
const PORT_RADIUS = UI_CONFIG.port.radius;
const PORT_MARGIN = UI_CONFIG.port.margin;

function getChildNodeIds(nodeId: string): string[] {
  const { getChildNodeIds: getFlowControlChildIds } = useFlowControlNode();
  return getFlowControlChildIds(nodeId);
}

interface OutputPortInfo {
  field: string;
  label: string;
  color: string;
  portGroup: string;
}

function getOutputPortInfo(node: any, flowControlConfig: any): {
  bottomOutputs: OutputPortInfo[];
  rightOutputs: OutputPortInfo[];
  nextOutput: any;
} {
  const bottomOutputs: OutputPortInfo[] = [];
  const rightOutputs: OutputPortInfo[] = [];
  const nextOutput = flowControlConfig.ports.output.find((out: any) => out.field === 'next');

  flowControlConfig.ports.output.forEach((out: any) => {
    if (out.dynamic) {
      const cases = node.data.config?.[out.field];
      const caseCount = typeof cases === 'object' && cases !== null && !Array.isArray(cases)
        ? Object.keys(cases).length
        : 0;
      bottomOutputs.push({
        field: `${out.field}-add`,
        label: caseCount > 0 ? `${out.label}(${caseCount})` : '+',
        color: out.color,
        portGroup: out.field,
      });
    } else {
      if (out.field === 'errors' || out.field === 'finally') {
        rightOutputs.push({
          field: out.field,
          label: out.label,
          color: out.field === 'errors' ? '#ef4444' : '#22c55e',
          portGroup: out.field,
        });
      } else if (out.field !== 'next') {
        bottomOutputs.push({
          field: out.field,
          label: out.label,
          color: out.color,
          portGroup: out.field,
        });
      }
    }
  });

  return { bottomOutputs, rightOutputs, nextOutput };
}

function getDescendantNodeIds(nodeId: string, visited: Set<string> = new Set()): string[] {
  visited.add(nodeId);
  const childIds = getChildNodeIds(nodeId);
  const allDescendants: string[] = [...childIds];

  childIds.forEach(childId => {
    if (!visited.has(childId)) {
      const descendants = getDescendantNodeIds(childId, visited);
      allDescendants.push(...descendants);
    }
  });

  return allDescendants;
}

export function getGroupBounds(nodeId: string, visited: Set<string> = new Set()): GroupBounds | null {
  const store = useWorkflowStore();
  const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId) as WorkflowNode | undefined;
  if (!node) return null;

  const flowControlConfig = getFlowControlConfig(node.data.type);
  if (!flowControlConfig.taskFields || flowControlConfig.taskFields.length === 0) return null;

  if (visited.has(nodeId)) return null;
  visited.add(nodeId);

  const descendantIds = getDescendantNodeIds(nodeId);
  const allNodes = [node, ...descendantIds.map(id => store.currentWorkflow?.nodes.find(n => n.id === id)).filter(Boolean)];

  let minX = node.position.x;
  let minY = node.position.y;
  let maxX = node.position.x + NODE_WIDTH;
  let maxY = node.position.y + NODE_HEIGHT;

  allNodes.forEach(n => {
    if (!n) return;
    
    const childFlowControlConfig = getFlowControlConfig(n.data.type);
    if (childFlowControlConfig.taskFields && childFlowControlConfig.taskFields.length > 0) {
      const childGroupBounds = getGroupBounds(n.id, visited);
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

export function getNodePorts(nodeId: string, nodeType: string): NodePort[] {
  const node = useWorkflowStore().currentWorkflow?.nodes.find(n => n.id === nodeId) as WorkflowNode | undefined;
  if (!node) return [];

  const ports: NodePort[] = [];

  const flowControlConfig = getFlowControlConfig(nodeType);
  const groupBounds = flowControlNodeRegistry.isFlowControlContainer(nodeType) ? getGroupBounds(nodeId) : null;

  if (!flowControlNodeRegistry.isFlowControlContainer(nodeType) || flowControlConfig.ports.input !== 0) {
    const inputX = groupBounds ? groupBounds.x + groupBounds.width / 2 : node.position.x + NODE_WIDTH / 2;
    const inputY = groupBounds ? groupBounds.y - PORT_MARGIN : node.position.y - PORT_MARGIN;
    ports.push({
      id: `${nodeId}-input`,
      nodeId,
      type: 'input',
      label: '输入',
      position: {
        x: inputX,
        y: inputY
      },
      color: '#64748b'
    });
  }

  if (flowControlConfig && flowControlConfig.ports.output) {
    const { bottomOutputs, rightOutputs, nextOutput } = getOutputPortInfo(node, flowControlConfig);

    if (bottomOutputs.length === 1) {
      const out = bottomOutputs[0]!;
      ports.push({
        id: `${nodeId}-output-${out.field}`,
        nodeId,
        type: 'output',
        label: out.label,
        portGroup: out.portGroup,
        position: {
          x: node.position.x + NODE_WIDTH / 2,
          y: node.position.y + NODE_HEIGHT + PORT_MARGIN
        },
        color: out.color
      });
    } else if (bottomOutputs.length > 1) {
      const spacing = NODE_WIDTH / (bottomOutputs.length + 1);
      bottomOutputs.forEach((out, i) => {
        ports.push({
          id: `${nodeId}-output-${out.field}`,
          nodeId,
          type: 'output',
          label: out.label,
          portGroup: out.portGroup,
          position: {
            x: node.position.x + spacing * (i + 1),
            y: node.position.y + NODE_HEIGHT + PORT_MARGIN
          },
          color: out.color
        });
      });
    }

    if (nextOutput) {
      const nextY = groupBounds ? groupBounds.y + groupBounds.height + PORT_MARGIN : node.position.y + NODE_HEIGHT + PORT_MARGIN;
      const nextX = groupBounds ? groupBounds.x + groupBounds.width / 2 : node.position.x + NODE_WIDTH / 2;
      ports.push({
        id: `${nodeId}-output-${nextOutput.field}`,
        nodeId,
        type: 'output',
        label: nextOutput.label,
        portGroup: nextOutput.field,
        position: {
          x: nextX,
          y: nextY
        },
        color: nextOutput.color
      });
    }

    if (rightOutputs.length > 0) {
      const containerHeight = groupBounds ? groupBounds.height : NODE_HEIGHT;
      const containerY = groupBounds ? groupBounds.y : node.position.y;
      const spacing = containerHeight / (rightOutputs.length + 1);
      const rightX = groupBounds ? groupBounds.x + groupBounds.width + PORT_MARGIN : node.position.x + NODE_WIDTH + PORT_MARGIN;
      rightOutputs.forEach((out, i) => {
        ports.push({
          id: `${nodeId}-output-${out.field}`,
          nodeId,
          type: 'output',
          label: out.label,
          portGroup: out.portGroup,
          position: {
            x: rightX,
            y: containerY + spacing * (i + 1)
          },
          color: out.color
        });
      });
    }
  } else {
    ports.push({
      id: `${nodeId}-output`,
      nodeId,
      type: 'output',
      label: '输出',
      position: {
        x: node.position.x + NODE_WIDTH / 2,
        y: node.position.y + NODE_HEIGHT + 6
      },
      color: '#3b82f6'
    });
  }

  return ports;
}

export function getPortPosition(nodeId: string, portId: string): { x: number; y: number } {
  const node = useWorkflowStore().currentWorkflow?.nodes.find(n => n.id === nodeId) as WorkflowNode | undefined;
  if (!node) return { x: 0, y: 0 };

  const flowControlConfig = getFlowControlConfig(node.data.type);
  const groupBounds = flowControlConfig ? getGroupBounds(nodeId) : null;

  if (portId === `${nodeId}-input`) {
    const inputX = groupBounds ? groupBounds.x + groupBounds.width / 2 : node.position.x + NODE_WIDTH / 2;
    const inputY = groupBounds ? groupBounds.y - PORT_MARGIN : node.position.y - PORT_MARGIN;
    return {
      x: inputX,
      y: inputY
    };
  }

  if (portId === `${nodeId}-output`) {
    return {
      x: node.position.x + NODE_WIDTH / 2,
      y: node.position.y + NODE_HEIGHT + PORT_RADIUS
    };
  }

  if (flowControlConfig && flowControlConfig.ports.output && portId.startsWith(`${nodeId}-output-`)) {
    const field = portId.replace(`${nodeId}-output-`, '');
    const { bottomOutputs, rightOutputs } = getOutputPortInfo(node, flowControlConfig);

    if (field === 'next') {
      const nextY = groupBounds ? groupBounds.y + groupBounds.height + PORT_MARGIN : node.position.y + NODE_HEIGHT + PORT_MARGIN;
      const nextX = groupBounds ? groupBounds.x + groupBounds.width / 2 : node.position.x + NODE_WIDTH / 2;
      return {
        x: nextX,
        y: nextY
      };
    }

    let bottomIndex = bottomOutputs.findIndex(o => o.field === field);
    if (bottomIndex < 0) {
      const dynamicField = flowControlConfig.ports.output.find(o => o.dynamic && field.startsWith(o.field + '-'));
      if (dynamicField) {
        bottomIndex = bottomOutputs.findIndex(o => o.field === `${dynamicField.field}-add`);
      }
    }
    if (bottomIndex >= 0) {
      if (bottomOutputs.length === 1) {
        return {
          x: node.position.x + NODE_WIDTH / 2,
          y: node.position.y + NODE_HEIGHT + PORT_MARGIN
        };
      }
      const spacing = NODE_WIDTH / (bottomOutputs.length + 1);
      return {
        x: node.position.x + spacing * (bottomIndex + 1),
        y: node.position.y + NODE_HEIGHT + PORT_MARGIN
      };
    }

    const rightIndex = rightOutputs.findIndex(o => o.field === field);
    if (rightIndex >= 0) {
      const containerHeight = groupBounds ? groupBounds.height : NODE_HEIGHT;
      const containerY = groupBounds ? groupBounds.y : node.position.y;
      const rightX = groupBounds ? groupBounds.x + groupBounds.width + PORT_MARGIN : node.position.x + NODE_WIDTH + PORT_MARGIN;
      const spacing = containerHeight / (rightOutputs.length + 1);
      return {
        x: rightX,
        y: containerY + spacing * (rightIndex + 1)
      };
    }
  }

  return {
    x: node.position.x + NODE_WIDTH / 2,
    y: node.position.y + NODE_HEIGHT + PORT_RADIUS
  };
}

export function getConnectionPath(sourceId: string, targetId: string, sourcePortId?: string, targetPortId?: string): string {
  let sourcePort;
  let targetPort;

  if (sourcePortId && targetPortId) {
    sourcePort = getPortPosition(sourceId, sourcePortId);
    targetPort = getPortPosition(targetId, targetPortId);
  } else {
    sourcePort = getPortPosition(sourceId, `${sourceId}-output`);
    targetPort = getPortPosition(targetId, `${targetId}-input`);
  }
  
  const startX = sourcePort.x;
  const startY = sourcePort.y;
  const endX = targetPort.x;
  const endY = targetPort.y;
  
  const midY = (startY + endY) / 2;
  
  return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
}

export function getConnectionColor(conn: { source: string; sourceHandle: string }): string {
  const sourceNode = useWorkflowStore().currentWorkflow?.nodes.find(n => n.id === conn.source);
  if (sourceNode) {
    const flowControlConfig = getFlowControlConfig(sourceNode.data.type);
    if (flowControlConfig && flowControlConfig.ports.output && conn.sourceHandle) {
      const field = conn.sourceHandle.replace(`${conn.source}-output-`, '');
      let output = flowControlConfig.ports.output.find(o => o.field === field);
      if (!output) {
        output = flowControlConfig.ports.output.find(o => o.dynamic && field.startsWith(o.field + '-'));
      }
      if (output) return output.color;
    }
  }
  return '#64748b';
}
