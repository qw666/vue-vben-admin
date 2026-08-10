<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

defineProps<{
  field: any;
}>();
</script>

<template>
  <div class="field-renderer">
    <div
      :style="{
        background: field.props.background || '#eff6ff',
        border: `1px solid ${field.props.borderColor || '#93c5fd'}`,
        borderRadius: '8px',
        padding: '12px',
      }"
    >
      <div
        v-if="field.props.title"
        style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px"
      >
        <IconifyIcon
          :icon="field.props.icon || 'mdi:information'"
          :size="16"
          :style="{ color: field.props.iconColor || '#2563eb' }"
        />
        <span
          :style="{
            fontSize: '13px',
            fontWeight: 600,
            color: field.props.titleColor || '#1e40af',
          }"
        >
          {{ field.props.title }}
        </span>
      </div>
      <div
        v-if="field.props.steps && field.props.steps.length > 0"
        style="display: flex; flex-direction: column; gap: 6px"
      >
        <div
          v-for="(step, index) in field.props.steps"
          :key="index"
          style="display: flex; gap: 8px; align-items: flex-start"
        >
          <span
            :style="{
              flexShrink: 0,
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: field.props.iconColor || '#2563eb',
              color: 'white',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '1px',
            }"
          >
            {{ (index as number) + 1 }}
          </span>
          <span style="font-size: 12px; line-height: 1.5; color: #374151">
            {{ step }}
          </span>
        </div>
      </div>
      <div
        v-else-if="field.props.content"
        style="font-size: 12px; line-height: 1.6; color: #374151"
      >
        {{ field.props.content }}
      </div>
    </div>
  </div>
</template>
