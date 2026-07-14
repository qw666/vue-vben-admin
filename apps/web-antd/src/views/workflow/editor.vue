<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

import { Button, message, Tooltip, Input, Textarea, Select, Switch, Slider, InputNumber } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import { useWorkflowStore } from '#/store/workflow';
import { getPluginTree, getPluginMetaBatch } from '#/api';

const router = useRouter();
const route = useRoute();
const store = useWorkflowStore();

const workflowName = ref('未命名流程');
const isLoading = ref(false);
const isPageReady = ref(false);

const pluginGroups = ref<any[]>([
  {
    groupKey: 'flow_control',
    groupName: '流程控制',
    pluginList: [
      { type: 'start', nodeName: '开始', icon: 'mdi:play-circle', description: '流程开始节点' },
      { type: 'end', nodeName: '结束', icon: 'mdi:stop-circle', description: '流程结束节点' },
      { type: 'condition', nodeName: '条件判断', icon: 'mdi:decision', description: '条件分支判断' },
      { type: 'loop', nodeName: '循环', icon: 'mdi:repeat', description: '循环执行' },
    ]
  },
  {
    groupKey: 'http',
    groupName: 'HTTP操作',
    pluginList: [
      { type: 'http_get', nodeName: 'HTTP GET', icon: 'mdi:download', description: '发送GET请求' },
      { type: 'http_post', nodeName: 'HTTP POST', icon: 'mdi:upload', description: '发送POST请求' },
    ]
  },
  {
    groupKey: 'output',
    groupName: '输出操作',
    pluginList: [
      { type: 'log', nodeName: '日志输出', icon: 'mdi:file-document', description: '输出日志' },
      { type: 'email', nodeName: '发送邮件', icon: 'mdi:email', description: '发送邮件通知' },
    ]
  }
]);
const isPluginLoading = ref(false);
const pluginMetaCache = ref<Record<string, any>>({});

const selectedNode = ref<any>(null);
const nodeConfigForm = ref<any>({});
const isConfigPanelOpen = ref(false);
const isMetaLoading = ref(false);
const configPanelWidth = ref(350);
const isResizing = ref(false);

const isDraggingNode = ref(false);
const draggingNodeId = ref<string | null>(null);
const dragOffset = ref({ x: 0, y: 0 });

const isConnecting = ref(false);
const connectingFrom = ref<string | null>(null);
const tempLine = ref({ x1: 0, y1: 0, x2: 0, y2: 0 });
const connections = ref<{ id: string; source: string; target: string; sourcePort?: string; targetPort?: string }[]>([]);
const selectedConnectionId = ref<string | null>(null);
const contextMenu = ref({ show: false, x: 0, y: 0, type: 'node' | 'connection' | null, targetId: null });

const showNodeSelectModal = ref(false);
const currentArrayFieldKey = ref('');
const currentArrayIndex = ref(-1);
const selectedChildNodeType = ref('');
const selectedChildNodeMeta = ref<any>(null);
const childNodeConfigForm = ref<any>({});
const isChildNodeConfigPanelOpen = ref(false);
const selectedChildNodeLabel = ref('');

function isTaskRef(itemsSchema: any): boolean {
  return itemsSchema && itemsSchema.$ref && 
    (itemsSchema.$ref === '#/$defs/idp_core_models_tasks_Task' || 
     itemsSchema.$ref.includes('idp_core_models_tasks_Task'));
}

function openNodeSelectModal(fieldKey: string) {
  currentArrayFieldKey.value = fieldKey;
  currentArrayIndex.value = -1;
  selectedChildNodeType.value = '';
  selectedChildNodeMeta.value = null;
  childNodeConfigForm.value = {};
  showNodeSelectModal.value = true;
}

function closeNodeSelectModal() {
  showNodeSelectModal.value = false;
  currentArrayFieldKey.value = '';
  currentArrayIndex.value = -1;
  selectedChildNodeType.value = '';
  selectedChildNodeMeta.value = null;
  childNodeConfigForm.value = {};
}

async function selectChildNode(nodeType: string) {
  selectedChildNodeType.value = nodeType;
  const template = pluginGroups.value.flatMap(g => g.pluginList).find(p => p.type === nodeType);
  selectedChildNodeLabel.value = template?.nodeName || '';
  
  const meta = await loadPluginMeta(nodeType);
  if (meta && meta.formProperties) {
    selectedChildNodeMeta.value = meta;
    childNodeConfigForm.value = {};
    Object.keys(meta.formProperties).forEach(key => {
      if (key !== '$schema') {
        if (meta.formProperties[key].default !== undefined) {
          childNodeConfigForm.value[key] = meta.formProperties[key].default;
        } else if (meta.formProperties[key].type === 'boolean') {
          childNodeConfigForm.value[key] = false;
        }
      }
    });
  }
}

function confirmAddChildNode() {
  if (!selectedChildNodeType.value) {
    message.error('请选择一个节点');
    return;
  }
  
  const currentValue = nodeConfigForm.value[currentArrayFieldKey.value] || [];
  const newItem = {
    type: selectedChildNodeType.value,
    ...childNodeConfigForm.value,
  };
  
  nodeConfigForm.value[currentArrayFieldKey.value] = [...currentValue, newItem];
  message.success(`已添加 ${selectedChildNodeLabel.value} 节点`);
  closeNodeSelectModal();
}

function editChildNode(fieldKey: string, index: number) {
  const currentValue = nodeConfigForm.value[fieldKey] || [];
  const item = currentValue[index];
  if (!item || !item.type) return;
  
  currentArrayFieldKey.value = fieldKey;
  currentArrayIndex.value = index;
  selectedChildNodeType.value = item.type;
  
  const template = pluginGroups.value.flatMap(g => g.pluginList).find(p => p.type === item.type);
  selectedChildNodeLabel.value = template?.nodeName || '';
  
  loadPluginMeta(item.type).then(meta => {
    if (meta && meta.formProperties) {
      selectedChildNodeMeta.value = meta;
      childNodeConfigForm.value = { ...item };
      showNodeSelectModal.value = true;
    }
  });
}

