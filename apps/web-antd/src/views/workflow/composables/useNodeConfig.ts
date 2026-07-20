import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { getFlowControlConfig, flowControlNodeRegistry } from '../config/workflow-node-config';
import { internalResolveRef, initFormFieldValue, serializeFieldValue } from './useSchemaParser';
import { renderFormField } from './useFormFieldResolver';
import { validateAllNodes, validateNodeConfig } from './useFieldValidation';
import { useChildNodeSelection } from './useChildNodeSelection';
import { useFormState } from './useFormState';

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
  maximum?: number;
  step?: number;
  $dynamic?: boolean;
  $required?: boolean;
  const?: any;
  default?: any;
  additionalProperties?: SchemaNode;
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

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    nodeId: string;
    nodeLabel: string;
    missingFields: string[];
  }>;
}

export function useNodeConfig(pluginMetaCache: any, loadPluginMeta: any, _isTaskRef: any, _resolveRef: any, pluginGroups: any) {
  const selectedNode = ref<any>(null);

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
    updateArrayItemValue,
    startResize,
    handleConfigClose,
  } = useFormState();

  const {
    showNodeSelectModal,
    currentArrayFieldKey,
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

  const DEFAULT_PANEL_WIDTH = 375;

  async function handleNodeDoubleClick(node: any) {
    selectedNode.value = node;
    isConfigPanelOpen.value = true;
    configPanelWidth.value = DEFAULT_PANEL_WIDTH;

    const strategy = flowControlNodeRegistry.get(node.data.type);
    if (strategy) {
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
            if (savedConfig[key] !== undefined) {
              if (prop.anyOf) {
                const savedValue = savedConfig[key];
                let selectedIndex = 0;
                for (let i = 0; i < prop.anyOf.length; i++) {
                  const option = prop.anyOf[i];
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

    const strategy = flowControlNodeRegistry.get(selectedNode.value.data.type);
    if (strategy) {
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
        return (prop.type || prop.$ref || prop.anyOf) && (prop.$required === true || formRequired.includes(key));
      })
      .map(key => {
        const isRequired = properties[key].$required === true || formRequired.includes(key);
        const value = nodeConfigForm[key];
        const onUpdate = (val: any) => { nodeConfigForm[key] = val; };
        return renderFormField(properties, key, isRequired, formDefs, value, onUpdate, selectedNode.value.data.type);
      });
  });

  const optionalFields = computed(() => {
    if (!selectedNode.value) return [];

    const strategy = flowControlNodeRegistry.get(selectedNode.value.data.type);
    if (strategy) {
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
        return (prop.type || prop.$ref || prop.anyOf) && prop.$required !== true && !formRequired.includes(key);
      })
      .map(key => {
        const isRequired = properties[key].$required === true || formRequired.includes(key);
        const value = nodeConfigForm[key];
        const onUpdate = (val: any) => { nodeConfigForm[key] = val; };
        return renderFormField(properties, key, isRequired, formDefs, value, onUpdate, selectedNode.value.data.type);
      });
  });

  function handleSaveConfig() {
    if (!selectedNode.value) return;

    const flowControlConfig = getFlowControlConfig(selectedNode.value.data.type);
    if (flowControlConfig) {
      const config: Record<string, any> = {};
      Object.keys(nodeConfigForm).forEach(key => {
        config[key] = nodeConfigForm[key];
      });
      selectedNode.value.data.config = config;
      message.success('节点配置已保存');
      handleConfigClose();
      return;
    }

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
          const schema = meta.formProperties[key];
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
    addOnResumeItem,
    updateOnResumeField,
    removeOnResumeItem,
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
