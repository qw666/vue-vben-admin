import { ref } from 'vue';
import { message } from 'ant-design-vue';
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

export interface Connection {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

const NODE_WIDTH = 176;
const NODE_HEIGHT = 68;
const GROUP_PADDING = 24;
const GROUP_BOTTOM_MARGIN = 32;
const PORT_RADIUS = 8;

export interface GroupBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getChildNodeIds(nodeId: string): string[] {
  const store = useWorkflowStore();
  const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
  if (!node) return [];

  const flowControlConfig = getFlowControlConfig(node.data.type);
  if (!flowControlConfig) return [];

  const childIds: string[] = [];
  const taskFields = flowControlConfig.taskFields || [];

  taskFields.forEach(field => {
    if (field === 'next') return;
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

function getGroupBounds(nodeId: string): GroupBounds | null {
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

function getNodePorts(nodeId: string, nodeType: string): Port[] {
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

export function useCanvasInteraction(
  pluginGroupsCache: any, 
  pluginMetaCache: any, 
  loadPluginMeta: any, 
  onNodeDeleted?: (nodeId: string) => void,
  nodeConfigForm?: any,
  selectedNode?: { value: any },
  onNodeConnected?: (node: any) => void
) {
  const store = useWorkflowStore();

  const isDraggingNode = ref(false);
  const draggingNodeId = ref<string | null>(null);
  const dragOffset = ref({ x: 0, y: 0 });
  const panOffset = ref({ x: 0, y: 0 });
  const scale = ref(1);

  const isConnecting = ref(false);
  const connectingFrom = ref<string | null>(null);
  const connectingFromPortId = ref<string | null>(null);
  const tempLine = ref({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const connections = ref<Connection[]>([]);
  const selectedConnectionId = ref<string | null>(null);
  const selectedNodeId = ref<string | null>(null);
  
  type ContextMenuType = { show: boolean; x: number; y: number; type: 'node' | 'connection' | null; targetId: string | null };
  const contextMenu = ref<ContextMenuType>({ show: false, x: 0, y: 0, type: null, targetId: null });

  function onDragStart(e: DragEvent, nodeType: string) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/json', JSON.stringify({ nodeType }));
      e.dataTransfer.effectAllowed = 'move';
      loadPluginMeta(nodeType);
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    if (!store.currentWorkflow) {
      message.error('请先创建或选择一个流程');
      return;
    }
    const canvas = e.currentTarget as HTMLElement;
    const rect = canvas.getBoundingClientRect();
    const position = {
      x: (e.clientX - rect.left - 70 - panOffset.value.x) / scale.value,
      y: (e.clientY - rect.top - 30 - panOffset.value.y) / scale.value,
    };

    if (e.dataTransfer) {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const { nodeType } = JSON.parse(data);
        let template: any = null;

        const flowControlConfig = getFlowControlConfig(nodeType);
        if (flowControlConfig) {
          template = {
            nodeName: flowControlConfig.nodeName,
            type: nodeType,
            icon: flowControlConfig.icon,
            category: '流程控制',
            description: flowControlConfig.description,
          };
        } else {
          for (const tabKey of Object.keys(pluginGroupsCache.value)) {
            const groups = pluginGroupsCache.value[tabKey];
            for (const group of groups) {
              template = group.pluginList.find((p: any) => p.type === nodeType);
              if (template) {
                template.category = group.groupName;
                break;
              }
            }
            if (template) break;
          }
        }

        const meta = pluginMetaCache.value[nodeType];
        const nodeTypeParts = nodeType.split('_');
        const nodeTypeSuffix = nodeTypeParts[nodeTypeParts.length - 1] || 'node';
        
        const newNode = {
          id: `${nodeTypeSuffix}_${Date.now()}`,
          type: 'custom',
          position,
          data: {
            label: template?.nodeName || nodeType,
            type: template?.type || nodeType,
            icon: template?.icon || 'mdi:circle',
            description: template?.description || template?.category || '自定义节点',
            config: meta && meta.parsedSchema ? {} : {},
          },
        };
        store.addNode(newNode);
        message.success(`已添加 ${template?.nodeName || nodeType} 节点`);
      } else {
        message.error('拖拽数据为空');
      }
    } else {
      message.error('未找到拖拽数据');
    }
  }

  function startNodeDrag(e: MouseEvent, nodeId: string) {
    const target = e.target as HTMLElement;
    if (target.closest('.node-port')) {
      return;
    }

    e.preventDefault();
    isDraggingNode.value = true;
    draggingNodeId.value = nodeId;

    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (node) {
      dragOffset.value = {
        x: e.clientX - node.position.x * scale.value - panOffset.value.x,
        y: e.clientY - node.position.y * scale.value - panOffset.value.y
      };
    }

    function onMouseMove(event: MouseEvent) {
      if (!isDraggingNode.value || !draggingNodeId.value) return;

      const newX = Math.max(0, (event.clientX - dragOffset.value.x - panOffset.value.x) / scale.value);
      const newY = Math.max(0, (event.clientY - dragOffset.value.y - panOffset.value.y) / scale.value);

      store.updateNode(draggingNodeId.value, {
        position: { x: newX, y: newY }
      });
    }

    function onMouseUp() {
      isDraggingNode.value = false;
      draggingNodeId.value = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function startConnection(e: MouseEvent, nodeId: string, portId: string) {
    e.preventDefault();
    e.stopPropagation();
    
    isConnecting.value = true;
    connectingFrom.value = nodeId;
    connectingFromPortId.value = portId;

    const canvas = document.querySelector('.workflow-canvas');
    if (!canvas) {
      return;
    }
    
    const canvasRect = canvas.getBoundingClientRect();
    const portElement = e.target as HTMLElement;
    const portRect = portElement.getBoundingClientRect();
    
    tempLine.value = {
      x1: portRect.left - canvasRect.left + portRect.width / 2 - panOffset.value.x,
      y1: portRect.top - canvasRect.top + portRect.height / 2 - panOffset.value.y,
      x2: e.clientX - canvasRect.left - panOffset.value.x,
      y2: e.clientY - canvasRect.top - panOffset.value.y
    };

    function onMouseMove(event: MouseEvent) {
      if (!isConnecting.value) return;
      const rect = canvas!.getBoundingClientRect();
      tempLine.value.x2 = event.clientX - rect.left - panOffset.value.x;
      tempLine.value.y2 = event.clientY - rect.top - panOffset.value.y;
    }

    function onMouseUp(event: MouseEvent) {
      isConnecting.value = false;
      
      const targetElement = event.target as HTMLElement;
      const targetPort = targetElement.closest('.node-port') as HTMLElement | null;
      
      if (targetPort && connectingFrom.value && connectingFromPortId.value) {
        const targetNodeId = targetPort.dataset.nodeId;
        const targetPortId = targetPort.dataset.portId;
        const targetPortType = targetPort.dataset.portType;
        
        if (targetNodeId && targetPortId && targetNodeId !== connectingFrom.value && targetPortType === 'input') {
          const existingConnection = connections.value.find(
            c => c.target === targetNodeId && c.targetHandle === targetPortId
          );
          if (!existingConnection) {
            const newConnection: Connection = {
              id: `conn-${Date.now()}`,
              source: connectingFrom.value,
              sourceHandle: connectingFromPortId.value,
              target: targetNodeId,
              targetHandle: targetPortId
            };
            
            connections.value.push(newConnection);
            if (store.currentWorkflow) {
              store.currentWorkflow.edges = [...store.currentWorkflow.edges, newConnection];
            }

            syncConnectionToNodeConfig(newConnection, true);

            const sourceNode = store.currentWorkflow?.nodes.find(n => n.id === connectingFrom.value);
            if (sourceNode && onNodeConnected) {
              onNodeConnected(sourceNode);
            }
          }
        }
      }
      
      connectingFrom.value = null;
      connectingFromPortId.value = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function syncConnectionToNodeConfig(conn: Connection, isAdd: boolean) {
    const sourceNode = store.currentWorkflow?.nodes.find(n => n.id === conn.source);
    if (!sourceNode) return;

    const sourceNodeType = sourceNode.data.type;
    const flowControlConfig = getFlowControlConfig(sourceNodeType);
    if (!flowControlConfig) return;

    const sourceHandle = conn.sourceHandle.replace(`${conn.source}-output-`, '');

    let targetField = sourceHandle;
    let caseKey: string | undefined;
    let isAddPort = false;

    if (flowControlConfig.ports.output) {
      const dynamicOutput = flowControlConfig.ports.output.find(
        o => o.dynamic && sourceHandle.startsWith(o.field + '-')
      );
      if (dynamicOutput) {
        targetField = dynamicOutput.field;
        const remaining = sourceHandle.replace(dynamicOutput.field + '-', '');
        if (remaining === 'add') {
          isAddPort = true;
        } else {
          caseKey = remaining;
        }
      } else {
        const dynamicField = flowControlConfig.ports.output.find(
          o => o.dynamic && sourceHandle === o.field
        );
        if (dynamicField) {
          targetField = dynamicField.field;
          isAddPort = true;
        }
      }

      const isDynamicField = flowControlConfig.ports.output.some(
        o => o.dynamic && (sourceHandle.startsWith(o.field + '-') || sourceHandle === o.field)
      );
      if (isDynamicField) {
        isAddPort = true;
      }
    }

    if (!sourceNode.data.config) {
      sourceNode.data.config = {};
    }

    const targetNode = store.currentWorkflow?.nodes.find(n => n.id === conn.target);
    if (!targetNode) return;

    const taskItem = {
      type: targetNode.data.type,
      nodeId: targetNode.id,
      label: targetNode.data.label,
      ...targetNode.data.config,
    };

    if (isAddPort && isAdd) {
      const currentCases = sourceNode.data.config[targetField];
      const casesObj = typeof currentCases === 'object' && currentCases !== null && !Array.isArray(currentCases)
        ? { ...currentCases }
        : {};

      const caseCount = Object.keys(casesObj).length + 1;
      caseKey = `CASE_${caseCount}`;

      casesObj[caseKey] = [taskItem];
      sourceNode.data.config[targetField] = casesObj;

      conn.sourceHandle = `${conn.source}-output-${targetField}-add`;

      if (nodeConfigForm) {
        nodeConfigForm[targetField] = { ...casesObj };
      }
    } else if (caseKey) {
      const currentCases = sourceNode.data.config[targetField];
      const casesObj = typeof currentCases === 'object' && currentCases !== null && !Array.isArray(currentCases)
        ? { ...currentCases }
        : {};

      if (isAdd) {
        const caseItems = casesObj[caseKey];
        casesObj[caseKey] = Array.isArray(caseItems) ? [...caseItems] : [];
        const existing = casesObj[caseKey].find(
          (item: any) => item.nodeId === conn.target
        );
        if (!existing) {
          casesObj[caseKey].push(taskItem);
        }
      } else {
        const caseItems = casesObj[caseKey];
        if (Array.isArray(caseItems)) {
          casesObj[caseKey] = caseItems.filter(
            (item: any) => item.nodeId !== conn.target
          );
        }
      }

      sourceNode.data.config[targetField] = casesObj;

      if (nodeConfigForm) {
        nodeConfigForm[targetField] = { ...casesObj };
      }
    } else {
      if (isAddPort && !isAdd) {
        const currentCases = sourceNode.data.config[targetField];
        const casesObj = typeof currentCases === 'object' && currentCases !== null && !Array.isArray(currentCases)
          ? { ...currentCases }
          : {};

        const caseKeyToRemove = Object.keys(casesObj).find(key => 
          Array.isArray(casesObj[key]) && casesObj[key].some((item: any) => item.nodeId === conn.target)
        );

        if (caseKeyToRemove) {
          casesObj[caseKeyToRemove] = casesObj[caseKeyToRemove].filter(
            (item: any) => item.nodeId !== conn.target
          );

          if (casesObj[caseKeyToRemove].length === 0) {
            delete casesObj[caseKeyToRemove];
          }

          sourceNode.data.config[targetField] = casesObj;

          if (nodeConfigForm) {
            nodeConfigForm[targetField] = { ...casesObj };
          }
        }
      } else {
        if (!Array.isArray(sourceNode.data.config[targetField])) {
          sourceNode.data.config[targetField] = [];
        }

        if (isAdd) {
          const existing = sourceNode.data.config[targetField].find(
            (item: any) => item.nodeId === conn.target
          );
          if (!existing) {
            sourceNode.data.config[targetField].push(taskItem);
          }
        } else {
          sourceNode.data.config[targetField] = sourceNode.data.config[targetField].filter(
            (item: any) => item.nodeId !== conn.target
          );
        }

        if (nodeConfigForm) {
          nodeConfigForm[targetField] = [...sourceNode.data.config[targetField]];
        }
      }
    }

    store.updateNode(conn.source, { data: { ...sourceNode.data } });
  }

  function deleteConnection(connId: string) {
    const conn = connections.value.find(c => c.id === connId);
    if (conn) {
      syncConnectionToNodeConfig(conn, false);
    }
    connections.value = connections.value.filter(c => c.id !== connId);
    if (store.currentWorkflow) {
      store.currentWorkflow.edges = store.currentWorkflow.edges.filter(c => c.id !== connId);
    }
  }

  function selectConnection(connId: string) {
    selectedConnectionId.value = connId;
    selectedNodeId.value = null;
  }

  function selectNode(nodeId: string) {
    selectedNodeId.value = nodeId;
    selectedConnectionId.value = null;
  }

  function showConnectionContextMenu(e: MouseEvent, connId: string) {
    contextMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      type: 'connection',
      targetId: connId
    };
  }

  function showNodeContextMenu(e: MouseEvent, nodeId: string) {
    e.preventDefault();
    contextMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      type: 'node',
      targetId: nodeId
    };
  }

  function closeContextMenu() {
    contextMenu.value = { show: false, x: 0, y: 0, type: null, targetId: null };
  }

  function deleteSelectedConnection() {
    if (contextMenu.value.type === 'connection' && contextMenu.value.targetId) {
      deleteConnection(contextMenu.value.targetId as string);
    }
    closeContextMenu();
  }

  function deleteSelectedNode() {
    if (contextMenu.value.type === 'node' && contextMenu.value.targetId) {
      const nodeId = contextMenu.value.targetId as string;
      const relatedConns = connections.value.filter(c => c.source === nodeId || c.target === nodeId);
      relatedConns.forEach(c => syncConnectionToNodeConfig(c, false));
      store.removeNode(nodeId);
      connections.value = connections.value.filter(c => c.source !== nodeId && c.target !== nodeId);
      if (selectedNodeId.value === nodeId) {
        selectedNodeId.value = null;
      }
      onNodeDeleted?.(nodeId);
    }
    closeContextMenu();
  }

  function handleCanvasClick() {
    closeContextMenu();
  }

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toUpperCase();
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedConnectionId.value) {
        deleteConnection(selectedConnectionId.value);
        selectedConnectionId.value = null;
      } else if (selectedNodeId.value) {
        const nodeId = selectedNodeId.value;
        const relatedConns = connections.value.filter(c => c.source === nodeId || c.target === nodeId);
        relatedConns.forEach(c => syncConnectionToNodeConfig(c, false));
        store.removeNode(nodeId);
        connections.value = connections.value.filter(c => c.source !== nodeId && c.target !== nodeId);
        selectedNodeId.value = null;
        onNodeDeleted?.(nodeId);
      }
    }
  }

  function handleCanvasMouseLeave() {
    if (isConnecting.value) {
      isConnecting.value = false;
      connectingFrom.value = null;
    }
  }

  function getNodeCenter(nodeId: string): { x: number; y: number } {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (node) {
      return {
        x: node.position.x + NODE_WIDTH / 2,
        y: node.position.y + NODE_HEIGHT / 2
      };
    }
    return { x: 0, y: 0 };
  }

  function getPortPosition(nodeId: string, portId: string): { x: number; y: number } {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
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

  function getConnectionPath(sourceId: string, targetId: string, sourcePortId?: string, targetPortId?: string): string {
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

  function getConnectionColor(conn: Connection): string {
    const sourceNode = store.currentWorkflow?.nodes.find(n => n.id === conn.source);
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

  function updateSwitchCaseKey(nodeId: string, oldKey: string, newKey: string, fieldKey: string = 'cases') {
    if (!oldKey || !newKey || oldKey === newKey) return;
    const newKeyTrimmed = newKey.trim();
    if (!newKeyTrimmed) return;

    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node || !node.data.config?.[fieldKey]) return;

    if (node.data.config[fieldKey][oldKey]) {
      node.data.config[fieldKey] = {
        ...node.data.config[fieldKey],
        [newKeyTrimmed]: [...(node.data.config[fieldKey][oldKey] || [])]
      };
      delete node.data.config[fieldKey][oldKey];
      node.data.config[fieldKey] = { ...node.data.config[fieldKey] };
    }

    if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
      if (nodeConfigForm[fieldKey] && nodeConfigForm[fieldKey][oldKey]) {
        nodeConfigForm[fieldKey] = {
          ...nodeConfigForm[fieldKey],
          [newKeyTrimmed]: [...(nodeConfigForm[fieldKey][oldKey] || [])]
        };
        delete nodeConfigForm[fieldKey][oldKey];
        nodeConfigForm[fieldKey] = { ...nodeConfigForm[fieldKey] };
      }
    }

  }

  function removeSwitchCaseKey(nodeId: string, caseKey: string, fieldKey: string = 'cases') {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node || !node.data.config?.[fieldKey]) return;

    const caseItems = node.data.config[fieldKey][caseKey];
    const caseNodeIds = Array.isArray(caseItems) ? caseItems.map((item: any) => item.nodeId) : [];

    delete node.data.config[fieldKey][caseKey];
    node.data.config[fieldKey] = { ...node.data.config[fieldKey] };

    if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
      if (nodeConfigForm[fieldKey] && nodeConfigForm[fieldKey][caseKey]) {
        delete nodeConfigForm[fieldKey][caseKey];
        nodeConfigForm[fieldKey] = { ...nodeConfigForm[fieldKey] };
      }
    }

    store.currentWorkflow!.edges = (store.currentWorkflow?.edges || []).filter(
      conn => !(conn.source === nodeId && conn.sourceHandle === `${nodeId}-output-${fieldKey}-add` && caseNodeIds.includes(conn.target))
    );
  }

  function addSwitchCaseKey(nodeId: string, fieldKey: string = 'cases') {
    const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (!node.data.config) {
      node.data.config = {};
    }
    if (!node.data.config[fieldKey]) {
      node.data.config[fieldKey] = {};
    }

    let newKey = `CASE_${Date.now()}`;
    let counter = 1;
    while (node.data.config[fieldKey][newKey]) {
      newKey = `CASE_${Date.now()}_${counter++}`;
    }

    node.data.config[fieldKey] = {
      ...node.data.config[fieldKey],
      [newKey]: []
    };

    if (nodeConfigForm && selectedNode?.value?.id === nodeId) {
      nodeConfigForm[fieldKey] = {
        ...(nodeConfigForm[fieldKey] || {}),
        [newKey]: []
      };
    }
  }

  function getTempLinePath(): string {
    const { x1, y1, x2, y2 } = tempLine.value;
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  }

  function updatePanOffset(offset: { x: number; y: number }) {
    panOffset.value = offset;
  }

  function updateScale(value: number) {
    scale.value = value;
  }

  return {
    isDraggingNode,
    draggingNodeId,
    dragOffset,
    panOffset,
    scale,
    isConnecting,
    connectingFrom,
    connectingFromPortId,
    tempLine,
    connections,
    selectedConnectionId,
    selectedNodeId,
    contextMenu,
    onDragStart,
    onDragOver,
    onDrop,
    startNodeDrag,
    startConnection,
    deleteConnection,
    selectConnection,
    selectNode,
    showConnectionContextMenu,
    showNodeContextMenu,
    closeContextMenu,
    deleteSelectedConnection,
    deleteSelectedNode,
    handleCanvasClick,
    handleKeyDown,
    handleCanvasMouseLeave,
    getNodeCenter,
    getPortPosition,
    getConnectionPath,
    getGroupBounds,
    getConnectionColor,
    getTempLinePath,
    getNodePorts,
    syncConnectionToNodeConfig,
    updateSwitchCaseKey,
    removeSwitchCaseKey,
    addSwitchCaseKey,
    updatePanOffset,
    updateScale,
  };
}
