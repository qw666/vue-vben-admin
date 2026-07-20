import { reactive, ref } from 'vue';
import type { SchemaNode } from './useSchemaParser';
import { initFormFieldValue } from './useSchemaParser';
import { useEventCleanup } from './useEventCleanup';
import { UI_CONFIG } from '../config/ui-config';
import type { NodeConfigForm } from '../types/workflow';

export function useFormState() {
  const nodeConfigForm = reactive<NodeConfigForm>({});
  const isConfigPanelOpen = ref(false);
  const configPanelWidth = ref(UI_CONFIG.configPanel.defaultWidth);
  const isResizing = ref(false);
  const { addListener, removeAllListeners, removeListener } = useEventCleanup();

  function clearForm() {
    Object.keys(nodeConfigForm).forEach(key => delete nodeConfigForm[key]);
  }

  function setFormField(fieldKey: string, value: any) {
    nodeConfigForm[fieldKey] = value;
  }

  function getFormField(fieldKey: string): any {
    return nodeConfigForm[fieldKey];
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

  function addOnResumeItem(fieldKey: string) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    nodeConfigForm[fieldKey] = [...currentValue, { id: '', type: 'STRING', displayName: '', required: false, itemType: 'STRING', defaults: '' }];
  }

  function updateOnResumeField(fieldKey: string, index: number, key: string, value: any) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    currentValue[index] = { ...currentValue[index], [key]: value };
    nodeConfigForm[fieldKey] = [...currentValue];
  }

  function removeOnResumeItem(fieldKey: string, index: number) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    nodeConfigForm[fieldKey] = currentValue.filter((_: any, i: number) => i !== index);
  }

  function updateArrayItemValue(fieldKey: string, index: number, itemKey: string, value: any) {
    const currentValue = nodeConfigForm[fieldKey] || [];
    currentValue[index][itemKey] = value;
    nodeConfigForm[fieldKey] = [...currentValue];
  }

  function startResize(e: MouseEvent) {
    isResizing.value = true;
    const startX = e.clientX;
    const startWidth = configPanelWidth.value;

    function onMouseMove(event: MouseEvent) {
      if (!isResizing.value) return;
      const deltaX = startX - event.clientX;
      const newWidth = Math.max(UI_CONFIG.configPanel.minWidth, Math.min(UI_CONFIG.configPanel.maxWidth, startWidth + deltaX));
      configPanelWidth.value = newWidth;
    }

    function onMouseUp() {
      isResizing.value = false;
      removeListener(document, 'mousemove', onMouseMove);
      removeListener(document, 'mouseup', onMouseUp);
    }

    addListener(document, 'mousemove', onMouseMove);
    addListener(document, 'mouseup', onMouseUp);
  }

  function cleanup() {
    removeAllListeners();
    isResizing.value = false;
  }

  function handleConfigClose() {
    isConfigPanelOpen.value = false;
    clearForm();
  }

  return {
    nodeConfigForm,
    isConfigPanelOpen,
    configPanelWidth,
    isResizing,
    clearForm,
    setFormField,
    getFormField,
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
    cleanup,
  };
}
