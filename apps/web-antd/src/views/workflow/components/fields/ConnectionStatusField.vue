<script lang="ts" setup>
import { computed } from 'vue';
import { Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import { useWorkflowStore } from '#/store/workflow';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
  pluginGroups: any[];
}>();

const store = useWorkflowStore();

const fieldKey = computed(() => props.field.props.key || props.field.key);

// Collect all items including chain descendants via edges
const allItems = computed(() => {
  const configItems = props.nodeConfigForm[fieldKey.value];
  if (!Array.isArray(configItems)) return [];

  const workflow = store.currentWorkflow;
  const edges = workflow?.edges || [];
  const nodes = workflow?.nodes || [];

  const result: any[] = [];
  const visitedIds = new Set<string>();

  for (const item of configItems) {
    if (item.nodeId) {
      if (!visitedIds.has(item.nodeId)) {
        visitedIds.add(item.nodeId);
        result.push(item);
      }
      // Collect chain descendants via edges
      let currentId = item.nodeId;
      while (currentId) {
        const downstreamEdges = edges.filter((e: any) => e.source === currentId);
        let nextId: string | undefined;
        for (const edge of downstreamEdges) {
          const targetNode = nodes.find((n: any) => n.id === edge.target);
          if (!targetNode) continue;
          if (visitedIds.has(targetNode.id)) continue;
          // Skip flow control nodes and end nodes
          if (targetNode.data.type === 'idp_core_flow_End') continue;
          // Check if it's a flow control container node (has taskFields)
          const fcConfig = targetNode.data.config;
          const hasTaskFields = fcConfig && (fcConfig.cases || fcConfig.defaults || fcConfig.then || fcConfig.else || fcConfig.tasks);
          if (hasTaskFields && (fcConfig.cases || fcConfig.defaults || fcConfig.then || fcConfig.else)) {
            continue;
          }
          visitedIds.add(targetNode.id);
          // Create display item from node
          const displayItem = {
            nodeId: targetNode.id,
            type: targetNode.data.type,
            label: targetNode.data.label,
          };
          result.push(displayItem);
          nextId = targetNode.id;
          break;
        }
        currentId = nextId;
      }
    } else {
      result.push(item);
    }
  }

  return result;
});

function getConnectionCount() {
  return allItems.value.length;
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
    <div style="background: #f0f9ff; border-radius: 8px; padding: 12px; border: 1px dashed #93c5fd;">
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
        <IconifyIcon icon="mdi:link-variant" :size="16" class="text-blue-500" />
        <span style="font-size: 13px; font-weight: 500; color: #1e40af;">{{ field.props.label }}</span>
        <span style="font-size: 12px; color: #6b7280;">({{ getConnectionCount() }} 个节点)</span>
      </div>
      <div v-if="getConnectionCount() > 0" style="display: flex; flex-direction: column; gap: 6px;">
        <div v-for="(item, index) in allItems" :key="fieldKey + '-conn-' + index"
             style="display: flex; align-items: center; gap: 8px; background: white; padding: 6px 10px; border-radius: 6px; border: 1px solid #e5e7eb;">
          <IconifyIcon icon="mdi:arrow-right-bottom" :size="14" class="text-green-500" />
          <span style="font-size: 13px; color: #374151; flex: 1;">
            {{ item.label || pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === item.type)?.nodeName || item.type }}
          </span>
          <span v-if="item.nodeId" style="font-size: 11px; color: #9ca3af;">画布节点</span>
        </div>
      </div>
      <div v-else style="text-align: center; padding: 8px; color: #9ca3af; font-size: 12px;">
        在画布上从此节点的端口拖线连接子节点
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
