<script lang="ts" setup>
import InputField from './fields/InputField.vue';
import TextareaField from './fields/TextareaField.vue';
import InputNumberField from './fields/InputNumberField.vue';
import SwitchField from './fields/SwitchField.vue';
import EnumSelectField from './fields/EnumSelectField.vue';
import SelectField from './fields/SelectField.vue';
import StringArrayField from './fields/StringArrayField.vue';
import NumberArrayField from './fields/NumberArrayField.vue';
import ObjectInputField from './fields/ObjectInputField.vue';
import ArrayTableField from './fields/ArrayTableField.vue';
import NodeArrayField from './fields/NodeArrayField.vue';
import ConnectionStatusField from './fields/ConnectionStatusField.vue';
import SwitchCasesField from './fields/SwitchCasesField.vue';
import AnyOfRadioField from './fields/AnyOfRadioField.vue';
import RefObjectField from './fields/RefObjectField.vue';
import ConcurrentField from './fields/ConcurrentField.vue';
import OnResumeField from './fields/OnResumeField.vue';
import DurationField from './fields/DurationField.vue';
import InfoBoxField from './fields/InfoBoxField.vue';

defineOptions({
  inheritAttrs: false,
});

defineProps<{
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
}>();
</script>

<template>
  <InputField
    v-if="field.type === 'Input'"
    :field="field"
    :node-config-form="nodeConfigForm"
  />
  <TextareaField
    v-else-if="field.type === 'Textarea'"
    :field="field"
    :node-config-form="nodeConfigForm"
  />
  <InputNumberField
    v-else-if="field.type === 'InputNumber'"
    :field="field"
    :node-config-form="nodeConfigForm"
  />
  <SwitchField
    v-else-if="field.type === 'Switch'"
    :field="field"
    :node-config-form="nodeConfigForm"
  />
  <AnyOfRadioField
    v-else-if="field.type === 'AnyOfRadio'"
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
  />
  <EnumSelectField
    v-else-if="field.type === 'EnumSelect'"
    :field="field"
    :node-config-form="nodeConfigForm"
  />
  <SelectField
    v-else-if="field.type === 'Select'"
    :field="field"
    :node-config-form="nodeConfigForm"
  />
  <StringArrayField
    v-else-if="field.type === 'StringArray'"
    :field="field"
    :node-config-form="nodeConfigForm"
    @add-string-array-item="(fk: string) => emit('addStringArrayItem', fk)"
    @remove-array-item="(fk: string, idx: number) => emit('removeArrayItem', fk, idx)"
  />
  <NumberArrayField
    v-else-if="field.type === 'NumberArray'"
    :field="field"
    :node-config-form="nodeConfigForm"
    @add-number-array-item="(fk: string) => emit('addNumberArrayItem', fk)"
    @remove-array-item="(fk: string, idx: number) => emit('removeArrayItem', fk, idx)"
  />
  <ObjectInputField
    v-else-if="field.type === 'ObjectInput'"
    :field="field"
    :node-config-form="nodeConfigForm"
    @add-object-item="(fk: string) => emit('addObjectItem', fk)"
    @update-object-key="(fk: string, idx: number, val: string) => emit('updateObjectKey', fk, idx, val)"
    @update-object-value="(fk: string, idx: number, val: string) => emit('updateObjectValue', fk, idx, val)"
    @remove-object-item="(fk: string, idx: number) => emit('removeObjectItem', fk, idx)"
  />
  <ArrayTableField
    v-else-if="field.type === 'ArrayTable'"
    :field="field"
    :node-config-form="nodeConfigForm"
    @add-array-item="(fk: string, schema: any) => emit('addArrayItem', fk, schema)"
    @remove-array-item="(fk: string, idx: number) => emit('removeArrayItem', fk, idx)"
    @update-array-item-value="(fk: string, idx: number, pk: string, val: any) => emit('updateArrayItemValue', fk, idx, pk, val)"
  />
  <NodeArrayField
    v-else-if="field.type === 'NodeArray'"
    :field="field"
    :node-config-form="nodeConfigForm"
    :plugin-groups="pluginGroups"
    @open-node-select-modal="(fk: string) => emit('openNodeSelectModal', fk)"
    @edit-child-node="(fk: string, idx: number) => emit('editChildNode', fk, idx)"
    @remove-array-item="(fk: string, idx: number) => emit('removeArrayItem', fk, idx)"
  />
  <ConnectionStatusField
    v-else-if="field.type === 'ConnectionStatus'"
    :field="field"
    :node-config-form="nodeConfigForm"
    :plugin-groups="pluginGroups"
  />
  <ConcurrentField
    v-else-if="field.type === 'Concurrent'"
    :field="field"
    :node-config-form="nodeConfigForm"
  />
  <OnResumeField
    v-else-if="field.type === 'OnResume'"
    :field="field"
    :node-config-form="nodeConfigForm"
    @add-on-resume-item="(fk: string) => emit('addOnResumeItem', fk)"
    @update-on-resume-field="(fk: string, idx: number, key: string, val: any) => emit('updateOnResumeField', fk, idx, key, val)"
    @remove-on-resume-item="(fk: string, idx: number) => emit('removeOnResumeItem', fk, idx)"
  />
  <DurationField
    v-else-if="field.type === 'Duration'"
    :field="field"
    :node-config-form="nodeConfigForm"
  />
  <InfoBoxField
    v-else-if="field.type === 'InfoBox'"
    :field="field"
  />
  <SwitchCasesField
    v-else-if="field.type === 'SwitchCases'"
    :field="field"
    :node-config-form="nodeConfigForm"
    :plugin-groups="pluginGroups"
    @update-case-key="(fk: string, oldKey: string, newKey: string) => emit('updateCaseKey', fk, oldKey, newKey)"
    @remove-case-key="(fk: string, caseKey: string) => emit('removeCaseKey', fk, caseKey)"
    @remove-node-from-case="(fk: string, caseKey: string, idx: number) => emit('removeNodeFromCase', fk, caseKey, idx)"
  />
  <RefObjectField
    v-else-if="field.type === 'RefObject'"
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
  />
</template>
