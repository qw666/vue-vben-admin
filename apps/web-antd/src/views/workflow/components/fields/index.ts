import type { Component } from 'vue';

import { markRaw } from 'vue';

import InputField from './InputField.vue';
import TextareaField from './TextareaField.vue';
import InputNumberField from './InputNumberField.vue';
import SwitchField from './SwitchField.vue';
import EnumSelectField from './EnumSelectField.vue';
import SelectField from './SelectField.vue';
import StringArrayField from './StringArrayField.vue';
import NumberArrayField from './NumberArrayField.vue';
import ObjectInputField from './ObjectInputField.vue';
import ArrayTableField from './ArrayTableField.vue';
import NodeArrayField from './NodeArrayField.vue';
import ConnectionStatusField from './ConnectionStatusField.vue';
import SwitchCasesField from './SwitchCasesField.vue';
import AnyOfRadioField from './AnyOfRadioField.vue';
import RefObjectField from './RefObjectField.vue';
import ConcurrentField from './ConcurrentField.vue';
import OnResumeField from './OnResumeField.vue';
import OutputField from './OutputField.vue';
import InputsField from './InputsField.vue';
import TriggersField from './TriggersField.vue';
import DurationField from './DurationField.vue';
import InfoBoxField from './InfoBoxField.vue';
import VarPicker from './VarPicker.vue';

const fieldComponentRegistry: Record<string, Component> = {
  AnyOfRadio: markRaw(AnyOfRadioField),
  ArrayTable: markRaw(ArrayTableField),
  Concurrent: markRaw(ConcurrentField),
  ConnectionStatus: markRaw(ConnectionStatusField),
  Duration: markRaw(DurationField),
  EnumSelect: markRaw(EnumSelectField),
  InfoBox: markRaw(InfoBoxField),
  Input: markRaw(InputField),
  InputNumber: markRaw(InputNumberField),
  Inputs: markRaw(InputsField),
  NodeArray: markRaw(NodeArrayField),
  NumberArray: markRaw(NumberArrayField),
  ObjectInput: markRaw(ObjectInputField),
  OnResume: markRaw(OnResumeField),
  Output: markRaw(OutputField),
  RefObject: markRaw(RefObjectField),
  Select: markRaw(SelectField),
  StringArray: markRaw(StringArrayField),
  Switch: markRaw(SwitchField),
  SwitchCases: markRaw(SwitchCasesField),
  Textarea: markRaw(TextareaField),
  Triggers: markRaw(TriggersField),
  VarPicker: markRaw(VarPicker),
};

export function registerFieldComponent(type: string, component: Component): void {
  if (!fieldComponentRegistry[type]) {
    fieldComponentRegistry[type] = markRaw(component);
  }
}

export function getFieldComponent(type: string): Component | undefined {
  return fieldComponentRegistry[type];
}

export function hasFieldComponent(type: string): boolean {
  return type in fieldComponentRegistry;
}
