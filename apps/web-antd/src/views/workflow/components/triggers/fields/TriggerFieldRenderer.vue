<script lang="ts" setup>
import { computed } from 'vue';

import TriggerInputField from './TriggerInputField.vue';
import TriggerSelectField from './TriggerSelectField.vue';
import TriggerSwitchField from './TriggerSwitchField.vue';
import TriggerInputNumberField from './TriggerInputNumberField.vue';
import TriggerVarPickerField from './TriggerVarPickerField.vue';
import TriggerPasswordField from './TriggerPasswordField.vue';
import TriggerArrayTableField from './TriggerArrayTableField.vue';
import TriggerAnyOfRadioField from './TriggerAnyOfRadioField.vue';
import TriggerAnyOfArrayField from './TriggerAnyOfArrayField.vue';
import TriggerDateTimeField from './TriggerDateTimeField.vue';
import TriggerTimeField from './TriggerTimeField.vue';
import TriggerDateField from './TriggerDateField.vue';
import TriggerMultiSelectField from './TriggerMultiSelectField.vue';
import TriggerDurationField from './TriggerDurationField.vue';

const props = defineProps<{
  field: any;
}>();

const componentMap: Record<string, any> = {
  Input: TriggerInputField,
  Textarea: TriggerInputField,
  Select: TriggerSelectField,
  EnumSelect: TriggerSelectField,
  Switch: TriggerSwitchField,
  InputNumber: TriggerInputNumberField,
  VarPicker: TriggerVarPickerField,
  Password: TriggerPasswordField,
  ArrayTable: TriggerArrayTableField,
  AnyOfRadio: TriggerAnyOfRadioField,
  AnyOfArray: TriggerAnyOfArrayField,
  DateTimePicker: TriggerDateTimeField,
  TimePicker: TriggerTimeField,
  DatePicker: TriggerDateField,
  MultiSelect: TriggerMultiSelectField,
  Duration: TriggerDurationField,
};

const fieldComponent = computed(() => {
  return componentMap[props.field.type] || TriggerInputField;
});
</script>

<template>
  <component :is="fieldComponent" :field="field" />
</template>
