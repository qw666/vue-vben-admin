<script lang="ts" setup>
import CronField from '../fields/CronField.vue';

const props = defineProps<{
  trigger: any;
}>();

const emit = defineEmits<{
  (e: 'updateField', key: string, value: any): void;
}>();
</script>

<template>
  <div style="margin-top: 4px;">
    <div style="padding: 12px 0;">
      <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 10px;">
        定时调度配置
      </div>
      <CronField
        :model-value="props.trigger.cron"
        @update:model-value="(val: string) => emit('updateField', 'cron', val)"
      />
    </div>
  </div>
</template>