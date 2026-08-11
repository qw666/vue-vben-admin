import { useWorkflowStore } from '#/store/workflow';
import { getDefaultOutputPortField } from '../utils/flowModelConverter';

export function useWorkflowInit(
  updatePanOffset: (offset: { x: number; y: number }) => void,
) {
  const store = useWorkflowStore();

  function centerCanvasOnNodes() {
    const nodes = store.currentWorkflow?.nodes || [];
    if (nodes.length > 0) {
      const totalX = nodes.reduce((sum, node) => sum + node.position.x, 0);
      const totalY = nodes.reduce((sum, node) => sum + node.position.y, 0);
      const centerX = totalX / nodes.length + 88;
      const centerY = totalY / nodes.length + 34;

      const canvas = document.querySelector('.workflow-canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const panX = rect.width / 2 - centerX;
        const panY = rect.height / 2 - centerY;
        updatePanOffset({ x: panX, y: panY });
      } else {
        updatePanOffset({ x: 0, y: 0 });
      }
    } else {
      updatePanOffset({ x: 0, y: 0 });
    }
  }

  /** 查找不被任何其他节点 config 引用的顶层节点 */
  function findFirstLevelNodes() {
    const taskNodes = (store.currentWorkflow?.nodes || []).filter(
      (n) => n.data.type !== 'idp_core_flow_Start' && n.data.type !== 'idp_core_flow_End',
    );

    return taskNodes.filter((node) => {
      for (const other of store.currentWorkflow?.nodes || []) {
        if (other.id === node.id) continue;
        const config = other.data.config || {};
        for (const key of Object.keys(config)) {
          const value = config[key];
          const checkValue = (v: any): boolean => {
            if (Array.isArray(v)) {
              for (const item of v) {
                if (item.nodeId === node.id) return true;
                if (typeof item === 'object' && item) {
                  if (checkValue(item)) return true;
                }
              }
            } else if (typeof v === 'object' && v) {
              for (const innerKey of Object.keys(v)) {
                if (checkValue(v[innerKey])) return true;
              }
            }
            return false;
          };
          if (checkValue(value)) return false;
        }
      }
      return true;
    });
  }

  function ensureStartAndEndNodes() {
    if (!store.currentWorkflow) return;

    const hasStartNode = store.currentWorkflow.nodes.some(
      (n) => n.data.type === 'idp_core_flow_Start',
    );
    const hasEndNode = store.currentWorkflow.nodes.some(
      (n) => n.data.type === 'idp_core_flow_End',
    );

    let layoutNodes: Record<string, { x: number; y: number }> = {};
    if (store.currentWorkflow.flowLayout) {
      try {
        const parsedLayout = JSON.parse(store.currentWorkflow.flowLayout);
        if (parsedLayout && parsedLayout.nodes) {
          layoutNodes = parsedLayout.nodes as Record<string, { x: number; y: number }>;
        }
      } catch {
      }
    }

    const firstLevelNodes = findFirstLevelNodes();

    let startNodeId: string | null = null;
    if (!hasStartNode) {
      const startNode = {
        id: `start_${Date.now()}`,
        type: 'custom',
        position: layoutNodes['start'] || { x: 2000, y: 2000 },
        data: {
          label: '开始',
          type: 'idp_core_flow_Start',
          icon: 'mdi:play-circle',
          description: '流程开始节点',
          config: {
            next: [],
            inputs: store.currentWorkflow.inputs || [],
            triggers: store.currentWorkflow.triggers || [],
          },
        },
      };
      store.addNode(startNode);
      startNodeId = startNode.id;
    } else {
      const existingStart = store.currentWorkflow.nodes.find(
        (n) => n.data.type === 'idp_core_flow_Start',
      );
      if (existingStart && store.currentWorkflow.inputs && !existingStart.data.config?.inputs) {
        existingStart.data.config = existingStart.data.config || {};
        existingStart.data.config.inputs = store.currentWorkflow.inputs;
        store.updateNode(existingStart.id, { data: { ...existingStart.data } });
      }
      if (existingStart && store.currentWorkflow.triggers && !existingStart.data.config?.triggers) {
        existingStart.data.config = existingStart.data.config || {};
        existingStart.data.config.triggers = store.currentWorkflow.triggers;
        store.updateNode(existingStart.id, { data: { ...existingStart.data } });
      }
      startNodeId = existingStart?.id || null;
    }

    let endNodeId: string | null = null;
    if (!hasEndNode) {
      const endNode = {
        id: `end_${Date.now()}`,
        type: 'custom',
        position: layoutNodes['end'] || { x: 2400, y: 2000 },
        data: {
          label: '输出',
          type: 'idp_core_flow_End',
          icon: 'mdi:stop-circle',
          description: '流程输出节点',
          config: { outputs: store.currentWorkflow.outputs || [] },
        },
      };
      store.addNode(endNode);
      endNodeId = endNode.id;
    } else {
      const existingEnd = store.currentWorkflow.nodes.find(
        (n) => n.data.type === 'idp_core_flow_End',
      );
      if (existingEnd && store.currentWorkflow.outputs && !existingEnd.data.config?.outputs) {
        existingEnd.data.config = existingEnd.data.config || {};
        existingEnd.data.config.outputs = store.currentWorkflow.outputs;
        store.updateNode(existingEnd.id, { data: { ...existingEnd.data } });
      }
      endNodeId = existingEnd?.id || null;
    }

    if (firstLevelNodes.length > 0 && startNodeId) {
      const targetNodes = firstLevelNodes.filter(
        (n) => !store.currentWorkflow?.edges.some((e) => e.target === n.id),
      );
      const firstTask = targetNodes.length > 0 ? targetNodes[0] : firstLevelNodes[0];
      if (!firstTask) return;
      const startAlreadyConnected = store.currentWorkflow.edges.some(
        (e) => e.source === startNodeId,
      );
      if (!startAlreadyConnected) {
        const edge = {
          id: `edge_start_${Date.now()}`,
          source: startNodeId,
          sourceHandle: `${startNodeId}-output-next`,
          target: firstTask.id,
          targetHandle: `${firstTask.id}-input`,
        };
        store.addEdge(edge);

        const startNode = store.currentWorkflow.nodes.find((n) => n.id === startNodeId);
        if (startNode && startNode.data.config) {
          startNode.data.config.next = [{ nodeId: firstTask.id }];
          store.updateNode(startNodeId, { data: { ...startNode.data } });
        }
      }
    }

    if (firstLevelNodes.length > 0 && endNodeId) {
      const lastTask = firstLevelNodes[firstLevelNodes.length - 1];
      if (!lastTask) return;
      const endAlreadyConnected = store.currentWorkflow.edges.some(
        (e) => e.target === endNodeId,
      );
      if (!endAlreadyConnected) {
        const lastTaskNode = store.currentWorkflow.nodes.find((n) => n.id === lastTask.id);
        const portField = lastTaskNode ? getDefaultOutputPortField(lastTaskNode.data.type) : 'output';
        const edge = {
          id: `edge_end_${Date.now()}`,
          source: lastTask.id,
          sourceHandle: `${lastTask.id}-output-${portField}`,
          target: endNodeId,
          targetHandle: `${endNodeId}-input`,
        };
        store.addEdge(edge);

        const lastNode = store.currentWorkflow.nodes.find((n) => n.id === lastTask.id);
        if (lastNode && lastNode.data.config) {
          if (!lastNode.data.config.next) {
            lastNode.data.config.next = [];
          }
          lastNode.data.config.next.push({ nodeId: endNodeId });
          store.updateNode(lastTask.id, { data: { ...lastNode.data } });
        }
      }
    }
  }

  return {
    ensureStartAndEndNodes,
    centerCanvasOnNodes,
  };
}
