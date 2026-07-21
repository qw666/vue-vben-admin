import { ref } from 'vue';
import { useWorkflowStore } from '#/store/workflow';
import type { WorkflowNode } from '#/types/workflow';
import { getFlowControlConfig } from '../config/workflow-node-config';
import type { Connection, NodeConfigForm, NodeConnectedCallback } from '../types/workflow';
import { getElementCanvasPosition, getMouseCanvasPosition } from '../utils/coordinateUtils';
import { useEventCleanup } from './useEventCleanup';
import { flowControlNodeRegistry } from '../nodes/types';
import { useFlowControlNode } from './useFlowControlNode';
import { getGroupBounds } from './useCanvasPorts';

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
            const sourceNode = store.currentWorkflow?.nodes.find(n => n.id === connectingFrom.value);
            const isPortAllowMultipleConnections = (portId: string, node: any): boolean => {
              if (!node) return false;
              const flowControlConfig = getFlowControlConfig(node.data.type);
              if (!flowControlConfig.ports?.output) return false;
              const sourceHandle = portId.replace(`${node.id}-output-`, '');
              const port = flowControlConfig.ports.output.find((p: any) => 
                sourceHandle === p.field || sourceHandle.startsWith(p.field + '-')
              );
              if (!port) return false;
              return port.connectionType !== 'single';
            };
            
            const sourceHandle = connectingFromPortId.value;
            const hasMultipleConnectionAllow = isPortAllowMultipleConnections(sourceHandle, sourceNode);
            
            if (!hasMultipleConnectionAllow) {
              const sourcePortConnections = connections.value.filter(
                c => c.source === connectingFrom.value && c.sourceHandle === sourceHandle
              );
              if (sourcePortConnections.length > 0) {
                connectingFrom.value = null;
                connectingFromPortId.value = null;
                removeListener(document, 'mousemove', onMouseMove);
                removeListener(document, 'mouseup', onMouseUp);
                removeListener(document, 'mouseleave', onMouseLeave);
                return;
              }
            }
            
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

    const nodeType = sourceNode.data.type;
    const { getParentNodeId } = useFlowControlNode();
    const parentNodeId = getParentNodeId(conn.source);
    const parentNode = parentNodeId ? store.currentWorkflow?.nodes.find(n => n.id === parentNodeId) : null;
    
    let flowControlNodeId = flowControlNodeRegistry.isFlowControlNode(nodeType) ? conn.source : parentNodeId;
    
    const isNextPort = conn.sourceHandle?.endsWith('-next');
    
    if (flowControlNodeRegistry.isFlowControlNode(nodeType)) {
      if (isNextPort && parentNodeId && parentNode && flowControlNodeRegistry.isFlowControlNode(parentNode.data.type)) {
        const targetNode = store.currentWorkflow?.nodes.find(n => n.id === conn.target);
        if (targetNode) {
          const flowControlConfig = getFlowControlConfig(parentNode.data.type);
          
          if (flowControlConfig.taskFields) {
            const taskFields = flowControlConfig.taskFields.filter(f => f !== 'next');
            let targetField: string | undefined;
            let caseKey: string | undefined;
            
            for (const field of taskFields) {
              const fieldValue = parentNode.data.config?.[field];
              if (fieldValue) {
                if (Array.isArray(fieldValue)) {
                  if (fieldValue.some(item => item.nodeId === conn.source)) {
                    targetField = field;
                    break;
                  }
                } else if (typeof fieldValue === 'object' && fieldValue !== null) {
                  for (const [key, value] of Object.entries(fieldValue)) {
                    if (Array.isArray(value) && value.some((item: any) => item.nodeId === conn.source)) {
                      targetField = field;
                      caseKey = key;
                      break;
                    }
                  }
                  if (caseKey) break;
                }
              }
            }
            
            if (targetField) {
              flowControlNodeRegistry.handleConnection(parentNode.data.type, {
                conn: {
                  ...conn,
                  source: parentNodeId,
                  sourceHandle: caseKey ? `${parentNodeId}-output-${targetField}-${caseKey}` : `${parentNodeId}-output-${targetField}`,
                },
                isAdd,
                nodeConfigForm,
                store,
              });
              flowControlNodeId = parentNodeId;
            } else {
              flowControlNodeRegistry.handleConnection(nodeType, {
                conn,
                isAdd,
                nodeConfigForm,
                store,
              });
            }
          }
        }
      } else {
        flowControlNodeRegistry.handleConnection(nodeType, {
          conn,
          isAdd,
          nodeConfigForm,
          store,
        });
      }
    } else if (parentNodeId && parentNode && flowControlNodeRegistry.isFlowControlNode(parentNode.data.type)) {
      const targetNode = store.currentWorkflow?.nodes.find(n => n.id === conn.target);
      if (targetNode) {
        const flowControlConfig = getFlowControlConfig(parentNode.data.type);
        
        if (flowControlConfig.taskFields) {
          const taskFields = flowControlConfig.taskFields.filter(f => f !== 'next');
          let targetField: string | undefined;
          let caseKey: string | undefined;
          
          for (const field of taskFields) {
            const fieldValue = parentNode.data.config?.[field];
            if (fieldValue) {
              if (Array.isArray(fieldValue)) {
                if (fieldValue.some(item => item.nodeId === conn.source)) {
                  targetField = field;
                  break;
                }
              } else if (typeof fieldValue === 'object' && fieldValue !== null) {
                for (const [key, value] of Object.entries(fieldValue)) {
                  if (Array.isArray(value) && value.some((item: any) => item.nodeId === conn.source)) {
                    targetField = field;
                    caseKey = key;
                    break;
                  }
                }
                if (caseKey) break;
              }
            }
          }
          
          if (targetField) {
            flowControlNodeRegistry.handleConnection(parentNode.data.type, {
              conn: {
                ...conn,
                source: parentNodeId,
                sourceHandle: caseKey ? `${parentNodeId}-output-${targetField}-${caseKey}` : `${parentNodeId}-output-${targetField}`,
              },
              isAdd,
              nodeConfigForm,
              store,
            });
          }
        }
      }
    }

    if (flowControlNodeId) {
      adjustConnectedNodePositions(flowControlNodeId);
    }
  }

  function adjustConnectedNodePositions(flowControlNodeId: string) {
    const parentBounds = getGroupBounds(flowControlNodeId);
    if (!parentBounds) return;

    const connectedNodes = store.currentWorkflow?.edges
      .filter(e => e.source === flowControlNodeId && e.sourceHandle?.endsWith('-next'))
      .map(e => store.currentWorkflow?.nodes.find(n => n.id === e.target))
      .filter(Boolean) as WorkflowNode[];

    const nodeWidth = 176;
    const nodeHeight = 72;
    const padding = 16;
    const spacing = 20;

    const targetY = parentBounds.y + parentBounds.height + spacing;
    const targetX = parentBounds.x + parentBounds.width / 2 - nodeWidth / 2;

    connectedNodes.forEach((node, index) => {
      const newX = Math.max(0, targetX);
      const newY = targetY + index * (nodeHeight + spacing);
      
      if (newX !== node.position.x || newY !== node.position.y) {
        store.updateNode(node.id, {
          position: { x: newX, y: newY }
        });
      }
    });
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
