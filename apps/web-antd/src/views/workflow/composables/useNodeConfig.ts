import { ref, computed, nextTick, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { WorkflowNode } from '#/types/workflow';
import { flowControlNodeRegistry } from '../config/workflow-node-config';
import { UI_CONFIG } from '../config/ui-config';
import type { SchemaNode as ParserSchemaNode } from './useSchemaParser';
import { internalResolveRef, initFormFieldValue, serializeFieldValue } from './useSchemaParser';
import { renderFormField } from './useFormFieldResolver';
import { validateAllNodes, validateNodeConfig } from './useFieldValidation';
import { useChildNodeSelection } from './useChildNodeSelection';
import { useFormState } from './useFormState';
import { useWorkflowStore } from '#/store/workflow';

const store = useWorkflowStore();

/**
 * Watch nodeConfigForm and sync changes back to the store's node data.config in real-time.
 * This ensures downstream VarPicker can see upstream outputKeys immediately without requiring Save.
 */
function setupRealtimeConfigSync(
  nodeConfigForm: Record<string, any>,
  selectedNode: ReturnType<typeof ref<WorkflowNode | null>>,
) {
  watch(
    () => ({ ...nodeConfigForm }),
    () => {
      if (selectedNode.value) {
        // Merge instead of replace to preserve flow control fields (cases/defaults/then/else)
        // that are managed separately through handleConnection, not through nodeConfigForm
        selectedNode.value.data.config = {
          ...selectedNode.value.data.config,
          ...nodeConfigForm,
        };
      }
    },
    { deep: true },
  );
}

export interface FormMeta {
  parsedSchema?: ParserSchemaNode;
  formProperties: Record<string, ParserSchemaNode>;
  formRequired: string[];
  formDefs: Record<string, ParserSchemaNode>;
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

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    nodeId: string;
    nodeLabel: string;
    missingFields: string[];
  }>;
}

interface PluginMeta {
  formProperties?: Record<string, ParserSchemaNode>;
  formRequired?: string[];
  formDefs?: Record<string, ParserSchemaNode>;
}

