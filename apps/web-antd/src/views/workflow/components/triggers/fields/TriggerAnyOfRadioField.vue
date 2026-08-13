<script lang="ts" setup>
import { computed, inject, nextTick, ref, watch } from 'vue';

import { Button, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import { renderTriggerField } from '../../../composables/useTriggerFieldResolver';
import { inferAnyOfOption, initTriggerFieldValue } from '../../../composables/useSchemaParser';
import type { TriggerFieldContext } from '../../../composables/useTriggerFieldContext';

import TriggerFieldRenderer from './TriggerFieldRenderer.vue';

const props = defineProps<{
  field: any;
}>();

const context = inject<TriggerFieldContext>('triggerFieldContext')!;

const fieldKey = computed(() => props.field.props?.key || props.field.key);
const options = computed(() => props.field.props?.options || []);
const defs = computed(() => context.defs || {});

const selectedIndex = ref<number | null>(null);
const isSwitching = ref(false);

function initIndex(): number | null {
  const value = context.getValue(fieldKey.value);
  const result = inferAnyOfOption(options.value, value);
  return result === -1 ? null : result;
}

watch(
  () => props.field.props?.key || props.field.key,
  () => { selectedIndex.value = initIndex(); },
  { immediate: true },
);

watch(
  () => context.getValue(fieldKey.value),
  (newVal, oldVal) => {
    if (isSwitching.value) return;
    if (newVal !== oldVal && selectedIndex.value !== null) {
      const newIndex = inferAnyOfOption(options.value, newVal);
      if (newIndex !== -1 && newIndex !== selectedIndex.value) {
        selectedIndex.value = newIndex;
      }
    }
  },
);

const selectedOption = computed(() => {
  if (selectedIndex.value === null) return null;
  return options.value.find((opt: any) => opt.value === selectedIndex.value);
});

const renderedField = computed(() => {
  const option = selectedOption.value;
  if (!option || option.subFields?.length) return null;

  const schema = option.schema;
  if (!schema?.type) return null;

  const isRequired = props.field.props?.required;
  const value = context.getValue(fieldKey.value);

  const field = renderTriggerField(
    { [fieldKey.value]: schema },
    fieldKey.value,
    isRequired,
    defs.value,
    value,
    (val: any) => {
      context.setValue(fieldKey.value, val);
    },
  );
  field.props.label = props.field.props?.label;
  return field;
});

function clearSelection(): void {
  isSwitching.value = true;
  selectedIndex.value = null;
  context.setValue(fieldKey.value, '');
  nextTick(() => { isSwitching.value = false; });
}

watch(selectedIndex, (newIndex, oldIndex) => {
  if (newIndex === oldIndex) return;
  isSwitching.value = true;

  const option = options.value.find((opt: any) => opt.value === newIndex);
  const schema = option?.schema;

  if (schema) {
    const initVal = initTriggerFieldValue(schema, defs.value);
    context.setValue(fieldKey.value, initVal);
  }

  nextTick(() => { isSwitching.value = false; });
});

const nestedPath = computed(() => fieldKey.value + '_values');
const nestedContext = computed(() => context.getNestedObject(nestedPath.value));
</script>

<template>
  <div class="trigger-field">
    <div v-if="field.props?.label" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
      <label style="font-size: 13px; font-weight: 500; color: #374151;">
        {{ field.props.label }}
        <span v-if="field.props.required" style="color: #ef4444; margin-left: 4px;">*</span>
      </label>
      <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; pointer-events: none;" />
      </Tooltip>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 12px;">
      <label
        v-for="option in options"
        :key="option.value"
        style="display: flex; align-items: center; gap: 8px; cursor: pointer;"
      >
        <input
          type="radio"
          :value="option.value"
          v-model="selectedIndex"
          style="width: 16px; height: 16px; color: #2563eb;"
        />
        <span style="font-size: 14px; color: #374151;">{{ option.label }}</span>
      </label>
      <Button
        v-if="selectedIndex !== null"
        type="text"
        size="small"
        @click="clearSelection"
        style="color: #6b7280;"
      >
        <IconifyIcon icon="mdi:close" :size="14" />
      </Button>
    </div>
    <div v-if="selectedOption?.subFields?.length" style="background: #f9fafb; border-radius: 8px; padding: 12px;">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div v-for="subField in selectedOption.subFields" :key="subField.props.key" style="border-left: 2px solid #d1d5db; padding-left: 12px;">
          <TriggerFieldRenderer :field="subField" />
        </div>
      </div>
    </div>
    <div v-else-if="renderedField" style="margin-top: 8px;">
      <TriggerFieldRenderer :field="renderedField" />
    </div>
  </div>
</template>
