<script lang="ts" setup>
import { computed, provide } from 'vue';

import { renderTriggerField } from '../../composables/useTriggerFieldResolver';
import { createTriggerFieldContext } from '../../composables/useTriggerFieldContext';

import TriggerFieldRenderer from './fields/TriggerFieldRenderer.vue';

const props = defineProps<{
  trigger: Record<string, any>;
  meta?: any;
}>();

const emit = defineEmits<{
  (e: 'updateField', key: string, value: any): void;
}>();

const formProperties = computed(() => props.meta?.formProperties || {});
const formDefs = computed(() => props.meta?.formDefs || {});
const formRequired = computed(() => props.meta?.formRequired || []);

const excludedFields = ['inputs', 'pluginDefaultsRef'];

const renderedFields = computed(() => {
  const properties = formProperties.value;
  const defs = formDefs.value;
  const required = formRequired.value;

  const result: ReturnType<typeof renderTriggerField>[] = [];

  for (const key of Object.keys(properties)) {
    if (excludedFields.includes(key)) continue;
    const schema = properties[key];
    const isRequired = required.includes(key) || schema.$required;
    const currentValue = props.trigger[key];

    const rendered = renderTriggerField(
      properties,
      key,
      isRequired,
      defs,
      currentValue,
      (val: any) => {
        emit('updateField', key, val);
      },
    );

    result.push(rendered);
  }

  return result;
});

const context = createTriggerFieldContext(() => props.trigger, (key: string, value: any) => {
  emit('updateField', key, value);
}, () => formDefs.value);

provide('triggerFieldContext', context);
</script>

<template>
  <div style="margin-top: 4px;">
    <div v-if="renderedFields.length > 0" style="padding: 12px 0;">
      <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 12px;">
        触发器配置
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <TriggerFieldRenderer
          v-for="field in renderedFields"
          :key="field.props.key"
          :field="field"
        />
      </div>
    </div>
    <div v-else style="padding: 16px 0; font-size: 12px; color: #9ca3af; text-align: center;">
      暂无配置项
    </div>
  </div>
</template>
