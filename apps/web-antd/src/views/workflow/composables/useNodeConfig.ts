import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';

export function useNodeConfig(pluginMetaCache: any, loadPluginMeta: any, isTaskRef: any, resolveRef: any, pluginGroups: any) {
  const selectedNode = ref<any>(null);
  const nodeConfigForm = ref<any>({});
  const isConfigPanelOpen = ref(false);
  const configPanelWidth = ref(350);
  const isResizing = ref(false);

  const showNodeSelectModal = ref(false);
  const currentArrayFieldKey = ref('');
  const currentArrayIndex = ref(-1);
  const selectedChildNodeType = ref('');
  const selectedChildNodeMeta = ref<any>(null);
  const childNodeConfigForm = ref<any>({});
  const selectedChildNodeLabel = ref('');

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
            if (properties[key].type === 'object') {
              const savedValue = savedConfig[key];
              if (Array.isArray(savedValue)) {
                nodeConfigForm.value[key] = savedValue;
              } else {
                nodeConfigForm.value[key] = Object.entries(savedValue || {}).map(([k, v]: [string, any]) => ({ key: k, value: v }));
              }
            } else {
              nodeConfigForm.value[key] = savedConfig[key];
            }
          } else if (properties[key].type === 'boolean') {
            nodeConfigForm.value[key] = false;
          } else if (properties[key].type === 'object') {
            nodeConfigForm.value[key] = [];
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
      fieldType: fieldSchema.type,
    };

    if (fieldSchema.anyOf) {
      return {
        type: 'AnyOfRadio',
        props: {
          ...renderProps,
          modelValue: value,
          options: fieldSchema.anyOf.map((opt: any) => ({
            value: opt.const !== undefined ? opt.const : opt.type,
            label: opt.title || (opt.const !== undefined ? opt.const.toString() : opt.type),
          })),
          'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
        },
      };
    }

    switch (fieldSchema.type) {
      case 'string':
        if (fieldSchema.enum) {
          return {
            type: 'EnumSelect',
            props: {
              ...renderProps,
              modelValue: value,
              options: fieldSchema.enum,
              'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
              placeholder: description || '请选择',
            },
          };
        }
        return {
          type: 'Input',
          props: {
            ...renderProps,
            modelValue: value,
            'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
            placeholder: description || '请输入',
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
          type: 'ObjectInput',
          props: {
            ...renderProps,
            modelValue: value || {},
            'onUpdate:modelValue': (val: any) => { nodeConfigForm.value[fieldKey] = val; },
            placeholder: '请添加键值对',
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
        if (prop.type === 'boolean') {
          newItem[key] = false;
        }
      });
    }
    nodeConfigForm.value[fieldKey] = [...currentValue, newItem];
  }

  function removeArrayItem(fieldKey: string, index: number) {
    const currentValue = nodeConfigForm.value[fieldKey] || [];
    nodeConfigForm.value[fieldKey] = currentValue.filter((_: any, i: number) => i !== index);
  }

  function addStringArrayItem(fieldKey: string) {
    const currentValue = nodeConfigForm.value[fieldKey] || [];
    nodeConfigForm.value[fieldKey] = [...currentValue, ''];
  }

  function addObjectItem(fieldKey: string) {
    const currentValue = nodeConfigForm.value[fieldKey] || [];
    nodeConfigForm.value[fieldKey] = [...currentValue, { key: '', value: '' }];
  }

  function updateObjectKey(fieldKey: string, index: number, newKey: string) {
    const currentValue = nodeConfigForm.value[fieldKey] || [];
    currentValue[index].key = newKey;
    nodeConfigForm.value[fieldKey] = [...currentValue];
  }

  function updateObjectValue(fieldKey: string, index: number, value: string) {
    const currentValue = nodeConfigForm.value[fieldKey] || [];
    currentValue[index].value = value;
    nodeConfigForm.value[fieldKey] = [...currentValue];
  }

  function removeObjectItem(fieldKey: string, index: number) {
    const currentValue = nodeConfigForm.value[fieldKey] || [];
    nodeConfigForm.value[fieldKey] = currentValue.filter((_: any, i: number) => i !== index);
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

  function handleSaveConfig() {
    if (!selectedNode.value) return;

    const missingFields: string[] = [];
    
    requiredFields.value.forEach(field => {
      const value = nodeConfigForm.value[field.props.key];
      if (value === undefined || value === null || value === '') {
        missingFields.push(field.props.label);
      }
    });

    if (missingFields.length > 0) {
      message.error(`请填写必填项：${missingFields.join('、')}`);
      return;
    }

    const config = { ...nodeConfigForm.value };
    if (currentNodeMeta.value && currentNodeMeta.value.formProperties) {
      Object.keys(currentNodeMeta.value.formProperties).forEach(key => {
        if (key !== '$schema' && currentNodeMeta.value.formProperties[key].type === 'object') {
          const value = config[key];
          if (Array.isArray(value)) {
            const obj: Record<string, any> = {};
            value.forEach((item: any) => {
              if (item.key) {
                obj[item.key] = item.value;
              }
            });
            config[key] = obj;
          }
        }
      });
    }
    selectedNode.value.data.config = config;
    message.success('节点配置已更新');
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
    const template = pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === nodeType);
    selectedChildNodeLabel.value = template?.nodeName || '';
    
    const meta = await loadPluginMeta(nodeType);
    if (meta && meta.formProperties) {
      selectedChildNodeMeta.value = meta;
      childNodeConfigForm.value = {};
      Object.keys(meta.formProperties).forEach(key => {
        if (key !== '$schema') {
          if (meta.formProperties[key].type === 'boolean') {
            childNodeConfigForm.value[key] = false;
          } else if (meta.formProperties[key].type === 'object') {
            childNodeConfigForm.value[key] = [];
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
    
    const template = pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === item.type);
    selectedChildNodeLabel.value = template?.nodeName || '';
    
    loadPluginMeta(item.type).then((meta: any) => {
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

  return {
    selectedNode,
    nodeConfigForm,
    isConfigPanelOpen,
    configPanelWidth,
    isResizing,
    showNodeSelectModal,
    currentArrayFieldKey,
    currentArrayIndex,
    selectedChildNodeType,
    selectedChildNodeMeta,
    childNodeConfigForm,
    selectedChildNodeLabel,
    handleNodeDoubleClick,
    handleConfigClose,
    startResize,
    addArrayItem,
    removeArrayItem,
    addStringArrayItem,
    addObjectItem,
    updateObjectKey,
    updateObjectValue,
    removeObjectItem,
    updateArrayItemValue,
    currentNodeMeta,
    requiredFields,
    optionalFields,
    handleSaveConfig,
    openNodeSelectModal,
    closeNodeSelectModal,
    selectChildNode,
    confirmAddChildNode,
    editChildNode,
    confirmEditChildNode,
  };
}
