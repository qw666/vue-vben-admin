import { ref } from 'vue';
import { useWorkflowStore } from '#/store/workflow';
import { getFlowControlConfig } from '../config/workflow-node-config';

export interface Connection {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export function useCanvasConnections(
  nodeConfigForm?: any,
  selectedNode?: { value: any },
  onNodeConnected?: (node: any) => void,
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
    
    const currentScale = scale?.value || 1;
    const currentPanX = panOffset?.value?.x || 0;
    const currentPanY = panOffset?.value?.y || 0;
    
    tempLine.value = {
      x1: (portRect.left - canvasRect.left + portRect.width / 2 - currentPanX) / currentScale,
      y1: (portRect.top - canvasRect.top + portRect.height / 2 - currentPanY) / currentScale,
      x2: (e.clientX - canvasRect.left - currentPanX) / currentScale,
      y2: (e.clientY - canvasRect.top - currentPanY) / currentScale
    };

    function onMouseMove(event: MouseEvent) {
      if (!isConnecting.value) return;
      const rect = canvas!.getBoundingClientRect();
      const currentScaleVal = scale?.value || 1;
      const currentPanXVal = panOffset?.value?.x || 0;
      const currentPanYVal = panOffset?.value?.y || 0;
      tempLine.value.x2 = (event.clientX - rect.left - currentPanXVal) / currentScaleVal;
      tempLine.value.y2 = (event.clientY - rect.top - currentPanYVal) / currentScaleVal;
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
      document.removeEventListener('mouseleave', onMouseLeave);
    }

    function onMouseLeave() {
      if (isConnecting.value) {
        onMouseUp(new MouseEvent('mouseup'));
      }
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseleave', onMouseLeave);
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
  };
}