function confirmEditChildNode() {
  if (!selectedChildNodeType.value || currentArrayIndex.value < 0) return;
  
  const currentValue = nodeConfigForm.value[currentArrayFieldKey.value] || [];
  currentValue[currentArrayIndex.value] = {
    type: selectedChildNodeType.value,
    ...childNodeConfigForm.value,
  };
  nodeConfigForm.value[currentArrayFieldKey.value] = [...currentValue];
  message.success('节点配置已更新');
  closeNodeSelectModal();
}

const colorMap: Record<string, string> = {
  '基础': 'bg-green-500',
  'AI': 'bg-purple-500',
  '工具': 'bg-orange-500',
  '控制': 'bg-yellow-500',
  '数据': 'bg-indigo-500',
  'task': 'bg-blue-500',
};

function getCategoryColor(category: string): string {
  return colorMap[category] || 'bg-gray-500';
}

async function loadPlugins() {
  isPluginLoading.value = true;
  try {
    const response = await getPluginTree();
    if (response) {
      pluginGroups.value = response;
    }
  } catch (error) {
    console.error('Failed to load plugins:', error);
    message.error('加载节点列表失败');
  } finally {
    isPluginLoading.value = false;
  }
}

async function loadPluginMeta(nodeType: string) {
  if (pluginMetaCache.value[nodeType]) {
    
    return pluginMetaCache.value[nodeType];
  }
  isMetaLoading.value = true;
  try {
    const response = await getPluginMetaBatch([nodeType]);
    if (response && response[nodeType]) {
      const meta = response[nodeType];
      if (meta.formSchema) {
        let schema = meta.formSchema;
        try {
          schema = JSON.parse(meta.formSchema);
        } catch {
        }
        if (typeof schema === 'string') {
          try {
            schema = JSON.parse(schema);
          } catch {
          }
        }
        if (typeof schema === 'object' && schema.properties && schema.properties.properties) {
          meta.parsedSchema = schema;
          meta.formProperties = schema.properties.properties;
          meta.formRequired = schema.properties.required || schema.required || [];
          meta.formDefs = schema.$defs || schema.definitions || {};
        } else if (typeof schema === 'object' && schema.properties) {
          meta.parsedSchema = schema;
          meta.formProperties = schema.properties;
          meta.formRequired = schema.required || [];
          meta.formDefs = schema.$defs || schema.definitions || {};
        } else {
          meta.parsedSchema = null;
          meta.formProperties = {};
          meta.formRequired = [];
          meta.formDefs = {};
        }
      }
      pluginMetaCache.value[nodeType] = meta;
      return meta;
    }
  } catch (error) {
    console.error('Failed to load plugin meta:', error);
    message.error('加载节点元数据失败');
  } finally {
    isMetaLoading.value = false;
  }
  return null;
}

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
    x: e.clientX - rect.left - 70,
    y: e.clientY - rect.top - 30,
  };

  if (e.dataTransfer) {
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      const { nodeType } = JSON.parse(data);
      let template: any = null;
      for (const group of pluginGroups.value) {
        template = group.pluginList.find((p: any) => p.type === nodeType);
        if (template) {
          template.category = group.groupName;
          break;
        }
      }
      if (template && store.currentWorkflow) {
        const meta = pluginMetaCache.value[nodeType];
        const newNode = {
          id: `node-${Date.now()}`,
          type: 'custom',
          position,
          data: {
            label: template.nodeName,
            type: template.type,
            icon: template.icon,
            description: template.nodeCategory,
            config: meta && meta.parsedSchema ? {} : {},
          },
        };
        store.currentWorkflow.nodes.push(newNode);
        message.success(`已添加 ${template.nodeName} 节点`);
      }
    }
  }
}

async function handleNodeDoubleClick(node: any) {
  selectedNode.value = node;
  isConfigPanelOpen.value = true;
  
  const meta = await loadPluginMeta(node.data.type);
  if (meta && meta.formProperties) {
    const savedConfig = node.data.config || {};
    const properties = meta.formProperties || {};
    nodeConfigForm.value = {};
    Object.keys(properties).forEach(key => {
      if (key !== '$schema') {
        if (savedConfig[key] !== undefined) {
          nodeConfigForm.value[key] = savedConfig[key];
        } else if (properties[key].default !== undefined) {
          nodeConfigForm.value[key] = properties[key].default;
        } else if (properties[key].type === 'boolean') {
          nodeConfigForm.value[key] = false;
        }
      }
    });
  }
}

function handleConfigClose() {
  isConfigPanelOpen.value = false;
  selectedNode.value = null;
  nodeConfigForm.value = {};
}

function startResize(e: MouseEvent) {
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = configPanelWidth.value;

  function onMouseMove(event: MouseEvent) {
    if (!isResizing.value) return;
    const deltaX = startX - event.clientX;
    const newWidth = Math.max(200, Math.min(600, startWidth + deltaX));
    configPanelWidth.value = newWidth;
  }

  function onMouseUp() {
    isResizing.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
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
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y
    };
  }

  function onMouseMove(event: MouseEvent) {
    if (!isDraggingNode.value || !draggingNodeId.value) return;

    const newX = Math.max(0, event.clientX - dragOffset.value.x);
    const newY = Math.max(0, event.clientY - dragOffset.value.y);

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

function startConnection(e: MouseEvent, nodeId: string, portType: 'input' | 'output') {
  e.preventDefault();
  e.stopPropagation();
  
  console.log('startConnection called:', nodeId, portType);
  
  isConnecting.value = true;
  connectingFrom.value = nodeId;

  const canvas = document.querySelector('.workflow-canvas');
  if (!canvas) {
    console.log('canvas not found');
    return;
  }
  
  const canvasRect = canvas.getBoundingClientRect();
  const portElement = e.target as HTMLElement;
  const portRect = portElement.getBoundingClientRect();
  
  tempLine.value = {
    x1: portRect.left - canvasRect.left + portRect.width / 2,
    y1: portRect.top - canvasRect.top + portRect.height / 2,
    x2: e.clientX - canvasRect.left,
    y2: e.clientY - canvasRect.top
  };
  
  console.log('tempLine initialized:', tempLine.value);

  function onMouseMove(event: MouseEvent) {
    if (!isConnecting.value) return;
    const rect = canvas.getBoundingClientRect();
    tempLine.value.x2 = event.clientX - rect.left;
    tempLine.value.y2 = event.clientY - rect.top;
  }

  function onMouseUp(event: MouseEvent) {
    isConnecting.value = false;
    
    const targetElement = event.target as HTMLElement;
    const targetPort = targetElement.closest('.node-port');
    
    console.log('onMouseUp called, targetPort:', targetPort);
    
    if (targetPort && connectingFrom.value) {
      const targetNodeId = targetPort.dataset.nodeId;
      const targetPortType = targetPort.dataset.portType;
      
      console.log('targetNodeId:', targetNodeId, 'targetPortType:', targetPortType);
      
      if (targetNodeId && targetNodeId !== connectingFrom.value && targetPortType === 'input') {
        connections.value.push({
          id: `conn-${Date.now()}`,
          source: connectingFrom.value,
          target: targetNodeId
        });
        console.log('connection added, total connections:', connections.value.length);
      } else {
        console.log('connection not added:', {
          hasTargetNodeId: !!targetNodeId,
          isDifferentNode: targetNodeId !== connectingFrom.value,
          isInputPort: targetPortType === 'input'
        });
      }
    }
    
    connectingFrom.value = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function deleteConnection(connId: string) {
  connections.value = connections.value.filter(c => c.id !== connId);
}

function selectConnection(connId: string) {
  selectedConnectionId.value = connId;
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
    store.removeNode(nodeId);
    connections.value = connections.value.filter(c => c.source !== nodeId && c.target !== nodeId);
  }
  closeContextMenu();
}

function handleCanvasClick() {
  closeContextMenu();
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedConnectionId.value) {
      deleteConnection(selectedConnectionId.value);
      selectedConnectionId.value = null;
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
      x: node.position.x + 66,
      y: node.position.y + 34
    };
  }
  return { x: 0, y: 0 };
}

