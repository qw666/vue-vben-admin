import { ref, computed, nextTick, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { WorkflowNode } from '#/types/workflow';
import { flowControlNodeRegistry } from '../config/workflow-node-config';
import { UI_CONFIG } from '../config/ui-config';
import type { SchemaNode as ParserSchemaNode } from './useSchemaParser';
import { useChildNodeSelection } from './useChildNodeSelection';
import { useFormState } from './useFormState';
import { useWorkflowStore } from '#/store/workflow';

const store = useWorkflowStore();

/**
 * 将 nodeConfigForm 中的数据序列化并返回干净的配置对象
 * 这是所有保存路径的统一入口
 */
function flushConfig(
  nodeConfigForm: Record<string, any>,
  nodeType: string,
): Record<string, any> {
  const strategy = flowControlNodeRegistry.get(nodeType);

  // 1. 收集表单数据（现在不再有 _index 字段，直接收集）
  let config: Record<string, any> = { ...nodeConfigForm };

  // 2. 序列化（前端表单 → Kestra 配置）
  if (strategy.serializeConfig) {
    config = strategy.serializeConfig(config);
  }

  return config;
}

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
        // 直接同步配置（不再需要 _index 过滤）
        const config = flushConfig(nodeConfigForm, selectedNode.value.data.type);
        selectedNode.value.data.config = config;
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
    // 关键：在切换节点前，先把当前 nodeConfigForm 的值同步回旧节点
    if (selectedNode.value) {
      const oldNode = selectedNode.value;
      const config = flushConfig(nodeConfigForm, oldNode.data.type);
      oldNode.data.config = config;
    }

    // 先清除选中状态，等下一帧再设置新节点，避免组件更新时出现 null 引用
    selectedNode.value = null;
    store.setSelectedNodeId(null);
    await nextTick();

    // 在设置 selectedNode 之前快照 savedConfig
    const savedConfig = { ...(node.data.config || {}) };

    // 确保节点类型有对应的策略（自动加载 Schema 元数据）
    const nodeType = node.data.type;
    await flowControlNodeRegistry.ensureStrategy(nodeType, loadPluginMeta);

    // 关键：先初始化 nodeConfigForm，再设置 selectedNode
    // 这样 ConfigPanel 渲染时就能读到正确的值
    const strategy = flowControlNodeRegistry.get(nodeType);
    const newConfig = strategy.initConfig(savedConfig);

    clearForm();
    Object.assign(nodeConfigForm, newConfig);

    // 然后再设置 selectedNode 触发 ConfigPanel 渲染
    selectedNode.value = node;
    store.setSelectedNodeId(node.id);
    isConfigPanelOpen.value = true;
    configPanelWidth.value = DEFAULT_PANEL_WIDTH;
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

  /**
   * 统一保存配置（内部函数）
   * @param showMessage 是否显示成功提示和校验
   */
  function persistConfig(showMessage = false) {
    if (!selectedNode.value) return;

    // 完整保存时进行校验
    if (showMessage) {
      if (!selectedNode.value.data.label || !selectedNode.value.data.label.trim()) {
        message.error('请填写节点名称');
        return;
      }
    }

    const nodeType = selectedNode.value.data.type;
    const strategy = flowControlNodeRegistry.get(nodeType);

    // 1. 使用统一方法收集并序列化配置
    const config = flushConfig(nodeConfigForm, nodeType);

    // 2. 完整保存时校验
    if (showMessage && strategy.validateConfig) {
      const error = strategy.validateConfig(config);
      if (error) {
        message.error(error);
        return;
      }
    }

    // 3. 保存到节点
    selectedNode.value.data.config = config;

    // 4. 特殊保存逻辑（如 Start 节点的 inputs/triggers 需写入 store.currentWorkflow）
    if (strategy.saveConfig) {
      strategy.saveConfig(config, store);
    }

    if (showMessage) {
      message.success('节点配置已保存');
      closeConfigPanel();
    }
  }

  function handleSaveConfig() {
    persistConfig(true);
  }

  /**
   * 自动保存配置（关闭面板时调用）
   */
  function autoSaveConfig() {
    persistConfig(false);
  }

  // 关闭面板时必须先置空 selectedNode，再清空表单。
  // 否则 setupRealtimeConfigSync 的 watch 会把空表单同步到节点 config，导致数据丢失。
  function closeConfigPanel() {
    // 先自动保存配置
    autoSaveConfig();
    // 再关闭面板
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
