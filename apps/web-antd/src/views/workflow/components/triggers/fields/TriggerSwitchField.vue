<script lang="ts" setup>
import { computed, inject } from 'vue';

import { Switch, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import type { TriggerFieldContext } from '../../../composables/useTriggerFieldContext';

const props = defineProps<{
  field: any;
}>();

const context = inject<TriggerFieldContext>('triggerFieldContext')!;

const fieldKey = computed(() => props.field.props?.key || props.field.key);
const value = computed({
  get: () => context.getValue(fieldKey.value),
  set: (val) => context.setValue(fieldKey.value, val),
});
</script>

<template>
  <div class="trigger-field">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
      <label v-if="field.props?.label" style="font-size: 13px; font-weight: 500; color: #374151;">
        {{ field.props.label }}
      </label>
      <Tooltip v-if="field.props?.tooltip" :title="field.props.tooltip">
        <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; pointer-events: none;" />
      </Tooltip>
    </div>
    <Switch
      :checked="value"
      @update:checked="(val: any) => value = val"
    />
    <div v-if="field.props?.description" style="margin-top: 4px; font-size: 12px; color: #9ca3af;">
      {{ field.props.description }}
    </div>
  </div>
</template>