function getNodeTop(nodeId: string): number {
  const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
  return node ? node.position.y : 0;
}

function getNodeBottom(nodeId: string): number {
  const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
  return node ? node.position.y + 68 : 0;
}

function getConnectionPath(sourceId: string, targetId: string): string {
  const sourceCenter = getNodeCenter(sourceId);
  const sourceBottom = getNodeBottom(sourceId);
  const targetCenter = getNodeCenter(targetId);
  const targetTop = getNodeTop(targetId);
  
  const startX = sourceCenter.x;
  const startY = sourceBottom;
  const endX = targetCenter.x;
  const endY = targetTop;
  
  const midY = (startY + endY) / 2;
  
  return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
}

function getTempLinePath(): string {
  const { x1, y1, x2, y2 } = tempLine.value;
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

function handleSaveConfig() {
  if (!selectedNode.value) return;

  const requiredKeys = requiredFields.value.map(f => f.props.key);
  const missingFields: string[] = [];
  
  requiredKeys.forEach(key => {
    const value = nodeConfigForm.value[key];
    if (value === undefined || value === null || value === '') {
      const field = requiredFields.value.find(f => f.props.key === key);
      if (field) {
        missingFields.push(field.props.label);
      }
    }
  });

  if (missingFields.length > 0) {
    message.error(`请填写必填项：${missingFields.join('、')}`);
    return;
  }

  selectedNode.value.data.config = { ...nodeConfigForm.value };
  message.success('节点配置已更新');
}

const defaultDefs: Record<string, any> = {
  idp_core_models_tasks_Task: {
    type: 'object',
    title: '通用任务节点',
    properties: {
      type: { type: 'string', title: '任务类型', $required: true },
      name: { type: 'string', title: '任务名称', $required: false },
      description: { type: 'string', title: '任务描述', $required: false },
    },
  },
};

function resolveRef(ref: string, defs: any): any {
  if (!ref) return null;
  const refName = ref.replace('#/$defs/', '').replace('#/definitions/', '');
  const resolved = defs && defs[refName] ? defs[refName] : defaultDefs[refName];
  if (resolved && !resolved.properties && defaultDefs[refName]) {
    return defaultDefs[refName];
  }
  return resolved || null;
}

function renderFormField(properties: any, fieldKey: string, isRequired: boolean, defs: any = {}) {
  const fieldSchema = properties[fieldKey];
  const title = fieldSchema.title || fieldKey;
  const description = fieldSchema.description || '';
  const value = nodeConfigForm.value[fieldKey];
  const isDynamic = fieldSchema.$dynamic === true;

  const renderProps = {
    key: fieldKey,
    label: title,
    tooltip: description,
    required: isRequired,
    dynamic: isDynamic,
  };

  if (fieldSchema.anyOf) {
    return {
      type: 'Input',
      props: {
        ...renderProps,
        modelValue: value,
        'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
        placeholder: isDynamic ? '支持动态表达式，如 {{ variable }}' : description || '请输入',
      },
    };
  }

  switch (fieldSchema.type) {
    case 'string':
      return {
        type: 'Input',
        props: {
          ...renderProps,
          modelValue: value,
          'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
          placeholder: isDynamic ? '支持动态表达式，如 {{ variable }}' : description || '请输入',
        },
      };
    case 'number':
    case 'integer':
      return {
        type: 'InputNumber',
        props: {
          ...renderProps,
          modelValue: value,
          'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
          min: fieldSchema.minimum,
        },
      };
    case 'boolean':
      return {
        type: 'Switch',
        props: {
          ...renderProps,
          checked: value,
          'onChange': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
        },
      };
    case 'array':
      if (fieldSchema.items && isTaskRef(fieldSchema.items)) {
        return {
          type: 'NodeArray',
          props: {
            ...renderProps,
            modelValue: value || [],
            itemsSchema: fieldSchema.items,
            minItems: fieldSchema.minItems,
            'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
          },
        };
      } else if (fieldSchema.items && fieldSchema.items.$ref) {
        const refSchema = resolveRef(fieldSchema.items.$ref, defs);
        if (refSchema && refSchema.properties) {
          return {
            type: 'ArrayTable',
            props: {
              ...renderProps,
              modelValue: value || [],
              itemsSchema: refSchema,
              minItems: fieldSchema.minItems,
              'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
            },
          };
        }
      } else if (fieldSchema.items && fieldSchema.items.type === 'object') {
        return {
          type: 'ArrayTable',
          props: {
            ...renderProps,
            modelValue: value || [],
            itemsSchema: fieldSchema.items,
            minItems: fieldSchema.minItems,
            'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
          },
        };
      } else if (fieldSchema.items && fieldSchema.items.type === 'string') {
        return {
          type: 'StringArray',
          props: {
            ...renderProps,
            modelValue: value || [],
            minItems: fieldSchema.minItems,
            'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
          },
        };
      }
      return {
        type: 'Textarea',
        props: {
          ...renderProps,
          modelValue: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
          'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
          placeholder: fieldSchema.minItems && fieldSchema.minItems > 0 ? `至少${fieldSchema.minItems}项，JSON数组格式` : description || '请输入JSON数组',
          rows: 4,
        },
      };
    case 'object':
      return {
        type: 'Textarea',
        props: {
          ...renderProps,
          modelValue: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
          'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
          placeholder: '请输入JSON格式数据',
          rows: 4,
        },
      };
    default:
      return {
        type: 'Input',
        props: {
          ...renderProps,
          modelValue: value,
          'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
          placeholder: description || '请输入',
        },
      };
  }
}

function addArrayItem(fieldKey: string, itemsSchema: any) {
  const currentValue = nodeConfigForm.value[fieldKey] || [];
  const newItem: any = {};
  if (itemsSchema.properties) {
    Object.keys(itemsSchema.properties).forEach(key => {
      const prop = itemsSchema.properties[key];
      if (prop.default !== undefined) {
        newItem[key] = prop.default;
      } else if (prop.type === 'boolean') {
        newItem[key] = false;
      }
    });
  }
  nodeConfigForm.value[fieldKey] = [...currentValue, newItem];
}

function removeArrayItem(fieldKey: string, index: number) {
  const currentValue = nodeConfigForm.value[fieldKey] || [];
  nodeConfigForm.value[fieldKey] = currentValue.filter((_, i) => i !== index);
}

function addStringArrayItem(fieldKey: string) {
  const currentValue = nodeConfigForm.value[fieldKey] || [];
  nodeConfigForm.value[fieldKey] = [...currentValue, ''];
}

function updateArrayItemValue(fieldKey: string, index: number, itemKey: string, value: any) {
  const currentValue = nodeConfigForm.value[fieldKey] || [];
  currentValue[index][itemKey] = value;
  nodeConfigForm.value[fieldKey] = [...currentValue];
}

const currentNodeMeta = computed(() => {
  if (!selectedNode.value) return null;
  return pluginMetaCache.value[selectedNode.value.data.type] || null;
});

const requiredFields = computed(() => {
  if (!currentNodeMeta.value || !currentNodeMeta.value.formProperties) return [];
  const properties = currentNodeMeta.value.formProperties;
  const formRequired = currentNodeMeta.value.formRequired || [];
  const formDefs = currentNodeMeta.value.formDefs || {};
  return Object.keys(properties)
    .filter(key => key !== '$schema')
    .filter(key => {
      const prop = properties[key];
      if (!prop.type && !prop.$ref && !prop.anyOf) return false;
      return prop.$required === true || formRequired.includes(key);
    })
    .map(key => {
      const isRequired = properties[key].$required === true || formRequired.includes(key);
      return renderFormField(properties, key, isRequired, formDefs);
    });
});

const optionalFields = computed(() => {
  if (!currentNodeMeta.value || !currentNodeMeta.value.formProperties) return [];
  const properties = currentNodeMeta.value.formProperties;
  const formRequired = currentNodeMeta.value.formRequired || [];
  const formDefs = currentNodeMeta.value.formDefs || {};
  return Object.keys(properties)
    .filter(key => key !== '$schema')
    .filter(key => {
      const prop = properties[key];
      if (!prop.type && !prop.$ref && !prop.anyOf) return false;
      return prop.$required !== true && !formRequired.includes(key);
    })
    .map(key => {
      const isRequired = properties[key].$required === true || formRequired.includes(key);
      return renderFormField(properties, key, isRequired, formDefs);
    });
});

async function handleSave() {
  isLoading.value = true;
  try {
    if (store.currentWorkflow) {
      store.currentWorkflow.name = workflowName.value;
      store.currentWorkflow.updatedAt = new Date().toISOString();
      store.saveWorkflow(store.currentWorkflow);
    }
    message.success('流程已保存');
  } catch (error) {
    message.error('保存失败');
  } finally {
    isLoading.value = false;
  }
}

async function handleRun() {
  message.info('正在运行流程...');
  setTimeout(() => {
    message.success('流程运行成功');
  }, 1500);
}

function handleClear() {
  if (store.currentWorkflow) {
    store.currentWorkflow.nodes = [];
    store.currentWorkflow.edges = [];
  }
  message.info('画布已清空');
}

function handleBack() {
  router.push('/workflow/list');
}

onMounted(() => {
  store.initMockData();
  loadPlugins();
  const workflowId = route.params.id as string;
  if (workflowId) {
    const workflow = store.getWorkflowById(workflowId);
    if (workflow) {
      store.setCurrentWorkflow(workflow);
      workflowName.value = workflow.name;
    }
  } else {
    const newWorkflow = store.createWorkflow('未命名流程');
    store.setCurrentWorkflow(newWorkflow);
  }
  window.addEventListener('keydown', handleKeyDown);
  setTimeout(() => {
    isPageReady.value = true;
  }, 0);
});
</script>

<template>
  <div class="h-full flex flex-col bg-gray-100 min-h-0">
    <header class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div class="flex items-center gap-4">
        <Button type="text" @click="handleBack">
          返回列表
        </Button>
        <input
          v-model="workflowName"
          type="text"
          class="text-xl font-semibold bg-transparent border-none outline-none w-64"
          placeholder="流程名称"
        />
      </div>
      <div class="flex items-center gap-2">
        <Button type="text" @click="handleClear">
          <IconifyIcon icon="mdi:trash-can" :size="16" />
          清空画布
        </Button>
        <Button type="primary" :loading="isLoading" @click="handleSave">
          <IconifyIcon icon="mdi:content-save" :size="16" />
          保存流程
        </Button>
        <Button type="primary" @click="handleRun">
          <IconifyIcon icon="mdi:play" :size="16" />
          运行流程
        </Button>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <div class="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div class="p-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-800">节点列表</h2>
          <p class="text-sm text-gray-500 mt-1">拖拽节点到画布</p>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-if="isPluginLoading" class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
          <div v-else>
            <div v-for="group in pluginGroups" :key="group.groupKey">
              <h3 class="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" :class="getCategoryColor(group.groupName)" />
                {{ group.groupName }}
              </h3>
              <div class="space-y-2">
                <div
                  v-for="plugin in group.pluginList"
                  :key="plugin.type"
                  class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-grab active:cursor-grabbing transition-colors border border-gray-200"
                  draggable="true"
                  @dragstart="onDragStart($event, plugin.type)"
                >
                  <div
                    class="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    :class="getCategoryColor(group.groupName)"
                  >
                    <IconifyIcon :icon="plugin.icon" :size="20" />
                  </div>
                  <div class="flex-1">
                    <div class="text-sm font-medium text-gray-800">{{ plugin.nodeName }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 flex overflow-hidden">
        <div
          class="flex-1 relative bg-gray-50 workflow-canvas"
          @drop="onDrop"
          @dragover="onDragOver"
          @mouseleave="handleCanvasMouseLeave"
          @click="handleCanvasClick"
        >
          <div class="absolute inset-0 pointer-events-none">
            <svg class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="gray" stroke-width="0.5" opacity="0.3" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div class="absolute inset-0" style="z-index: 5;">
            <svg class="w-full h-full">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                </marker>
              </defs>
              <g>
                <path
                  v-for="conn in connections"
                  :key="conn.id"
                  :d="getConnectionPath(conn.source, conn.target)"
                  fill="none"
                  stroke="transparent"
                  stroke-width="6"
                  stroke-linecap="round"
                  class="cursor-pointer"
                  @click="selectConnection(conn.id)"
                  @contextmenu.prevent="showConnectionContextMenu($event, conn.id)"
                  style="pointer-events: stroke;"
                />
                <path
                  v-for="conn in connections"
                  :key="'line-' + conn.id"
                  :d="getConnectionPath(conn.source, conn.target)"
                  fill="none"
                  stroke="#64748b"
                  stroke-width="1.5"
                  marker-end="url(#arrowhead)"
                  style="pointer-events: none;"
                />
              </g>
              <path
                v-if="isConnecting"
                :d="getTempLinePath()"
                fill="none"
                stroke="#3b82f6"
                stroke-width="2"
                stroke-dasharray="5,5"
                style="pointer-events: none;"
              />
            </svg>
          </div>

          <div v-if="store.currentWorkflow?.nodes.length === 0" class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-center">
              <div class="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
                <IconifyIcon icon="mdi:mouse-pointer-click" :size="48" class="text-gray-400" />
              </div>
              <h3 class="text-xl font-medium text-gray-600 mb-2">从左侧拖拽节点到这里</h3>
              <p class="text-gray-400">双击节点可编辑配置</p>
            </div>
          </div>

        <div
          v-for="node in store.currentWorkflow?.nodes"
          :key="node.id"
          class="absolute cursor-move select-none z-10"
          :class="{ 'z-30': isDraggingNode && draggingNodeId === node.id }"
          :style="{ left: node.position.x + 'px', top: node.position.y + 'px' }"
          @mousedown="startNodeDrag($event, node.id)"
          @dblclick="handleNodeDoubleClick(node)"
          @contextmenu.prevent="showNodeContextMenu($event, node.id)"
        >
          <div class="flex flex-col items-center justify-center px-4 py-3 rounded-lg border-2 bg-white shadow-md hover:shadow-lg transition-shadow relative">
            <div
              class="node-port absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-green-500 border-2 border-white cursor-crosshair hover:bg-green-600 hover:scale-125 transition-all z-20 shadow-sm"
              :data-node-id="node.id"
              :data-port-type="'input'"
              title="输入端口"
            />
            <div class="flex items-center gap-2 mb-1">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-white"
                :class="getCategoryColor(node.data.description || '基础')"
              >
                <IconifyIcon :icon="node.data.icon" :size="16" />
              </div>
              <span class="font-medium text-sm text-gray-700">{{ node.data.label }}</span>
            </div>
            <div class="flex gap-1 mt-2">
              <div class="w-2 h-2 rounded-full bg-gray-400" />
            </div>
            <div
              class="node-port absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-white cursor-crosshair hover:bg-blue-600 hover:scale-125 transition-all z-20 shadow-sm"
              :data-node-id="node.id"
              :data-port-type="'output'"
              @mousedown="startConnection($event, node.id, 'output')"
              title="输出端口"
            />
          </div>
        </div>
        </div>



        <div
          class="w-2 flex-shrink-0 cursor-col-resize flex items-center justify-center hover:bg-gray-100 transition-colors relative"
          @mousedown="startResize"
        >
          <div class="flex flex-col gap-1.5">
            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
          </div>
        </div>
        <div
          v-if="isConfigPanelOpen"
          class="bg-white border-l border-gray-200 flex flex-col flex-shrink-0 overflow-hidden"
          :style="{ width: configPanelWidth + 'px' }"
        >
        <div class="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-800">节点配置</h2>
          <Button type="text" @click="handleConfigClose">
            <IconifyIcon icon="mdi:close" :size="18" />
          </Button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-if="isMetaLoading" class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
          <div v-else-if="!selectedNode" class="text-center text-gray-500 py-12">
            请选择一个节点
          </div>
          <div v-else>
            <div class="p-4 bg-gray-50 rounded-lg">
              <div class="text-sm text-gray-500">节点ID</div>
              <Input
                v-model:value="selectedNode.id"
                class="mt-1"
                size="small"
                placeholder="请输入节点ID"
              />
            </div>
            <div class="p-4 bg-gray-50 rounded-lg">
              <div class="text-sm text-gray-500">节点名称</div>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-base font-medium text-gray-800">{{ selectedNode.data.label }}</span>
                <Tooltip v-if="currentNodeMeta?.description" :title="currentNodeMeta.description">
                  <IconifyIcon icon="mdi:help-circle" :size="16" class="text-gray-400 cursor-help" />
                </Tooltip>
              </div>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg">
              <div class="text-sm text-gray-500">节点类型</div>
              <div class="text-base text-gray-800">{{ selectedNode.data.type }}</div>
            </div>
            <div v-if="currentNodeMeta?.parsedSchema?.description" class="p-4 bg-blue-50 rounded-lg">
              <div class="text-sm text-blue-600 font-medium mb-1">配置说明</div>
              <div class="text-sm text-blue-800">{{ currentNodeMeta.parsedSchema.description }}</div>
            </div>
            <div v-if="requiredFields.length > 0" class="mb-6">
              <div class="flex items-center gap-2 mb-3">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span class="text-sm font-semibold text-gray-700">必填项</span>
              </div>
              <div class="space-y-4">
                <div v-for="field in requiredFields" :key="field.key" class="border-l-2 border-red-400 pl-3">
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-sm font-medium text-gray-700">
                      {{ field.props.label }}
                      <span class="text-red-500 ml-1">*</span>
                    </label>
                    <div class="flex items-center gap-2">
                      <span v-if="field.props.dynamic" class="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded">动态</span>
                      <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
                        <IconifyIcon icon="mdi:help-circle" :size="14" class="text-gray-400" />
                      </Tooltip>
                    </div>
                  </div>
                  <Input
                    v-if="field.type === 'Input'"
                    v-model:value="nodeConfigForm[field.key]"
                    :placeholder="field.props.placeholder"
                    class="w-full"
                  />
                  <Textarea
                    v-else-if="field.type === 'Textarea'"
                    v-model:value="nodeConfigForm[field.key]"
                    :placeholder="field.props.placeholder"
                    :rows="field.props.rows"
                    class="w-full"
                  />
                  <InputNumber
                    v-else-if="field.type === 'InputNumber'"
                    v-model:value="nodeConfigForm[field.key]"
                    :min="field.props.min"
                    class="w-full"
                  />
                  <Switch
                    v-else-if="field.type === 'Switch'"
                    :checked="nodeConfigForm[field.key]"
                    @change="(val) => { nodeConfigForm[field.key] = val; }"
                  />
                  <Select
                    v-else-if="field.type === 'Select'"
                    v-model:value="nodeConfigForm[field.key]"
                    :mode="'multiple'"
                    :placeholder="field.props.placeholder"
                    class="w-full"
                  />
                  <div v-else-if="field.type === 'StringArray'" class="mt-2">
                    <div class="bg-gray-50 rounded-lg p-3">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-gray-500">{{ field.props.label }} ({{ nodeConfigForm[field.key]?.length || 0 }})</span>
                        <Button type="text" size="small" @click="addStringArrayItem(field.key)">
                          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
                        </Button>
                      </div>
                      <div class="space-y-2">
                        <div v-for="(item, index) in (nodeConfigForm[field.key] || [])" :key="index" class="flex items-center gap-2">
                          <Input
                            v-model:value="nodeConfigForm[field.key][index]"
                            :placeholder="'请输入'"
                            class="flex-1"
                            size="small"
                          />
                          <Button type="text" size="small" @click="removeArrayItem(field.key, index)" danger>
                            <IconifyIcon icon="mdi:close" :size="14" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="field.type === 'ArrayTable'" class="mt-2">
                    <div class="bg-gray-50 rounded-lg p-3">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-gray-500">{{ field.props.label }} ({{ nodeConfigForm[field.key]?.length || 0 }})</span>
                        <Button type="text" size="small" @click="addArrayItem(field.key, field.props.itemsSchema)">
                          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
                        </Button>
                      </div>
                      <div class="space-y-3">
                        <div v-for="(item, index) in (nodeConfigForm[field.key] || [])" :key="index" class="bg-white rounded-lg p-3 border border-gray-200">
                          <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-medium text-gray-600">第 {{ index + 1 }} 项</span>
                            <Button type="text" size="small" @click="removeArrayItem(field.key, index)" danger>
                              <IconifyIcon icon="mdi:close" :size="14" />
                            </Button>
                          </div>
                          <div class="grid grid-cols-1 gap-2">
                            <div v-for="(prop, propKey) in (field.props.itemsSchema?.properties || {})" :key="propKey">
                              <label class="text-xs text-gray-500">{{ prop.title || propKey }}<span v-if="prop.$required" class="text-red-500 ml-1">*</span></label>
                              <Input
                                v-if="prop.type === 'string'"
                                :value="nodeConfigForm[field.key][index][propKey]"
                                @input="(e: any) => updateArrayItemValue(field.key, index, propKey, e.target.value)"
                                :placeholder="prop.description || '请输入'"
                                :disabled="prop.$dynamic === false"
                                class="w-full"
                                size="small"
                              />
                              <InputNumber
                                v-else-if="prop.type === 'number' || prop.type === 'integer'"
                                :value="nodeConfigForm[field.key][index][propKey]"
                                @input="(val: any) => updateArrayItemValue(field.key, index, propKey, val)"
                                :min="prop.minimum"
                                class="w-full"
                                size="small"
                              />
                              <Select
                                v-else-if="prop.enum"
                                :value="nodeConfigForm[field.key][index][propKey]"
                                @change="(val: any) => updateArrayItemValue(field.key, index, propKey, val)"
                                class="w-full"
                                size="small"
                              >
                                <option v-for="opt in prop.enum" :key="opt" :value="opt">{{ opt }}</option>
                              </Select>
                              <Switch
                                v-else-if="prop.type === 'boolean'"
                                :checked="nodeConfigForm[field.key][index][propKey]"
                                @change="(val: any) => updateArrayItemValue(field.key, index, propKey, val)"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="field.type === 'NodeArray'" class="mt-2">
                    <div class="bg-gray-50 rounded-lg p-3">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-gray-500">{{ field.props.label }} ({{ nodeConfigForm[field.key]?.length || 0 }})</span>
                        <Button type="text" size="small" @click="openNodeSelectModal(field.key)">
                          <IconifyIcon icon="mdi:plus" :size="14" /> 添加节点
                        </Button>
                      </div>
                      <div class="space-y-3">
                        <div v-for="(item, index) in (nodeConfigForm[field.key] || [])" :key="index" class="bg-white rounded-lg p-3 border border-gray-200">
                          <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                              <span class="text-xs font-medium text-gray-600">第 {{ index + 1 }} 项</span>
                              <span class="text-sm text-blue-600">
                                {{ pluginGroups.flatMap(g => g.pluginList).find(p => p.type === item.type)?.nodeName || item.type }}
                              </span>
                            </div>
                            <div class="flex items-center gap-1">
                              <Button type="text" size="small" @click="editChildNode(field.key, index)">
                                <IconifyIcon icon="mdi:pencil" :size="14" />
                              </Button>
                              <Button type="text" size="small" @click="removeArrayItem(field.key, index)" danger>
                                <IconifyIcon icon="mdi:close" :size="14" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="optionalFields.length > 0">
              <div class="flex items-center gap-2 mb-3">
                <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                <span class="text-sm font-semibold text-gray-700">选填项</span>
              </div>
              <div class="space-y-4">
                <div v-for="field in optionalFields" :key="field.key" class="border-l-2 border-gray-200 pl-3">
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-sm font-medium text-gray-600">{{ field.props.label }}</label>
                    <div class="flex items-center gap-2">
                      <span v-if="field.props.dynamic" class="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded">动态</span>
                      <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
                        <IconifyIcon icon="mdi:help-circle" :size="14" class="text-gray-400" />
                      </Tooltip>
                    </div>
                  </div>
                  <Input
                    v-if="field.type === 'Input'"
                    v-model:value="nodeConfigForm[field.key]"
                    :placeholder="field.props.placeholder"
                    class="w-full"
                  />
                  <Textarea
                    v-else-if="field.type === 'Textarea'"
                    v-model:value="nodeConfigForm[field.key]"
                    :placeholder="field.props.placeholder"
                    :rows="field.props.rows"
                    class="w-full"
                  />
                  <InputNumber
                    v-else-if="field.type === 'InputNumber'"
                    v-model:value="nodeConfigForm[field.key]"
                    :min="field.props.min"
                    class="w-full"
                  />
                  <Switch
                    v-else-if="field.type === 'Switch'"
                    :checked="nodeConfigForm[field.key]"
                    @change="(val) => { nodeConfigForm[field.key] = val; }"
                  />
                  <Select
                    v-else-if="field.type === 'Select'"
                    v-model:value="nodeConfigForm[field.key]"
                    :mode="'multiple'"
                    :placeholder="field.props.placeholder"
                    class="w-full"
                  />
                  <div v-else-if="field.type === 'StringArray'" class="mt-2">
                    <div class="bg-gray-50 rounded-lg p-3">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-gray-500">{{ field.props.label }} ({{ nodeConfigForm[field.key]?.length || 0 }})</span>
                        <Button type="text" size="small" @click="addStringArrayItem(field.key)">
                          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
                        </Button>
                      </div>
                      <div class="space-y-2">
                        <div v-for="(item, index) in (nodeConfigForm[field.key] || [])" :key="index" class="flex items-center gap-2">
                          <Input
                            v-model:value="nodeConfigForm[field.key][index]"
                            :placeholder="'请输入'"
                            class="flex-1"
                            size="small"
                          />
                          <Button type="text" size="small" @click="removeArrayItem(field.key, index)" danger>
                            <IconifyIcon icon="mdi:close" :size="14" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="field.type === 'ArrayTable'" class="mt-2">
                    <div class="bg-gray-50 rounded-lg p-3">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-gray-500">{{ field.props.label }} ({{ nodeConfigForm[field.key]?.length || 0 }})</span>
                        <Button type="text" size="small" @click="addArrayItem(field.key, field.props.itemsSchema)">
                          <IconifyIcon icon="mdi:plus" :size="14" /> 添加
                        </Button>
                      </div>
                      <div class="space-y-3">
                        <div v-for="(item, index) in (nodeConfigForm[field.key] || [])" :key="index" class="bg-white rounded-lg p-3 border border-gray-200">
                          <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-medium text-gray-600">第 {{ index + 1 }} 项</span>
                            <Button type="text" size="small" @click="removeArrayItem(field.key, index)" danger>
                              <IconifyIcon icon="mdi:close" :size="14" />
                            </Button>
                          </div>
                          <div class="grid grid-cols-1 gap-2">
                            <div v-for="(prop, propKey) in (field.props.itemsSchema?.properties || {})" :key="propKey">
                              <label class="text-xs text-gray-500">{{ prop.title || propKey }}<span v-if="prop.$required" class="text-red-500 ml-1">*</span></label>
                              <Input
                                v-if="prop.type === 'string'"
                                :value="nodeConfigForm[field.key][index][propKey]"
                                @input="(e: any) => updateArrayItemValue(field.key, index, propKey, e.target.value)"
                                :placeholder="prop.description || '请输入'"
                                :disabled="prop.$dynamic === false"
                                class="w-full"
                                size="small"
                              />
                              <InputNumber
                                v-else-if="prop.type === 'number' || prop.type === 'integer'"
                                :value="nodeConfigForm[field.key][index][propKey]"
                                @input="(val: any) => updateArrayItemValue(field.key, index, propKey, val)"
                                :min="prop.minimum"
                                class="w-full"
                                size="small"
                              />
                              <Select
                                v-else-if="prop.enum"
                                :value="nodeConfigForm[field.key][index][propKey]"
                                @change="(val: any) => updateArrayItemValue(field.key, index, propKey, val)"
                                class="w-full"
                                size="small"
                              >
                                <option v-for="opt in prop.enum" :key="opt" :value="opt">{{ opt }}</option>
                              </Select>
                              <Switch
                                v-else-if="prop.type === 'boolean'"
                                :checked="nodeConfigForm[field.key][index][propKey]"
                                @change="(val: any) => updateArrayItemValue(field.key, index, propKey, val)"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="field.type === 'NodeArray'" class="mt-2">
                    <div class="bg-gray-50 rounded-lg p-3">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-gray-500">{{ field.props.label }} ({{ nodeConfigForm[field.key]?.length || 0 }})</span>
                        <Button type="text" size="small" @click="openNodeSelectModal(field.key)">
                          <IconifyIcon icon="mdi:plus" :size="14" /> 添加节点
                        </Button>
                      </div>
                      <div class="space-y-3">
                        <div v-for="(item, index) in (nodeConfigForm[field.key] || [])" :key="index" class="bg-white rounded-lg p-3 border border-gray-200">
                          <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                              <span class="text-xs font-medium text-gray-600">第 {{ index + 1 }} 项</span>
                              <span class="text-sm text-blue-600">
                                {{ pluginGroups.flatMap(g => g.pluginList).find(p => p.type === item.type)?.nodeName || item.type }}
                              </span>
                            </div>
                            <div class="flex items-center gap-1">
                              <Button type="text" size="small" @click="editChildNode(field.key, index)">
                                <IconifyIcon icon="mdi:pencil" :size="14" />
                              </Button>
                              <Button type="text" size="small" @click="removeArrayItem(field.key, index)" danger>
                                <IconifyIcon icon="mdi:close" :size="14" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="requiredFields.length === 0 && optionalFields.length === 0" class="text-center text-gray-500 py-4">
              该节点暂无配置项
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-gray-200">
          <Button type="primary" block @click="handleSaveConfig">保存配置</Button>
        </div>
      </div>
    </div>
    </div>
  </div>

  <div v-if="showNodeSelectModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-[900px] h-[600px] flex flex-col">
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-800">选择子节点</h2>
        <Button type="text" @click="closeNodeSelectModal">
          <IconifyIcon icon="mdi:close" :size="18" />
        </Button>
      </div>
      <div class="flex-1 flex overflow-hidden">
        <div class="w-1/2 border-r border-gray-200 overflow-y-auto p-4">
          <div v-if="isPluginLoading" class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
          <div v-else>
            <div v-for="group in pluginGroups" :key="group.groupKey">
              <h3 class="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" :class="getCategoryColor(group.groupName)" />
                {{ group.groupName }}
              </h3>
              <div class="space-y-2">
                <div
                  v-for="plugin in group.pluginList"
                  :key="plugin.type"
                  class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border"
                  :class="selectedChildNodeType === plugin.type ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'"
                  @click="selectChildNode(plugin.type)"
                >
                  <div
                    class="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    :class="getCategoryColor(group.groupName)"
                  >
                    <IconifyIcon :icon="plugin.icon" :size="20" />
                  </div>
                  <div class="flex-1">
                    <div class="text-sm font-medium text-gray-800">{{ plugin.nodeName }}</div>
                    <div class="text-xs text-gray-500">{{ plugin.description }}</div>
                  </div>
                  <div v-if="selectedChildNodeType === plugin.type">
                    <IconifyIcon icon="mdi:check-circle" :size="18" class="text-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="w-1/2 overflow-y-auto p-4">
          <div v-if="!selectedChildNodeType" class="flex items-center justify-center h-full text-gray-500">
            请从左侧选择一个节点
          </div>
          <div v-else-if="isMetaLoading" class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
          <div v-else>
            <div class="p-4 bg-blue-50 rounded-lg mb-4">
              <div class="flex items-center gap-2">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                  :class="getCategoryColor(pluginGroups.flatMap(g => g.pluginList).find(p => p.type === selectedChildNodeType)?.category || '基础')"
                >
                  <IconifyIcon :icon="pluginGroups.flatMap(g => g.pluginList).find(p => p.type === selectedChildNodeType)?.icon" :size="20" />
                </div>
                <div>
                  <div class="text-base font-medium text-gray-800">{{ selectedChildNodeLabel }}</div>
                  <div class="text-xs text-gray-500">{{ selectedChildNodeType }}</div>
                </div>
              </div>
              <div v-if="selectedChildNodeMeta?.description" class="mt-2 text-sm text-blue-800">
                {{ selectedChildNodeMeta.description }}
              </div>
            </div>
            <div v-if="selectedChildNodeMeta?.parsedSchema?.description" class="p-4 bg-gray-50 rounded-lg mb-4">
              <div class="text-sm text-gray-600 font-medium mb-1">配置说明</div>
              <div class="text-sm text-gray-800">{{ selectedChildNodeMeta.parsedSchema.description }}</div>
            </div>
            <div v-if="selectedChildNodeMeta?.formProperties">
              <div v-if="Object.keys(selectedChildNodeMeta.formProperties).filter(k => k !== '$schema').length === 0" class="text-center text-gray-500 py-4">
                该节点暂无配置项
              </div>
              <div v-else>
                <div class="space-y-4">
                  <div v-for="(prop, propKey) in selectedChildNodeMeta.formProperties" :key="propKey" v-show="propKey !== '$schema'">
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-sm font-medium text-gray-700">
                        {{ prop.title || propKey }}
                        <span v-if="prop.$required" class="text-red-500 ml-1">*</span>
                      </label>
                      <div class="flex items-center gap-2">
                        <span v-if="prop.$dynamic === true" class="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded">动态</span>
                        <Tooltip v-if="prop.description" :title="prop.description">
                          <IconifyIcon icon="mdi:help-circle" :size="14" class="text-gray-400" />
                        </Tooltip>
                      </div>
                    </div>
                    <Input
                      v-if="prop.type === 'string' || prop.anyOf"
                      v-model:value="childNodeConfigForm[propKey]"
                      :placeholder="prop.$dynamic === true ? '支持动态表达式，如 {{ variable }}' : prop.description || '请输入'"
                      class="w-full"
                      size="small"
                    />
                    <InputNumber
                      v-else-if="prop.type === 'number' || prop.type === 'integer'"
                      v-model:value="childNodeConfigForm[propKey]"
                      :min="prop.minimum"
                      class="w-full"
                      size="small"
                    />
                    <Switch
                      v-else-if="prop.type === 'boolean'"
                      :checked="childNodeConfigForm[propKey]"
                      @change="(val) => { childNodeConfigForm[propKey] = val; }"
                    />
                    <Textarea
                      v-else-if="prop.type === 'object' || prop.type === 'array'"
                      :value="typeof childNodeConfigForm[propKey] === 'string' ? childNodeConfigForm[propKey] : JSON.stringify(childNodeConfigForm[propKey], null, 2)"
                      @input="(e: any) => { childNodeConfigForm[propKey] = e.target.value; }"
                      :placeholder="prop.description || '请输入JSON格式数据'"
                      rows="3"
                      class="w-full"
                      size="small"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="p-4 border-t border-gray-200 flex items-center justify-end gap-2">
        <Button @click="closeNodeSelectModal">取消</Button>
        <Button type="primary" @click="currentArrayIndex >= 0 ? confirmEditChildNode() : confirmAddChildNode()">
          {{ currentArrayIndex >= 0 ? '确定修改' : '确定添加' }}
        </Button>
      </div>
    </div>
  </div>

  <div
    v-if="contextMenu.show"
    class="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[120px]"
    :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    @click.stop
  >
    <div
      v-if="contextMenu.type === 'node'"
      class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
      @click="deleteSelectedNode"
    >
      删除节点
    </div>
    <div
      v-if="contextMenu.type === 'connection'"
      class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
      @click="deleteSelectedConnection"
    >
      删除连线
    </div>
  </div>
</template>
