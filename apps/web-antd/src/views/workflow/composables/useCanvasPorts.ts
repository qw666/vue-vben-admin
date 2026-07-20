import { useWorkflowStore } from '#/store/workflow';
import { getFlowControlConfig } from '../config/workflow-node-config';

export interface Port {
  id: string;
  nodeId: string;
  type: 'input' | 'output';
  label?: string;
  position: { x: number; y: number };
  color?: string;
  portGroup?: string;
}

export interface GroupBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_WIDTH = 176;
const NODE_HEIGHT = 68;
const GROUP_PADDING = 24;
const GROUP_BOTTOM_MARGIN = 32;
const PORT_RADIUS = 8;

function getChildNodeIds(nodeId: string): string[] {
  const store = useWorkflowStore();
  const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
  if (!node) return [];

  const flowControlConfig = getFlowControlConfig(node.data.type);
  if (!flowControlConfig) return [];

  const childIds: string[] = [];
  const taskFields = flowControlConfig.taskFields || [];
  const excludeFields = ['next', 'errors', 'finally'];

  taskFields.forEach(field => {
    if (excludeFields.includes(field)) return;
    const configValue = node.data.config?.[field];
    if (Array.isArray(configValue)) {
      configValue.forEach((item: any) => {
        if (item.nodeId && !childIds.includes(item.nodeId)) {
          childIds.push(item.nodeId);
        }
      });
    } else if (typeof configValue === 'object' && configValue !== null) {
      (Object.values(configValue) as any[]).forEach((cases) => {
        if (Array.isArray(cases)) {
          cases.forEach((item: any) => {
            if (item.nodeId && !childIds.includes(item.nodeId)) {
              childIds.push(item.nodeId);
            }
          });
        }
      });
    }
  });

  return childIds;
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

export function getGroupBounds(nodeId: string): GroupBounds | null {
  const store = useWorkflowStore();
  const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
  if (!node) return null;

  const flowControlConfig = getFlowControlConfig(node.data.type);
  if (!flowControlConfig) return null;

  const descendantIds = getDescendantNodeIds(nodeId);
  const allNodes = [node, ...descendantIds.map(id => store.currentWorkflow?.nodes.find(n => n.id === id)).filter(Boolean)];

  let minX = node.position.x;
  let minY = node.position.y;
  let maxX = node.position.x + NODE_WIDTH;
  let maxY = node.position.y + NODE_HEIGHT;

  allNodes.forEach(n => {
    if (!n) return;
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

export function getNodePorts(nodeId: string, nodeType: string): Port[] {
  const node = useWorkflowStore().currentWorkflow?.nodes.find(n => n.id === nodeId);
  if (!node) return [];

  const ports: Port[] = [];

  const flowControlConfig = getFlowControlConfig(nodeType);
  const groupBounds = flowControlConfig ? getGroupBounds(nodeId) : null;

  if (!flowControlConfig || flowControlConfig.ports.input !== 0) {
    const inputX = groupBounds ? groupBounds.x + groupBounds.width / 2 : node.position.x + NODE_WIDTH / 2;
    const inputY = groupBounds ? groupBounds.y - PORT_RADIUS : node.position.y - PORT_RADIUS;
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
    const bottomOutputs: { field: string; label: string; color: string; portGroup: string }[] = [];
    const rightOutputs: { field: string; label: string; color: string; portGroup: string }[] = [];
    const nextOutput = flowControlConfig.ports.output.find(out => out.field === 'next');

    flowControlConfig.ports.output.forEach(out => {
      if (out.dynamic) {
        const cases = node.data.config?.[out.field];
        const caseCount = typeof cases === 'object' && cases !== null && !Array.isArray(cases) 
          ? Object.keys(cases).length 
          : 0;
        bottomOutputs.push({
          field: caseCount > 0 ? `${out.field}-add` : `${out.field}-add`,
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
          y: node.position.y + NODE_HEIGHT + PORT_RADIUS
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
            y: node.position.y + NODE_HEIGHT + PORT_RADIUS
          },
          color: out.color
        });
      });
    }

    if (nextOutput) {
      const nextY = groupBounds ? groupBounds.y + groupBounds.height - PORT_RADIUS : node.position.y + NODE_HEIGHT + PORT_RADIUS;
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
      const rightX = groupBounds ? groupBounds.x + groupBounds.width + PORT_RADIUS : node.position.x + NODE_WIDTH + PORT_RADIUS;
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
  const node = useWorkflowStore().currentWorkflow?.nodes.find(n => n.id === nodeId);
  if (!node) return { x: 0, y: 0 };

  const flowControlConfig = getFlowControlConfig(node.data.type);
  const groupBounds = flowControlConfig ? getGroupBounds(nodeId) : null;

  if (portId === `${nodeId}-input`) {
    const inputX = groupBounds ? groupBounds.x + groupBounds.width / 2 : node.position.x + NODE_WIDTH / 2;
    const inputY = groupBounds ? groupBounds.y - PORT_RADIUS : node.position.y - PORT_RADIUS;
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

    const bottomOutputs: { field: string; label: string }[] = [];
    const rightOutputs: { field: string; label: string }[] = [];

    flowControlConfig.ports.output.forEach(out => {
      if (out.dynamic) {
        const cases = node.data.config?.[out.field];
        const caseCount = typeof cases === 'object' && cases !== null && !Array.isArray(cases) 
          ? Object.keys(cases).length 
          : 0;
        bottomOutputs.push({ 
          field: `${out.field}-add`, 
          label: caseCount > 0 ? `${out.label}(${caseCount})` : '+' 
        });
      } else {
        if (out.field === 'errors' || out.field === 'finally') {
          rightOutputs.push({ field: out.field, label: out.label });
        } else if (out.field !== 'next') {
          bottomOutputs.push({ field: out.field, label: out.label });
        }
      }
    });

    if (field === 'next') {
      const nextY = groupBounds ? groupBounds.y + groupBounds.height + 6 : node.position.y + NODE_HEIGHT + 6;
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
          y: node.position.y + NODE_HEIGHT + PORT_RADIUS
        };
      }
      const spacing = NODE_WIDTH / (bottomOutputs.length + 1);
      return {
        x: node.position.x + spacing * (bottomIndex + 1),
        y: node.position.y + NODE_HEIGHT + PORT_RADIUS
      };
    }

    const rightIndex = rightOutputs.findIndex(o => o.field === field);
    if (rightIndex >= 0) {
      const containerHeight = groupBounds ? groupBounds.height : NODE_HEIGHT;
      const containerY = groupBounds ? groupBounds.y : node.position.y;
      const rightX = groupBounds ? groupBounds.x + groupBounds.width + PORT_RADIUS : node.position.x + NODE_WIDTH + PORT_RADIUS;
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