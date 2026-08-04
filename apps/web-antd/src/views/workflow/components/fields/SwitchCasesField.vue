<script lang="ts" setup>
import { computed } from 'vue';
import { Input, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import { useWorkflowStore } from '#/store/workflow';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
  pluginGroups: any[];
}>();

const store = useWorkflowStore();

const fieldKey = computed(() => props.field.props.key || props.field.key);

const emit = defineEmits<{
  (e: 'updateCaseKey', fieldKey: string, oldKey: string, newKey: string): void;
  (e: 'removeCaseKey', fieldKey: string, caseKey: string): void;
  (e: 'removeNodeFromCase', fieldKey: string, caseKey: string, index: number): void;
}>();

function getCaseCount() {
  const cases = props.nodeConfigForm[fieldKey.value];
  return typeof cases === 'object' && cases !== null && !Array.isArray(cases)
    ? Object.keys(cases).length
    : 0;
}

// Collect chain descendants for a given nodeId
function collectChainDescendants(nodeId: string): any[] {
  const workflow = store.currentWorkflow;
  const edges = workflow?.edges || [];
  const nodes = workflow?.nodes || [];
  const result: any[] = [];
  const visitedIds = new Set<string>([nodeId]);

  let currentId = nodeId;
  while (currentId) {
    const downstreamEdges = edges.filter((e: any) => e.source === currentId);
    let nextId: string | undefined;
    for (const edge of downstreamEdges) {
      const targetNode = nodes.find((n: any) => n.id === edge.target);
      if (!targetNode) continue;
      if (visitedIds.has(targetNode.id)) continue;
      if (targetNode.data.type === 'idp_core_flow_End') continue;
      // Skip flow control container nodes
      const fcConfig = targetNode.data.config;
      const hasTaskFields = fcConfig && (fcConfig.cases || fcConfig.defaults || fcConfig.then || fcConfig.else || fcConfig.tasks);
      if (hasTaskFields && (fcConfig.cases || fcConfig.defaults || fcConfig.then || fcConfig.else)) {
        continue;
      }
      visitedIds.add(targetNode.id);
      result.push({
        nodeId: targetNode.id,
        type: targetNode.data.type,
        label: targetNode.data.label,
      });
      nextId = targetNode.id;
      break;
    }
    currentId = nextId;
  }
  return result;
}

// Get all items for a case, including chain descendants
function getAllCaseItems(caseItems: any[]): any[] {
  const result: any[] = [];
  if (!Array.isArray(caseItems)) return result;

  for (const item of caseItems) {
    result.push(item);
    if (item.nodeId) {
      const chainItems = collectChainDescendants(item.nodeId);
      result.push(...chainItems);
    }
  }
  return result;
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
          <span class="help-icon-wrapper">
            <IconifyIcon icon="mdi:help-circle" :size="14" style="color: #6b7280; pointer-events: none;" />
          </span>
        </Tooltip>
      </div>
    </div>
    <div style="background: #fef3c7; border-radius: 8px; padding: 12px; border: 1px dashed #fbbf24;">
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
        <IconifyIcon icon="mdi:source-branch" :size="16" class="text-amber-600" />
        <span style="font-size: 13px; font-weight: 500; color: #92400e;">{{ field.props.label }}</span>
      </div>

      <div v-if="getCaseCount() > 0" style="display: flex; flex-direction: column; gap: 8px;">
        <template v-for="(caseItems, caseKey, caseIndex) in (nodeConfigForm[fieldKey] || {})" :key="fieldKey + '-case-' + caseIndex">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div v-for="(item, index) in getAllCaseItems(caseItems as any[])" :key="fieldKey + '-case-' + caseIndex + '-item-' + index"
                 style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: #fffbeb; border-radius: 4px;">
              <Input
                v-if="index === 0"
                :value="caseKey"
                @blur="(e: any) => emit('updateCaseKey', fieldKey, caseKey as string, e.target.value)"
                style="width: 80px;"
                size="small"
                placeholder="值"
              />
              <span v-else style="width: 80px; text-align: left;"></span>
              <IconifyIcon icon="mdi:arrow-right-bottom" :size="12" class="text-green-500" />
              <span style="font-size: 12px; color: #374151; flex: 1;">
                {{ item.label || pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === item.type)?.nodeName || item.type }}
              </span>
              <span v-if="item.nodeId" style="font-size: 10px; color: #9ca3af;">画布节点</span>
            </div>
          </div>
        </template>
      </div>
      <div v-else style="text-align: center; padding: 12px; color: #9ca3af; font-size: 12px;">
        在画布上从 Switch 节点的端口拖线连接子节点，自动创建分支
      </div>
    </div>
    <div
      v-if="field.props.description"
      style="margin-top: 4px; font-size: 12px; color: #9ca3af;"
    >
      {{ field.props.description }}
    </div>
  </div>
</template>

<style scoped>
.help-icon-wrapper {
  display: inline-flex;
  align-items: center;
}
</style>
