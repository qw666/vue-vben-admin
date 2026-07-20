import { ref, reactive } from 'vue';
import { message } from 'ant-design-vue';
import { initFormFieldValue } from './useSchemaParser';

export function useChildNodeSelection(
  _pluginMetaCache: any,
  loadPluginMeta: any,
  pluginGroups: any,
  nodeConfigForm: any
) {
  const showNodeSelectModal = ref(false);
  const currentArrayFieldKey = ref('');
  const currentArrayIndex = ref(-1);
  const selectedChildNodeType = ref('');
  const selectedChildNodeMeta = ref<any>(null);
  const childNodeConfigForm = reactive<any>({});
  const selectedChildNodeLabel = ref('');

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
  };
}
