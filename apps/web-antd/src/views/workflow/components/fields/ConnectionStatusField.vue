<script lang="ts" setup>
import { computed } from 'vue';
import { Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import { useWorkflowStore } from '#/store/workflow';
import { flowControlNodeRegistry } from '../../nodes/types';

const props = defineProps<{
  field: any;
  nodeConfigForm: Record<string, any>;
  pluginGroups: any[];
}>();

const store = useWorkflowStore();

const fieldKey = computed(() => props.field.props.key || props.field.key);

// 收集链式后代节点（与 SwitchCasesField 保持一致）
function collectChainDescendants(nodeId: string): any[] {
  const workflow = store.currentWorkflow;
  const edges = workflow?.edges || [];
  const nodes = workflow?.nodes || [];
  const result: any[] = [];
  const visitedIds = new Set<string>([nodeId]);

  let currentId = nodeId;
  while (currentId) {
    const currentNode = nodes.find((n: any) => n.id === currentId);
    // 如果当前节点是容器节点（Switch/If/ForEach/Parallel），停止链遍历
    // 容器内部的子节点通过容器的边连接，不属于当前分支的链式后代
    if (currentNode && flowControlNodeRegistry.isFlowControlContainer(currentNode.data.type)) {
      break;
    }
    const downstreamEdges = edges.filter((e: any) => e.source === currentId);
    let nextId: string | undefined;
    for (const edge of downstreamEdges) {
      const targetNode = nodes.find((n: any) => n.id === edge.target);
      if (!targetNode) continue;
      if (visitedIds.has(targetNode.id)) continue;
      if (targetNode.data.type === 'idp_core_flow_End') continue;
      // 遇到容器节点，停止链遍历
      if (flowControlNodeRegistry.isFlowControlContainer(targetNode.data.type)) {
        return result;
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

// 收集所有节点：直接配置项 + 链式后代
const allItems = computed(() => {
  const configItems = props.nodeConfigForm[fieldKey.value];
  if (!Array.isArray(configItems)) return [];

  const result: any[] = [];
  const visitedIds = new Set<string>();

  for (const item of configItems) {
    if (item.nodeId) {
      if (!visitedIds.has(item.nodeId)) {
        visitedIds.add(item.nodeId);
        // 直接连接的节点都显示（包括容器节点）
        result.push(item);
      }
      // 收集该节点后的链式后代（遇到容器节点会停止）
      const chainItems = collectChainDescendants(item.nodeId);
      for (const chainItem of chainItems) {
        if (!visitedIds.has(chainItem.nodeId)) {
          visitedIds.add(chainItem.nodeId);
          result.push(chainItem);
        }
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
