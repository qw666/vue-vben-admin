import { ref } from 'vue';
import { useWorkflowStore } from '#/store/workflow';
import type { WorkflowNode } from '#/types/workflow';
import { getFlowControlConfig } from '../config/workflow-node-config';
import type { Connection, NodeConfigForm, NodeConnectedCallback, TaskItem } from '../types/workflow';
import { getElementCanvasPosition, getMouseCanvasPosition } from '../utils/coordinateUtils';
import { useEventCleanup } from './useEventCleanup';

function parseSourceHandle(sourceHandle: string, flowControlConfig: any): {
  targetField: string;
  caseKey: string | undefined;
  isDynamic: boolean;
} {
  let targetField = sourceHandle;
  let caseKey: string | undefined;
  let isDynamic = false;

  if (flowControlConfig.ports.output) {
    const dynamicOutput = flowControlConfig.ports.output.find(
      (o: any) => o.dynamic && sourceHandle.startsWith(o.field + '-')
    );
    if (dynamicOutput) {
      targetField = dynamicOutput.field;
      const remaining = sourceHandle.replace(dynamicOutput.field + '-', '');
      if (remaining !== 'add') {
        caseKey = remaining;
      }
      isDynamic = true;
    } else {
      const dynamicField = flowControlConfig.ports.output.find(
        (o: any) => o.dynamic && sourceHandle === o.field
      );
      if (dynamicField) {
        targetField = dynamicField.field;
        isDynamic = true;
      }
    }
  }

  return { targetField, caseKey, isDynamic };
}

function ensureConfigObject(node: any, field: string): Record<string, any> {
  if (!node.data.config) {
    node.data.config = {};
  }
  if (!node.data.config[field]) {
    node.data.config[field] = {};
  }
  return node.data.config[field];
}

function ensureConfigArray(node: any, field: string): any[] {
  if (!node.data.config) {
    node.data.config = {};
  }
  if (!Array.isArray(node.data.config[field])) {
    node.data.config[field] = [];
  }
  return node.data.config[field];
}

