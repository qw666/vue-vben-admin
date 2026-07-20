import { useWorkflowStore } from '#/store/workflow';

export function useSwitchNode(
  nodeConfigForm?: any,
  selectedNode?: { value: any }
) {
  const store = useWorkflowStore();

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

  return {
    updateSwitchCaseKey,
    removeSwitchCaseKey,
    addSwitchCaseKey,
  };
}