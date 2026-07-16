<script lang="ts" setup>
import { computed } from 'vue';
import { Button, Input, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
  pluginGroups: any[];
}>();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const emit = defineEmits<{
  (e: 'updateCaseKey', fieldKey: string, oldKey: string, newKey: string): void;
  (e: 'removeCaseKey', fieldKey: string, caseKey: string): void;
  (e: 'updateNodeValue', fieldKey: string, caseKey: string, index: number, value: string): void;
  (e: 'removeNodeFromCase', fieldKey: string, caseKey: string, index: number): void;
}>();

function getCaseCount() {
  const cases = props.nodeConfigForm[fieldKey.value];
  return typeof cases === 'object' && cases !== null && !Array.isArray(cases)
    ? Object.keys(cases).length
    : 0;
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
        <span v-if="field.props.fieldType" style="font-size: 12px; padding: 2px 8px; background: #f3f4f6; color: #4b5563; border-radius: 4px;">{{ field.props.fieldType }}</span>
        <Tooltip v-if="field.props.tooltip" :title="field.props.tooltip">
          <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #9ca3af;" />
        </Tooltip>
      </div>
    </div>
    <div style="background: #fef3c7; border-radius: 8px; padding: 12px; border: 1px dashed #fbbf24;">
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
        <IconifyIcon icon="mdi:git-branch" :size="16" class="text-amber-600" />
        <span style="font-size: 13px; font-weight: 500; color: #92400e;">{{ field.props.label }}</span>
      </div>

      <div v-if="getCaseCount() > 0" style="display: flex; flex-direction: column; gap: 4px;">
        <template v-for="(caseItems, caseKey) in (nodeConfigForm[fieldKey] || {})" :key="fieldKey + '-case-' + caseKey">
          <div v-for="(item, index) in caseItems" :key="fieldKey + '-case-' + caseKey + '-item-' + index"
               style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: #fffbeb; border-radius: 4px;">
            <Button size="small" danger ghost circle style="padding: 2px;" @click="emit('removeNodeFromCase', fieldKey, caseKey as string, index as number)">
              <IconifyIcon icon="mdi:minus" :size="12" />
            </Button>
            <Input
              :value="item.value || ''"
              @input="(e: any) => emit('updateNodeValue', fieldKey, caseKey as string, index as number, e.target.value)"
              style="width: 80px;"
              size="small"
              placeholder="值"
            />
            <IconifyIcon icon="mdi:arrow-right-bottom" :size="12" class="text-green-500" />
            <span style="font-size: 12px; color: #9ca3af;">{{ caseKey }}</span>
            <span style="font-size: 12px; color: #374151; flex: 1;">
              {{ pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === item.type)?.nodeName || item.type }}
            </span>
            <span v-if="item.nodeId" style="font-size: 10px; color: #9ca3af;">画布节点</span>
          </div>
        </template>
      </div>
      <div v-else style="text-align: center; padding: 12px; color: #9ca3af; font-size: 12px;">
        在画布上从 Switch 节点的端口拖线连接子节点，自动创建分支
      </div>
    </div>
  </div>
</template>
