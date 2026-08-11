<script lang="ts" setup>
import { computed, ref } from 'vue';
import { IconifyIcon } from '@vben/icons';
import { Input } from 'ant-design-vue';
import {
  getVisibleFrontendNodes,
  getGroupKey,
  getGroupLabel,
} from '../config/workflow-node-config';
import { resolveNodeIcon } from '../utils/nodeIcon';

const props = defineProps<{
  activeTab: string;
  isPluginLoading: boolean;
  pluginGroups: any[];
}>();

const emit = defineEmits<{
  (e: 'switchTab', tab: string): void;
  (e: 'dragStart', event: DragEvent, nodeType: string): void;
}>();

const searchKeyword = ref('');

/**
 * 合并前端节点到后端分组
 * 
 * 逻辑：
 * 1. 前端节点优先：如果前端已有某个节点类型(type)，后端返回的同类型节点被忽略
 * 2. 如果前端没有某个节点类型，则后端返回的节点正常显示
 * 3. 前端节点的 group 直接与后端 groupKey 对齐
 */
const mergedGroups = computed(() => {
  const frontendNodes = getVisibleFrontendNodes();

  // 1. 构建前端分组映射和节点类型集合
  const frontendGroupMap = new Map<string, any>();
  const frontendTypeSet = new Set<string>();

  for (const node of frontendNodes) {
    const groupKey = getGroupKey(node.group);
    const groupName = getGroupLabel(node.group);

    if (!frontendGroupMap.has(groupKey)) {
      frontendGroupMap.set(groupKey, {
        groupKey,
        groupName,
        sort: 0,
        pluginList: [],
      });
    }

    const pluginItem = {
      type: node.type,
      nodeName: node.nodeName,
      icon: node.icon,
      description: node.description,
    };

    const group = frontendGroupMap.get(groupKey);
    const exists = group.pluginList.find((p: any) => p.type === node.type);
    if (!exists) {
      group.pluginList.push(pluginItem);
      frontendTypeSet.add(node.type);
    }
  }

  // 2. 处理后端节点：如果前端已有同类型节点则忽略，否则添加到对应分组
  for (const backendGroup of props.pluginGroups) {
    if (!backendGroup.pluginList) continue;

    for (const backendNode of backendGroup.pluginList) {
      // 如果前端已有该类型节点，跳过
      if (frontendTypeSet.has(backendNode.type)) continue;

      // 添加到对应分组（前端分组优先使用前端的 groupName）
      const groupKey = backendGroup.groupKey;
      let targetGroup = frontendGroupMap.get(groupKey);

      if (targetGroup) {
        // 添加到已有前端分组
        targetGroup.pluginList.push(backendNode);
      } else {
        // 创建新分组（使用后端的 groupName）
        frontendGroupMap.set(groupKey, {
          groupKey,
          groupName: backendGroup.groupName,
          sort: backendGroup.sort || 0,
          pluginList: [backendNode],
        });
      }
      frontendTypeSet.add(backendNode.type);
    }
  }

  // 3. 转换为数组并排序
  return Array.from(frontendGroupMap.values()).sort(
    (a, b) => (a.sort || 0) - (b.sort || 0),
  );
});

const filteredGroups = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  if (!keyword) return mergedGroups.value;

  return mergedGroups.value
    .map(group => ({
      ...group,
      pluginList: group.pluginList.filter((plugin: any) =>
        plugin?.nodeName?.toLowerCase().includes(keyword),
      ),
    }))
    .filter(group => group.pluginList.length > 0);
});
</script>

<template>
  <div class="w-48 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
    <div class="flex-shrink-0 px-4 py-3 space-y-3">
      <Input
        v-model:value="searchKeyword"
        placeholder="搜索节点名称"
        allow-clear
      >
        <template #prefix>
          <IconifyIcon icon="mdi:magnify" :size="16" class="text-gray-400" />
        </template>
      </Input>
      <div class="flex gap-2">
        <button
          class="flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200"
          :class="activeTab === 'task' ? 'bg-primary/10 text-primary' : 'bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
          @click="emit('switchTab', 'task')"
        >
          节点
        </button>
        <button
          class="flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200"
          :class="activeTab === 'template' ? 'bg-primary/10 text-primary' : 'bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
          @click="emit('switchTab', 'template')"
        >
          模板
        </button>
      </div>
    </div>
    <div class="h-px bg-gray-100" />
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="activeTab === 'template'" class="text-center text-gray-500 py-12">
        暂无模板
      </div>
      <template v-else>
        <div v-if="isPluginLoading" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
        <div v-else-if="filteredGroups.length === 0 && searchKeyword" class="text-center text-gray-500 py-8 text-sm">
          未找到匹配的节点
        </div>
        <div v-else>
          <div
            v-for="(group, index) in filteredGroups"
            :key="group.groupKey"
            class="group-section pb-4 mb-4"
            :class="{ 'border-b border-gray-100': index < filteredGroups.length - 1 }"
          >
            <h3 class="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-2">
              <span class="w-1 h-3.5 rounded-sm bg-primary" />
              {{ group.groupName }}
            </h3>
            <div class="space-y-2">
              <div
                v-for="plugin in group.pluginList"
                :key="plugin?.type"
                v-show="plugin && plugin.type"
                class="flex items-center justify-start px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-200 border border-gray-200 hover:border-primary/50 hover:bg-primary/5 w-full"
                draggable="true"
                @dragstart="(e) => emit('dragStart', e, plugin.type)"
              >
                <div class="flex items-center gap-2">
                  <div
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-primary-foreground bg-gradient-to-br from-primary to-primary-600"
                  >
                    <IconifyIcon :icon="resolveNodeIcon(plugin.icon)" :size="14" />
                  </div>
                  <span class="font-medium text-sm text-gray-700">{{ plugin.nodeName }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