export function useCanvasConnections(
  nodeConfigForm?: NodeConfigForm,
  _selectedNode?: any,
  onNodeConnected?: NodeConnectedCallback,
  panOffset?: { value: { x: number; y: number } },
  scale?: { value: number }
) {
  const store = useWorkflowStore();
  const connections = ref<Connection[]>([]);
  const isConnecting = ref(false);
  const connectingFrom = ref<string | null>(null);
  const connectingFromPortId = ref<string | null>(null);
  const tempLine = ref({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const selectedConnectionId = ref<string | null>(null);
  const { addListener, removeAllListeners, removeListener } = useEventCleanup();

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
    
    const transform = {
      panX: panOffset?.value?.x || 0,
      panY: panOffset?.value?.y || 0,
      scale: scale?.value || 1,
    };
    
    const portElement = e.target as HTMLElement;
    const portCanvasPos = getElementCanvasPosition(portElement, canvas as HTMLElement, transform);
    const mouseCanvasPos = getMouseCanvasPosition(e, canvas as HTMLElement, transform);
    
    tempLine.value = {
      x1: portCanvasPos.x,
      y1: portCanvasPos.y,
      x2: mouseCanvasPos.x,
      y2: mouseCanvasPos.y,
    };

    function onMouseMove(event: MouseEvent) {
      if (!isConnecting.value) return;
      const currentTransform = {
        panX: panOffset?.value?.x || 0,
        panY: panOffset?.value?.y || 0,
        scale: scale?.value || 1,
      };
      const pos = getMouseCanvasPosition(event, canvas as HTMLElement, currentTransform);
      tempLine.value.x2 = pos.x;
      tempLine.value.y2 = pos.y;
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
      removeListener(document, 'mousemove', onMouseMove);
      removeListener(document, 'mouseup', onMouseUp);
      removeListener(document, 'mouseleave', onMouseLeave);
    }

    function onMouseLeave() {
      if (isConnecting.value) {
        onMouseUp(new MouseEvent('mouseup'));
      }
    }

    addListener(document, 'mousemove', onMouseMove);
    addListener(document, 'mouseup', onMouseUp);
    addListener(document, 'mouseleave', onMouseLeave);
  }

  function cleanup() {
    removeAllListeners();
    isConnecting.value = false;
    connectingFrom.value = null;
    connectingFromPortId.value = null;
  }

  function syncConnectionToNodeConfig(conn: Connection, isAdd: boolean) {
    const sourceNode = store.currentWorkflow?.nodes.find(n => n.id === conn.source) as WorkflowNode | undefined;
    if (!sourceNode) return;

    const flowControlConfig = getFlowControlConfig(sourceNode.data.type);
    if (!flowControlConfig) return;

    const sourceHandle = conn.sourceHandle.replace(`${conn.source}-output-`, '');
    const { targetField, caseKey, isDynamic } = parseSourceHandle(sourceHandle, flowControlConfig);

    const targetNode = store.currentWorkflow?.nodes.find(n => n.id === conn.target) as WorkflowNode | undefined;
    if (!targetNode) return;

    const taskItem: TaskItem = {
      type: targetNode.data.type,
      nodeId: targetNode.id,
      label: targetNode.data.label,
      ...targetNode.data.config,
    };

    if (isDynamic && isAdd && !caseKey) {
      const casesObj = ensureConfigObject(sourceNode, targetField);
      const caseCount = Object.keys(casesObj).length + 1;
      const newCaseKey = `CASE_${caseCount}`;
      casesObj[newCaseKey] = [taskItem];
      conn.sourceHandle = `${conn.source}-output-${targetField}-add`;
      if (nodeConfigForm) {
        nodeConfigForm[targetField] = { ...casesObj };
      }
    } else if (isDynamic && caseKey) {
      const casesObj = ensureConfigObject(sourceNode, targetField);
      let caseItems = Array.isArray(casesObj[caseKey]) ? [...casesObj[caseKey]] : [];
      
      if (isAdd) {
        const existing = caseItems.find((item: any) => item.nodeId === conn.target);
        if (!existing) {
          caseItems.push(taskItem);
        }
      } else {
        caseItems = caseItems.filter((item: any) => item.nodeId !== conn.target);
      }
      
      casesObj[caseKey] = caseItems;
      if (nodeConfigForm) {
        nodeConfigForm[targetField] = { ...casesObj };
      }
    } else if (isDynamic && !isAdd) {
      const casesObj = ensureConfigObject(sourceNode, targetField);
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
        if (nodeConfigForm) {
          nodeConfigForm[targetField] = { ...casesObj };
        }
      }
    } else {
      const configArray = ensureConfigArray(sourceNode, targetField);
      
      if (isAdd) {
        const existing = configArray.find((item: any) => item.nodeId === conn.target);
        if (!existing) {
          configArray.push(taskItem);
        }
      } else {
        if (!sourceNode.data.config) {
          sourceNode.data.config = {};
        }
        sourceNode.data.config[targetField] = configArray.filter(
          (item: any) => item.nodeId !== conn.target
        );
      }
      
      if (nodeConfigForm && sourceNode.data.config) {
        nodeConfigForm[targetField] = [...sourceNode.data.config[targetField]];
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
  }

  function getTempLinePath(): string {
    const { x1, y1, x2, y2 } = tempLine.value;
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  }

  function handleCanvasMouseLeave() {
    if (isConnecting.value) {
      isConnecting.value = false;
      connectingFrom.value = null;
    }
  }

  return {
    connections,
    isConnecting,
    connectingFrom,
    connectingFromPortId,
    tempLine,
    selectedConnectionId,
    startConnection,
    deleteConnection,
    selectConnection,
    getTempLinePath,
    handleCanvasMouseLeave,
    syncConnectionToNodeConfig,
    cleanup,
  };
}
