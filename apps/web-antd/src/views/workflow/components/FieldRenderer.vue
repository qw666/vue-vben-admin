<script lang="ts" setup>
import { computed } from 'vue';

import { getFieldComponent } from './fields';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
  pluginGroups: any[];
}>();

const emit = defineEmits<{
  (e: 'addObjectItem', fieldKey: string): void;
  (e: 'updateObjectKey', fieldKey: string, index: number, value: string): void;
  (e: 'updateObjectValue', fieldKey: string, index: number, value: string): void;
  (e: 'removeObjectItem', fieldKey: string, index: number): void;
  (e: 'addStringArrayItem', fieldKey: string): void;
  (e: 'addNumberArrayItem', fieldKey: string): void;
  (e: 'addArrayItem', fieldKey: string, itemsSchema: any): void;
  (e: 'removeArrayItem', fieldKey: string, index: number): void;
  (e: 'updateArrayItemValue', fieldKey: string, index: number, itemKey: string, value: any): void;
  (e: 'openNodeSelectModal', fieldKey: string): void;
  (e: 'editChildNode', fieldKey: string, index: number): void;
  (e: 'addCaseKey', fieldKey: string): void;
  (e: 'updateCaseKey', fieldKey: string, oldKey: string, newKey: string): void;
  (e: 'removeCaseKey', fieldKey: string, caseKey: string): void;
  (e: 'removeNodeFromCase', fieldKey: string, caseKey: string, index: number): void;
  (e: 'addOnResumeItem', fieldKey: string): void;
  (e: 'updateOnResumeField', fieldKey: string, index: number, key: string, value: any): void;
  (e: 'removeOnResumeItem', fieldKey: string, index: number): void;
  (e: 'addInputsItem', fieldKey: string): void;
  (e: 'updateInputsField', fieldKey: string, index: number, key: string, value: any): void;
  (e: 'removeInputsItem', fieldKey: string, index: number): void;
  (e: 'addTriggersItem', fieldKey: string): void;
  (e: 'updateTriggersField', fieldKey: string, index: number, key: string, value: any): void;
  (e: 'removeTriggersItem', fieldKey: string, index: number): void;
}>();

const fieldComponent = computed(() => {
  const comp = getFieldComponent(props.field.type);
  if (!comp) {
    console.warn(`Unknown field type: ${props.field.type}`);
  }
  return comp;
});
</script>

<template>
  <component
    :is="fieldComponent"
    v-if="fieldComponent"
    :field="field"
    :node-config-form="nodeConfigForm"
    :plugin-groups="pluginGroups"
    @add-object-item="(fk: string) => emit('addObjectItem', fk)"
    @update-object-key="(fk: string, idx: number, val: string) => emit('updateObjectKey', fk, idx, val)"
    @update-object-value="(fk: string, idx: number, val: string) => emit('updateObjectValue', fk, idx, val)"
    @remove-object-item="(fk: string, idx: number) => emit('removeObjectItem', fk, idx)"
    @add-string-array-item="(fk: string) => emit('addStringArrayItem', fk)"
    @add-number-array-item="(fk: string) => emit('addNumberArrayItem', fk)"
    @add-array-item="(fk: string, schema: any) => emit('addArrayItem', fk, schema)"
    @remove-array-item="(fk: string, idx: number) => emit('removeArrayItem', fk, idx)"
    @update-array-item-value="(fk: string, idx: number, pk: string, val: any) => emit('updateArrayItemValue', fk, idx, pk, val)"
    @open-node-select-modal="(fk: string) => emit('openNodeSelectModal', fk)"
    @edit-child-node="(fk: string, idx: number) => emit('editChildNode', fk, idx)"
    @add-case-key="(fk: string) => emit('addCaseKey', fk)"
    @update-case-key="(fk: string, oldKey: string, newKey: string) => emit('updateCaseKey', fk, oldKey, newKey)"
    @remove-case-key="(fk: string, caseKey: string) => emit('removeCaseKey', fk, caseKey)"
    @remove-node-from-case="(fk: string, caseKey: string, idx: number) => emit('removeNodeFromCase', fk, caseKey, idx)"
    @add-on-resume-item="(fk: string) => emit('addOnResumeItem', fk)"
    @update-on-resume-field="(fk: string, idx: number, key: string, val: any) => emit('updateOnResumeField', fk, idx, key, val)"
    @remove-on-resume-item="(fk: string, idx: number) => emit('removeOnResumeItem', fk, idx)"
    @add-inputs-item="(fk: string) => emit('addInputsItem', fk)"
    @update-inputs-field="(fk: string, idx: number, key: string, val: any) => emit('updateInputsField', fk, idx, key, val)"
    @remove-inputs-item="(fk: string, idx: number) => emit('removeInputsItem', fk, idx)"
    @add-triggers-item="(fk: string) => emit('addTriggersItem', fk)"
    @update-triggers-field="(fk: string, idx: number, key: string, val: any) => emit('updateTriggersField', fk, idx, key, val)"
    @remove-triggers-item="(fk: string, idx: number) => emit('removeTriggersItem', fk, idx)"
  />
  <div v-else class="p-2 text-sm text-red-500">
    未知字段类型: {{ field.type }}
  </div>
</template>
