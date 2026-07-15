import { ref, computed, reactive } from 'vue';
import { message } from 'ant-design-vue';

export interface SchemaNode {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  enum?: string[];
  anyOf?: SchemaNode[];
  $ref?: string;
  $defs?: Record<string, SchemaNode>;
  items?: SchemaNode;
  minItems?: number;
  minimum?: number;
  $dynamic?: boolean;
  $required?: boolean;
  const?: any;
}

export interface FormMeta {
  parsedSchema?: SchemaNode;
  formProperties: Record<string, SchemaNode>;
  formRequired: string[];
  formDefs: Record<string, SchemaNode>;
}

export interface RenderedField {
  type: string;
  props: {
    key: string;
    label: string;
    tooltip: string;
    required: boolean;
    dynamic: boolean;
    fieldType?: string;
    modelValue?: any;
    'onUpdate:modelValue'?: (val: any) => void;
    [key: string]: any;
  };
}

export interface AnyOfOption {
  value: string;
  label: string;
  schema?: SchemaNode;
  subFields?: RenderedField[];
}

function internalResolveRef(refPath: string, defs: Record<string, SchemaNode>): SchemaNode | undefined {
  const parts = refPath.split('/');
  const key = parts[parts.length - 1];
  return key ? defs[key] : undefined;
}

function internalIsTaskRef(schema: SchemaNode): boolean {
  return schema.$ref?.endsWith('idp_core_models_tasks_Task') === true;
}

