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
 * 
 * 重要：排除 _index 后缀的 UI 状态字段，只同步实际值
 * _index 只存在于 nodeConfigForm（UI状态），永远不进入 node.data.config
 */
function setupRealtimeConfigSync(
  nodeConfigForm: Record<string, any>,
  selectedNode: ReturnType<typeof ref<WorkflowNode | null>>,
) {
  watch(
    () => ({ ...nodeConfigForm }),
    () => {
      if (selectedNode.value) {
        const cleanConfig: Record<string, any> = {};
        const originalConfig = selectedNode.value.data.config || {};
        
        for (const [key, value] of Object.entries(nodeConfigForm)) {
          // 排除 _index 后缀（UI 状态，不写入 node.data.config）
          if (key.endsWith('_index')) {
            continue;
          }
          cleanConfig[key] = value;
        }
        
        selectedNode.value.data.config = {
          ...originalConfig,
          ...cleanConfig,
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
    // 关键：在切换节点前，先把当前 nodeConfigForm 的值同步回旧节点
    // 注意：排除 _index 后缀的 UI 状态字段，只同步实际值
    if (selectedNode.value) {
      const oldNode = selectedNode.value;
      const cleanConfig: Record<string, any> = {};
      const originalConfig = oldNode.data.config || {};
      
      for (const [key, value] of Object.entries(nodeConfigForm)) {
        // 排除 _index 后缀（UI 状态，不需要保存到 data.config）
        if (key.endsWith('_index')) {
          continue;
        }
        cleanConfig[key] = value;
      }
      
      oldNode.data.config = {
        ...originalConfig,
        ...cleanConfig,
      };
    }

    // 先清除选中状态，等下一帧再设置新节点，避免组件更新时出现 null 引用
    selectedNode.value = null;
    store.setSelectedNodeId(null);
    await nextTick();

    // 在设置 selectedNode 之前快照 savedConfig
    // 注意：这里拿到的是已排除 _index 的干净配置
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

  /**
   * 自动保存配置（关闭面板时调用）
   * 与 handleSaveConfig 类似，但不显示成功提示
   */
  function autoSaveConfig() {
    if (!selectedNode.value) return;

    const strategy = flowControlNodeRegistry.get(selectedNode.value.data.type);

    // 1. 收集表单数据
    let config: Record<string, any> = { ...nodeConfigForm };

    // 2. 序列化（前端表单 → Kestra 配置）
    if (strategy.serializeConfig) {
      config = strategy.serializeConfig(config);
    }

    // 3. 保存到节点
    selectedNode.value.data.config = config;

    // 4. 特殊保存逻辑（如 Start 节点的 inputs/triggers 需写入 store.currentWorkflow）
    if (strategy.saveConfig) {
      strategy.saveConfig(config, store);
    }
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

export { validateAllNodes, validateNodeConfig };
