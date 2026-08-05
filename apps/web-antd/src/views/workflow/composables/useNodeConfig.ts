import { ref, computed, nextTick, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { WorkflowNode } from '#/types/workflow';
import { flowControlNodeRegistry } from '../config/workflow-node-config';
import { UI_CONFIG } from '../config/ui-config';
import type { SchemaNode as ParserSchemaNode } from './useSchemaParser';
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

    // 在设置 selectedNode 之前快照 savedConfig，避免组件挂载后 watcher 污染 node.data.config
    const savedConfig = { ...(node.data.config || {}) };

    selectedNode.value = node;
    store.setSelectedNodeId(node.id);
    isConfigPanelOpen.value = true;
    configPanelWidth.value = DEFAULT_PANEL_WIDTH;

    // 确保节点类型有对应的策略（自动加载 Schema 元数据）
    const nodeType = node.data.type;
    await flowControlNodeRegistry.ensureStrategy(nodeType, loadPluginMeta);

    // 统一走策略路径
    const strategy = flowControlNodeRegistry.get(nodeType);
    const newConfig = strategy.initConfig(savedConfig);

    clearForm();
    Object.assign(nodeConfigForm, newConfig);
  }

  const currentNodeMeta = computed(() => {
    if (!selectedNode.value) return null;
    const nodeType = selectedNode.value.data.type;
    return flowControlNodeRegistry.getNodeDescription(nodeType);
  });

  const requiredFields = computed(() => {
    if (!selectedNode.value) return [];
    const strategy = flowControlNodeRegistry.get(selectedNode.value.data.type);
    if (strategy.getRequiredFields) {
      return strategy.getRequiredFields(nodeConfigForm) || [];
    }
    return [];
  });

  const optionalFields = computed(() => {
    if (!selectedNode.value) return [];
    const strategy = flowControlNodeRegistry.get(selectedNode.value.data.type);
    if (strategy.getOptionalFields) {
      return strategy.getOptionalFields(nodeConfigForm) || [];
    }
    return [];
  });

  function handleSaveConfig() {
    if (!selectedNode.value) return;

    if (!selectedNode.value.data.label || !selectedNode.value.data.label.trim()) {
      message.error('请填写节点名称');
      return;
    }

    const strategy = flowControlNodeRegistry.get(selectedNode.value.data.type);

    // 1. 收集表单数据
    let config: Record<string, any> = {};
    Object.keys(nodeConfigForm).forEach(key => {
      config[key] = nodeConfigForm[key];
    });

    // 2. 序列化（前端表单 → Kestra 配置）
    if (strategy.serializeConfig) {
      config = strategy.serializeConfig(config);
    }

    // 3. 校验
    if (strategy.validateConfig) {
      const error = strategy.validateConfig(config);
      if (error) {
        message.error(error);
        return;
      }
    }

    // 4. 保存
    selectedNode.value.data.config = config;

    if (strategy.saveConfig) {
      strategy.saveConfig(config, store);
    }

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