export function useNodeConfig(pluginMetaCache: any, loadPluginMeta: any, _isTaskRef: any, _resolveRef: any, pluginGroups: any) {
  const selectedNode = ref<any>(null);
  const nodeConfigForm = reactive<any>({});
  const isConfigPanelOpen = ref(false);
  const configPanelWidth = ref(500);
  const isResizing = ref(false);

  const showNodeSelectModal = ref(false);
  const currentArrayFieldKey = ref('');
  const currentArrayIndex = ref(-1);
  const selectedChildNodeType = ref('');
  const selectedChildNodeMeta = ref<any>(null);
  const childNodeConfigForm = reactive<any>({});
  const selectedChildNodeLabel = ref('');

  function extractSubFields(schema: SchemaNode, defs: Record<string, SchemaNode>): RenderedField[] {
    if (!schema.properties) return [];
    const mergedDefs = { ...defs, ...(schema.$defs || {}) };
    return Object.keys(schema.properties)
      .filter(key => key !== '$schema')
      .map(subKey => {
        const subIsRequired = (schema.required || []).includes(subKey);
        return renderFormField(schema.properties!, subKey, subIsRequired, mergedDefs);
      });
  }

  function createFieldProps(
    fieldKey: string,
    fieldSchema: SchemaNode,
    isRequired: boolean,
    value: any,
    onUpdate: (val: any) => void
  ): RenderedField['props'] {
    return {
      key: fieldKey,
      label: fieldSchema.title || fieldKey,
      tooltip: fieldSchema.description || '',
      required: isRequired,
      dynamic: fieldSchema.$dynamic === true,
      fieldType: fieldSchema.type,
      modelValue: value,
      'onUpdate:modelValue': onUpdate,
    };
  }

  function initFormFieldValue(schema: SchemaNode, defs: Record<string, SchemaNode> = {}): any {
    if (schema.$ref) {
      const refSchema = internalResolveRef(schema.$ref, defs);
      if (refSchema) {
        return initFormFieldValue(refSchema, { ...defs, ...(refSchema.$defs || {}) });
      }
      return {};
    }

    if (schema.anyOf) {
      return undefined;
    }

    switch (schema.type) {
      case 'boolean':
        return false;
      case 'object':
        return [];
      case 'array':
        return [];
      case 'string':
        return '';
      case 'number':
      case 'integer':
        return undefined;
      default:
        return undefined;
    }
  }

  function serializeFieldValue(schema: SchemaNode, value: any, defs: Record<string, SchemaNode> = {}): any {
    if (schema.$ref) {
      const refSchema = internalResolveRef(schema.$ref, defs);
      if (refSchema) {
        return serializeFieldValue(refSchema, value, { ...defs, ...(refSchema.$defs || {}) });
      }
      return value;
    }

    if (schema.type === 'object' && Array.isArray(value)) {
      const obj: Record<string, any> = {};
      value.forEach((item: any) => {
        if (item.key) {
          obj[item.key] = item.value;
        }
      });
      return obj;
    }

    if (schema.type === 'array' && value && Array.isArray(value)) {
      return value.map((item: any) => {
        if (schema.items) {
          return serializeFieldValue(schema.items, item, defs);
        }
        return item;
      });
    }

    return value;
  }

  function resolveStringField(
    fieldKey: string,
    fieldSchema: SchemaNode,
    isRequired: boolean,
    value: any,
    onUpdate: (val: any) => void
  ): RenderedField {
    if (fieldSchema.enum) {
      return {
        type: 'EnumSelect',
        props: {
          ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
          options: fieldSchema.enum,
          placeholder: fieldSchema.description || '请选择',
        },
      };
    }
    return {
      type: 'Input',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        placeholder: fieldSchema.description || '请输入',
      },
    };
  }

  function resolveNumericField(
    fieldKey: string,
    fieldSchema: SchemaNode,
    isRequired: boolean,
    value: any,
    onUpdate: (val: any) => void
  ): RenderedField {
    return {
      type: 'InputNumber',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        min: fieldSchema.minimum,
      },
    };
  }

  function resolveBooleanField(
    fieldKey: string,
    fieldSchema: SchemaNode,
    isRequired: boolean,
    value: any,
    onUpdate: (val: any) => void
  ): RenderedField {
    return {
      type: 'Switch',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        checked: value,
        onChange: onUpdate,
      },
    };
  }

  function resolveArrayField(
    fieldKey: string,
    fieldSchema: SchemaNode,
    isRequired: boolean,
    value: any,
    onUpdate: (val: any) => void,
    defs: Record<string, SchemaNode>
  ): RenderedField {
    const itemsSchema = fieldSchema.items;

    if (itemsSchema && internalIsTaskRef(itemsSchema)) {
      return {
        type: 'NodeArray',
        props: {
          ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
          itemsSchema,
          minItems: fieldSchema.minItems,
        },
      };
    }

    if (itemsSchema && itemsSchema.$ref) {
      const refSchema = internalResolveRef(itemsSchema.$ref, defs);
      if (refSchema && refSchema.properties) {
        return {
          type: 'ArrayTable',
          props: {
            ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
            itemsSchema: refSchema,
            minItems: fieldSchema.minItems,
          },
        };
      }
    }

    if (itemsSchema && itemsSchema.type === 'object') {
      return {
        type: 'ArrayTable',
        props: {
          ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
          itemsSchema,
          minItems: fieldSchema.minItems,
        },
      };
    }

    if (itemsSchema && itemsSchema.type === 'string') {
      return {
        type: 'StringArray',
        props: {
          ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
          minItems: fieldSchema.minItems,
        },
      };
    }

    if (itemsSchema && (itemsSchema.type === 'integer' || itemsSchema.type === 'number')) {
      return {
        type: 'NumberArray',
        props: {
          ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
          minItems: fieldSchema.minItems,
        },
      };
    }

    return {
      type: 'Textarea',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, typeof value === 'string' ? value : JSON.stringify(value, null, 2), onUpdate),
        placeholder: fieldSchema.minItems && fieldSchema.minItems > 0 ? `至少${fieldSchema.minItems}项，JSON数组格式` : fieldSchema.description || '请输入JSON数组',
        rows: 4,
      },
    };
  }

  function resolveObjectField(
    fieldKey: string,
    fieldSchema: SchemaNode,
    isRequired: boolean,
    value: any,
    onUpdate: (val: any) => void
  ): RenderedField {
    return {
      type: 'ObjectInput',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
        placeholder: '请添加键值对',
      },
    };
  }

  function resolveAnyOfField(
    fieldKey: string,
    fieldSchema: SchemaNode,
    isRequired: boolean,
    value: any,
    onUpdate: (val: any) => void,
    defs: Record<string, SchemaNode>
  ): RenderedField {
    const options: AnyOfOption[] = fieldSchema.anyOf!.map((opt: SchemaNode, index: number) => {
      if (opt.$ref) {
        const refSchema = internalResolveRef(opt.$ref, defs);
        const refTitle = refSchema?.title || opt.title || '未命名';
        return {
          value: opt.$ref,
          label: refTitle,
          schema: refSchema,
          subFields: refSchema ? extractSubFields(refSchema, { ...defs, ...(refSchema.$defs || {}) }) : [],
        };
      }
      return {
        value: opt.const !== undefined ? opt.const : (opt.$ref || opt.type || `option_${index}`),
        label: opt.title || (opt.const !== undefined ? opt.const.toString() : opt.type || `选项 ${index + 1}`),
        schema: opt,
        subFields: extractSubFields(opt, defs),
      };
    });

    return {
      type: 'AnyOfRadio',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        options,
      },
    };
  }

  function resolveRefField(
    fieldKey: string,
    fieldSchema: SchemaNode,
    isRequired: boolean,
    value: any,
    onUpdate: (val: any) => void,
    defs: Record<string, SchemaNode>
  ): RenderedField {
    if (internalIsTaskRef(fieldSchema)) {
      return {
        type: 'NodeArray',
        props: {
          ...createFieldProps(fieldKey, fieldSchema, isRequired, value || [], onUpdate),
          itemsSchema: fieldSchema,
          minItems: 0,
        },
      };
    }

    const refSchema = internalResolveRef(fieldSchema.$ref!, defs);
    if (refSchema) {
      if (refSchema.properties) {
        return {
          type: 'RefObject',
          props: {
            ...createFieldProps(fieldKey, fieldSchema, isRequired, value || {}, onUpdate),
            subFields: extractSubFields(refSchema, { ...defs, ...(refSchema.$defs || {}) }),
          },
        };
      }

      if (refSchema.type) {
        const mergedSchema: SchemaNode = {
          ...refSchema,
          title: fieldSchema.title || refSchema.title,
          description: fieldSchema.description || refSchema.description,
          $dynamic: fieldSchema.$dynamic,
          $required: fieldSchema.$required,
        };
        const tempProperties: Record<string, SchemaNode> = { [fieldKey]: mergedSchema };
        return renderFormField(tempProperties, fieldKey, isRequired, defs);
      }
    }

    return {
      type: 'Input',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        placeholder: fieldSchema.description || `未解析的引用: ${fieldSchema.$ref}`,
      },
    };
  }

  const TYPE_RESOLVERS: Record<string, (
    fieldKey: string,
    fieldSchema: SchemaNode,
    isRequired: boolean,
    value: any,
    onUpdate: (val: any) => void,
    defs: Record<string, SchemaNode>
  ) => RenderedField> = {
    string: resolveStringField,
    number: resolveNumericField,
    integer: resolveNumericField,
    boolean: resolveBooleanField,
    array: resolveArrayField,
    object: resolveObjectField,
  };

  function renderFormField(
    properties: Record<string, SchemaNode>,
    fieldKey: string,
    isRequired: boolean,
    defs: Record<string, SchemaNode> = {}
  ): RenderedField {
    const fieldSchema = properties[fieldKey];
    if (!fieldSchema) {
      return {
        type: 'Input',
        props: {
          key: fieldKey,
          label: fieldKey,
          tooltip: '',
          required: isRequired,
          dynamic: false,
          modelValue: undefined,
          'onUpdate:modelValue': () => {},
          placeholder: '未知字段',
        },
      };
    }

    const value = nodeConfigForm[fieldKey];
    const onUpdate = (val: any) => { nodeConfigForm[fieldKey] = val; };

    if (fieldSchema.anyOf) {
      return resolveAnyOfField(fieldKey, fieldSchema, isRequired, value, onUpdate, defs);
    }

    if (fieldSchema.$ref) {
      return resolveRefField(fieldKey, fieldSchema, isRequired, value, onUpdate, defs);
    }

    if (fieldSchema.type) {
      const resolver = TYPE_RESOLVERS[fieldSchema.type];
      if (resolver) {
        return resolver(fieldKey, fieldSchema, isRequired, value, onUpdate, defs);
      }
    }

    return {
      type: 'Input',
      props: {
        ...createFieldProps(fieldKey, fieldSchema, isRequired, value, onUpdate),
        placeholder: fieldSchema.description || '请输入',
      },
    };
  }

  async function handleNodeDoubleClick(node: any) {
    selectedNode.value = node;
    isConfigPanelOpen.value = true;

    const meta = await loadPluginMeta(node.data.type);
    if (meta && meta.formProperties) {
      const savedConfig = node.data.config || {};
      const properties = meta.formProperties || {};
      const formDefs = meta.formDefs || {};

      Object.keys(nodeConfigForm).forEach(key => delete nodeConfigForm[key]);

      Object.keys(properties).forEach(key => {
        if (key !== '$schema') {
          const prop = properties[key];
          if (savedConfig[key] !== undefined) {
            if (prop.type === 'object') {
              const savedValue = savedConfig[key];
              nodeConfigForm[key] = Array.isArray(savedValue) ? savedValue : Object.entries(savedValue || {}).map(([k, v]: [string, any]) => ({ key: k, value: v }));
            } else {
              nodeConfigForm[key] = savedConfig[key];
            }
          } else {
            nodeConfigForm[key] = initFormFieldValue(prop, formDefs);
          }
        }
      });
    }
  }

  function handleConfigClose() {
    isConfigPanelOpen.value = false;
    selectedNode.value = null;
    Object.keys(nodeConfigForm).forEach(key => delete nodeConfigForm[key]);
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

  function addArrayItem(fieldKey: string, itemsSchema: SchemaNode) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    const newItem: Record<string, any> = {};

    const props = itemsSchema?.properties;
    if (props) {
      Object.keys(props).forEach(key => {
        const propSchema = props[key];
        if (propSchema) {
          newItem[key] = initFormFieldValue(propSchema);
        }
      });
    }

    nodeConfigForm[fieldKey] = [...currentValue, newItem];
  }

  function removeArrayItem(fieldKey: string, index: number) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    nodeConfigForm[fieldKey] = currentValue.filter((_: any, i: number) => i !== index);
  }

  function addStringArrayItem(fieldKey: string) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    nodeConfigForm[fieldKey] = [...currentValue, ''];
  }

  function addNumberArrayItem(fieldKey: string) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    nodeConfigForm[fieldKey] = [...currentValue, 0];
  }

  function addObjectItem(fieldKey: string) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    nodeConfigForm[fieldKey] = [...currentValue, { key: '', value: '' }];
  }

  function updateObjectKey(fieldKey: string, index: number, newKey: string) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    currentValue[index].key = newKey;
    nodeConfigForm[fieldKey] = [...currentValue];
  }

  function updateObjectValue(fieldKey: string, index: number, value: string) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    currentValue[index].value = value;
    nodeConfigForm[fieldKey] = [...currentValue];
  }

  function removeObjectItem(fieldKey: string, index: number) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    nodeConfigForm[fieldKey] = currentValue.filter((_: any, i: number) => i !== index);
  }

  function updateArrayItemValue(fieldKey: string, index: number, itemKey: string, value: any) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    currentValue[index][itemKey] = value;
    nodeConfigForm[fieldKey] = [...currentValue];
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
        return (prop.type || prop.$ref || prop.anyOf) && (prop.$required === true || formRequired.includes(key));
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
        return (prop.type || prop.$ref || prop.anyOf) && prop.$required !== true && !formRequired.includes(key);
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
      const value = nodeConfigForm[field.props.key];
      if (value === undefined || value === null || value === '') {
        missingFields.push(field.props.label);
      }
    });

    if (missingFields.length > 0) {
      message.error(`请填写必填项：${missingFields.join('、')}`);
      return;
    }

    const config: Record<string, any> = {};
    const meta = currentNodeMeta.value;

    if (meta && meta.formProperties) {
      Object.keys(meta.formProperties).forEach(key => {
        if (key !== '$schema') {
          config[key] = serializeFieldValue(meta.formProperties[key], nodeConfigForm[key], meta.formDefs || {});
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
    Object.keys(childNodeConfigForm).forEach(key => delete childNodeConfigForm[key]);
    showNodeSelectModal.value = true;
  }

  function closeNodeSelectModal() {
    showNodeSelectModal.value = false;
    currentArrayFieldKey.value = '';
    currentArrayIndex.value = -1;
    selectedChildNodeType.value = '';
    selectedChildNodeMeta.value = null;
    Object.keys(childNodeConfigForm).forEach(key => delete childNodeConfigForm[key]);
  }

  async function selectChildNode(nodeType: string) {
    selectedChildNodeType.value = nodeType;
    const template = pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === nodeType);
    selectedChildNodeLabel.value = template?.nodeName || '';

    const meta = await loadPluginMeta(nodeType);
    if (meta && meta.formProperties) {
      selectedChildNodeMeta.value = meta;
      Object.keys(childNodeConfigForm).forEach(key => delete childNodeConfigForm[key]);

      Object.keys(meta.formProperties).forEach(key => {
        if (key !== '$schema') {
          childNodeConfigForm[key] = initFormFieldValue(meta.formProperties[key], meta.formDefs || {});
        }
      });
    }
  }

  function confirmAddChildNode() {
    if (!selectedChildNodeType.value) {
      message.error('请选择一个节点');
      return;
    }

    const currentValue = nodeConfigForm[currentArrayFieldKey.value] || [];
    const newItem = {
      type: selectedChildNodeType.value,
      ...childNodeConfigForm,
    };

    nodeConfigForm[currentArrayFieldKey.value] = [...currentValue, newItem];
    message.success(`已添加 ${selectedChildNodeLabel.value} 节点`);
    closeNodeSelectModal();
  }

  function editChildNode(fieldKey: string, index: number) {
    const currentValue = nodeConfigForm[fieldKey] || [];
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
        Object.keys(childNodeConfigForm).forEach(key => delete childNodeConfigForm[key]);
        Object.assign(childNodeConfigForm, item);
        showNodeSelectModal.value = true;
      }
    });
  }

  function confirmEditChildNode() {
    if (!selectedChildNodeType.value || currentArrayIndex.value < 0) return;

    const currentValue = nodeConfigForm[currentArrayFieldKey.value] || [];
    currentValue[currentArrayIndex.value] = {
      type: selectedChildNodeType.value,
      ...childNodeConfigForm,
    };
    nodeConfigForm[currentArrayFieldKey.value] = [...currentValue];
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
    addNumberArrayItem,
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
