<script lang="ts" setup>
import { computed } from 'vue';
import { Button, InputNumber, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);
const connectionFieldKey = computed(() => props.field.props.connectionField || 'tasks');

const connectionCount = computed(() => {
  const connections = props.nodeConfigForm[connectionFieldKey.value];
  return Array.isArray(connections) ? connections.length : 0;
});

const currentValue = computed({
  get: () => props.nodeConfigForm[fieldKey.value] || 0,
  set: (val) => {
    const numVal = typeof val === 'number' ? val : parseInt(val, 10) || 0;
    const clampedVal = Math.max(0, Math.min(numVal, connectionCount.value));
    props.nodeConfigForm[fieldKey.value] = clampedVal;
  },
});

function decrease() {
  if (currentValue.value > 0) {
    currentValue.value--;
  }
}

function increase() {
  if (currentValue.value < connectionCount.value) {
    currentValue.value++;
  }
}
</script>

<template>
  <div class="field-renderer">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
      <label style="font-size: 14px; font-weight: 500; color: #374151;">
        {{ field.props.label }}
        <span v-if="field.props.required" style="color: #ef4444; margin-left: 4px;">*</span>
      </label>
      <div style="display: flex; align-items: center; gap: 8px;">
        <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
          <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af;" />
        </Tooltip>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <Button
        type="text"
        size="small"
        :disabled="currentValue === 0"
        @click="decrease"
        style="width: 36px; height: 36px; padding: 0;"
      >
        <IconifyIcon icon="mdi:minus" :size="20" />
      </Button>
      <InputNumber
        v-model:value="currentValue"
        :min="0"
        :max="connectionCount"
        :controls="false"
        style="flex: 1;"
        class="text-center"
      />
      <Button
        type="text"
        size="small"
        :disabled="currentValue >= connectionCount"
        @click="increase"
        style="width: 36px; height: 36px; padding: 0;"
      >
        <IconifyIcon icon="mdi:plus" :size="20" />
      </Button>
    </div>
    <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">
      最大值: {{ connectionCount }} (已连接节点数)
    </div>
  </div>
</template>