export function useNodeConfig(
  pluginMetaCache: { value: Record<string, PluginMeta> },
  loadPluginMeta: (type: string) => Promise<PluginMeta | null>,
  _isTaskRef: any,
  _resolveRef: any,
  pluginGroups: any
) {
  const selectedNode = ref<WorkflowNode | null>(null);

  const {
    nodeConfigForm,
    isConfigPanelOpen,
    configPanelWidth,
    isResizing,
    clearForm,
    addArrayItem,
    removeArrayItem,
    addStringArrayItem,
    addNumberArrayItem,
    addObjectItem,
    updateObjectKey,
    updateObjectValue,
    removeObjectItem,
    addOnResumeItem,
    updateOnResumeField,
    removeOnResumeItem,
    addInputsItem,
    updateInputsField,
    removeInputsItem,
    addTriggersItem,
    updateTriggersField,
    removeTriggersItem,
    updateArrayItemValue,
    startResize,
    handleConfigClose,
  } = useFormState();

  const {
    showNodeSelectModal,
    currentArrayFieldKey: _currentArrayFieldKey,
    currentArrayIndex,
    selectedChildNodeType,
    selectedChildNodeMeta,
    childNodeConfigForm,
    selectedChildNodeLabel,
    openNodeSelectModal,
    closeNodeSelectModal,
    selectChildNode,
    confirmAddChildNode,
    editChildNode,
    confirmEditChildNode,
  } = useChildNodeSelection(pluginMetaCache, loadPluginMeta, pluginGroups, nodeConfigForm);

  const DEFAULT_PANEL_WIDTH = UI_CONFIG.configPanel.defaultWidth;

  // Set up real-time sync so form changes immediately reflect in the store
  setupRealtimeConfigSync(nodeConfigForm, selectedNode);

  async function handleNodeDoubleClick(node: WorkflowNode) {
    // 先清除选中状态，等下一帧再设置新节点，避免组件更新时出现 null 引用
    selectedNode.value = null;
    store.setSelectedNodeId(null);
    await nextTick();

    selectedNode.value = node;
    store.setSelectedNodeId(node.id);
    isConfigPanelOpen.value = true;
    configPanelWidth.value = DEFAULT_PANEL_WIDTH;

    const strategy = flowControlNodeRegistry.get(node.data.type);
    const hasStrategy = flowControlNodeRegistry.hasStrategy(node.data.type);

    if (flowControlNodeRegistry.isFlowControlContainer(node.data.type) || hasStrategy) {
      const savedConfig = node.data.config || {};
      const newConfig = strategy.initConfig(savedConfig);

      clearForm();
      Object.assign(nodeConfigForm, newConfig);
    } else {
      const meta = await loadPluginMeta(node.data.type);
      if (meta && meta.formProperties) {
        const savedConfig = node.data.config || {};
        const properties = meta.formProperties || {};
        const formDefs = meta.formDefs || {};

        clearForm();

        Object.keys(properties).forEach(key => {
          if (key !== '$schema') {
            const prop = properties[key];
            if (!prop) return;
            if (savedConfig[key] !== undefined) {
              if (prop.anyOf) {
                const savedValue = savedConfig[key];
                let selectedIndex = 0;
                for (let i = 0; i < prop.anyOf.length; i++) {
                  const option = prop.anyOf[i];
                  if (!option) continue;
                  if (option.const !== undefined && option.const === savedValue) {
                    selectedIndex = i;
                    break;
                  }
                  if (option.default !== undefined && option.default === savedValue) {
                    selectedIndex = i;
                    break;
                  }
                  if (option.type && option.type === typeof savedValue) {
                    selectedIndex = i;
                    break;
                  }
                  if (option.$ref) {
                    const refSchema = internalResolveRef(option.$ref, formDefs);
                    if (refSchema && refSchema.type === 'object' && typeof savedValue === 'object') {
                      selectedIndex = i;
                      break;
                    }
                  }
                }
                nodeConfigForm[key] = selectedIndex;
                if (typeof savedValue === 'object' && savedValue !== null) {
                  nodeConfigForm[key + '_values'] = savedValue;
                }
              } else if (prop.type === 'object') {
                const savedValue = savedConfig[key];
                if (prop.additionalProperties && prop.additionalProperties.type === 'array') {
                  nodeConfigForm[key] = savedValue || {};
                } else {
                  nodeConfigForm[key] = Array.isArray(savedValue) ? savedValue : Object.entries(savedValue || {}).map(([k, v]: [string, any]) => ({ key: k, value: v }));
                }
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
  }

  const currentNodeMeta = computed(() => {
    if (!selectedNode.value) return null;
    return pluginMetaCache.value[selectedNode.value.data.type] || null;
  });

  const requiredFields = computed(() => {
    if (!selectedNode.value) return [];

    const nodeType = selectedNode.value.data.type;
    const strategy = flowControlNodeRegistry.get(nodeType);
    const hasStrategy = flowControlNodeRegistry.hasStrategy(nodeType);
    
    if (flowControlNodeRegistry.isFlowControlContainer(nodeType) || hasStrategy) {
      return strategy.getRequiredFields();
    }

    if (!currentNodeMeta.value || !currentNodeMeta.value.formProperties) return [];
    const properties = currentNodeMeta.value.formProperties;
    const formRequired = currentNodeMeta.value.formRequired || [];
    const formDefs = currentNodeMeta.value.formDefs || {};

    return Object.keys(properties)
      .filter(key => key !== '$schema')
      .filter(key => {
        const prop = properties[key];
        return prop && (prop.type || prop.$ref || prop.anyOf) && (prop.$required === true || formRequired.includes(key));
      })
      .map(key => {
        const prop = properties[key];
        if (!prop) return null;
        const isRequired = prop.$required === true || formRequired.includes(key);
        const value = nodeConfigForm[key];
        const onUpdate = (val: any) => { nodeConfigForm[key] = val; };
        return renderFormField(properties, key, isRequired, formDefs, value, onUpdate, selectedNode.value!.data.type);
      })
      .filter(Boolean);
  });

  const optionalFields = computed(() => {
    if (!selectedNode.value) return [];

    const nodeType = selectedNode.value.data.type;
    const strategy = flowControlNodeRegistry.get(nodeType);
    const hasStrategy = flowControlNodeRegistry.hasStrategy(nodeType);
    
    if (flowControlNodeRegistry.isFlowControlContainer(nodeType) || hasStrategy) {
      return strategy.getOptionalFields();
    }

    if (!currentNodeMeta.value || !currentNodeMeta.value.formProperties) return [];
    const properties = currentNodeMeta.value.formProperties;
    const formRequired = currentNodeMeta.value.formRequired || [];
    const formDefs = currentNodeMeta.value.formDefs || {};

    return Object.keys(properties)
      .filter(key => key !== '$schema')
      .filter(key => {
        const prop = properties[key];
        return prop && (prop.type || prop.$ref || prop.anyOf) && prop.$required !== true && !formRequired.includes(key);
      })
      .map(key => {
        const prop = properties[key];
        if (!prop) return null;
        const isRequired = prop.$required === true || formRequired.includes(key);
        const value = nodeConfigForm[key];
        const onUpdate = (val: any) => { nodeConfigForm[key] = val; };
        return renderFormField(properties, key, isRequired, formDefs, value, onUpdate, selectedNode.value!.data.type);
      })
      .filter(Boolean);
  });

  function handleSaveConfig() {
    if (!selectedNode.value) return;

    if (!selectedNode.value.data.label || !selectedNode.value.data.label.trim()) {
      message.error('请填写节点名称');
      return;
    }

    const nodeType = selectedNode.value.data.type;
    const strategy = flowControlNodeRegistry.get(nodeType);
    const hasStrategy = flowControlNodeRegistry.hasStrategy(nodeType);
    
    if (flowControlNodeRegistry.isFlowControlContainer(nodeType) || hasStrategy) {
      const config: Record<string, any> = {};
      Object.keys(nodeConfigForm).forEach(key => {
        config[key] = nodeConfigForm[key];
      });

      if (selectedNode.value.data.type === 'idp_core_http_Request') {
        if (!config.uri || !config.uri.trim()) {
          message.error('请填写请求URL');
          return;
        }
      }

      selectedNode.value.data.config = config;

      // Use strategy saveConfig if available, otherwise just update the node
      if (strategy?.saveConfig) {
        strategy.saveConfig(config, store);
      }

      message.success('节点配置已保存');
      closeConfigPanel();
      return;
    }

    const missingFields: string[] = [];

    requiredFields.value.forEach(field => {
      if (!field) return;
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
      const formProperties = meta.formProperties;
      Object.keys(formProperties).forEach(key => {
        if (key !== '$schema') {
          const schema = formProperties[key];
          if (!schema) return;
          if (schema.anyOf) {
            const selectedIndex = nodeConfigForm[key];
            if (selectedIndex !== undefined && selectedIndex !== null) {
              const selectedOption = schema.anyOf[selectedIndex];
              if (selectedOption) {
                const values = nodeConfigForm[key + '_values'] || {};
                config[key] = serializeFieldValue(selectedOption, values, meta.formDefs || {});
              }
            }
          } else {
            config[key] = serializeFieldValue(schema, nodeConfigForm[key], meta.formDefs || {});
          }
        }
      });
    }

    selectedNode.value.data.config = config;
    message.success('节点配置已保存');
    closeConfigPanel();
  }

  // 关闭面板时必须先置空 selectedNode，再清空表单。
  // 否则 setupRealtimeConfigSync 的 watch 会把空表单同步到节点 config，导致数据丢失。
  function closeConfigPanel() {
    selectedNode.value = null;
    handleConfigClose();
  }

  return {
    selectedNode,
    nodeConfigForm,
    isConfigPanelOpen,
    configPanelWidth,
    isResizing,
    showNodeSelectModal,
    currentArrayIndex,
    selectedChildNodeType,
    selectedChildNodeMeta,
    childNodeConfigForm,
    selectedChildNodeLabel,
    handleNodeDoubleClick,
    handleConfigClose: closeConfigPanel,
    startResize,
    addArrayItem,
    removeArrayItem,
    addStringArrayItem,
    addNumberArrayItem,
    addObjectItem,
    updateObjectKey,
    updateObjectValue,
    removeObjectItem,
    addOnResumeItem,
    updateOnResumeField,
    removeOnResumeItem,
    addInputsItem,
    updateInputsField,
    removeInputsItem,
    addTriggersItem,
    updateTriggersField,
    removeTriggersItem,
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

export { validateAllNodes, validateNodeConfig };
