<script lang="ts" setup>
import { Button, Input, InputNumber, Switch, Textarea, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

defineProps<{
  show: boolean;
  isPluginLoading: boolean;
  isMetaLoading: boolean;
  pluginGroups: any[];
  selectedChildNodeType: string;
  selectedChildNodeMeta: any;
  selectedChildNodeLabel: string;
  childNodeConfigForm: Record<string, any>;
  currentArrayIndex: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selectChildNode', nodeType: string): void;
  (e: 'confirmAdd'): void;
  (e: 'confirmEdit'): void;
}>();

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    '流程控制': 'bg-purple-500',
    'HTTP操作': 'bg-blue-500',
    '输出操作': 'bg-green-500',
    '触发器': 'bg-orange-500',
    '基础': 'bg-gray-500',
  };
  return colors[category] || 'bg-gray-500';
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-[900px] h-[600px] flex flex-col">
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-800">选择子节点</h2>
        <Button type="text" @click="emit('close')">
          <IconifyIcon icon="mdi:close" :size="18" />
        </Button>
      </div>
      <div class="flex-1 flex overflow-hidden">
        <div class="w-1/2 border-r border-gray-200 overflow-y-auto p-4">
          <div v-if="isPluginLoading" class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
          <div v-else>
            <div v-for="group in pluginGroups" :key="group.groupKey">
              <h3 class="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" :class="getCategoryColor(group.groupName)" />
                {{ group.groupName }}
              </h3>
              <div class="space-y-2">
                <div
                  v-for="plugin in group.pluginList"
                  :key="plugin.type"
                  class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border"
                  :class="selectedChildNodeType === plugin.type ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'"
                  @click="emit('selectChildNode', plugin.type)"
                >
                  <div
                    class="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    :class="getCategoryColor(group.groupName)"
                  >
                    <IconifyIcon :icon="plugin.icon" :size="20" />
                  </div>
                  <div class="flex-1">
                    <div class="text-sm font-medium text-gray-800">{{ plugin.nodeName }}</div>
                    <div class="text-xs text-gray-500">{{ plugin.description }}</div>
                  </div>
                  <div v-if="selectedChildNodeType === plugin.type">
                    <IconifyIcon icon="mdi:check-circle" :size="18" class="text-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="w-1/2 overflow-y-auto p-4">
          <div v-if="!selectedChildNodeType" class="flex items-center justify-center h-full text-gray-500">
            请从左侧选择一个节点
          </div>
          <div v-else-if="isMetaLoading" class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
          <div v-else>
            <div class="p-4 bg-blue-50 rounded-lg mb-4">
              <div class="flex items-center gap-2">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                  :class="getCategoryColor(pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === selectedChildNodeType)?.category || '基础')"
                >
                  <IconifyIcon :icon="pluginGroups.flatMap((g: any) => g.pluginList).find((p: any) => p.type === selectedChildNodeType)?.icon" :size="20" />
                </div>
                <div>
                  <div class="text-base font-medium text-gray-800">{{ selectedChildNodeLabel }}</div>
                  <div class="text-xs text-gray-500">{{ selectedChildNodeType }}</div>
                </div>
              </div>
              <div v-if="selectedChildNodeMeta?.description" class="mt-2 text-sm text-blue-800">
                {{ selectedChildNodeMeta.description }}
              </div>
            </div>
            <div v-if="selectedChildNodeMeta?.parsedSchema?.description" class="p-4 bg-gray-50 rounded-lg mb-4">
              <div class="text-sm text-gray-600 font-medium mb-1">配置说明</div>
              <div class="text-sm text-gray-800">{{ selectedChildNodeMeta.parsedSchema.description }}</div>
            </div>
            <div v-if="selectedChildNodeMeta?.formProperties">
              <div v-if="Object.keys(selectedChildNodeMeta.formProperties).filter((k: string) => k !== '$schema').length === 0" class="text-center text-gray-500 py-4">
                该节点暂无配置项
              </div>
              <div v-else>
                <div class="space-y-4">
                  <div v-for="(prop, propKey) in selectedChildNodeMeta.formProperties" :key="propKey" v-show="propKey !== '$schema'">
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-sm font-medium text-gray-700">
                        {{ prop.title || propKey }}
                        <span v-if="prop.$required" class="text-red-500 ml-1">*</span>
                      </label>
                      <div class="flex items-center gap-2">
                        <span v-if="prop.$dynamic === true" class="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded">动态</span>
                        <Tooltip v-if="prop.description" :title="prop.description">
                          <IconifyIcon icon="mdi:help-circle" :size="14" class="text-gray-400" />
                        </Tooltip>
                      </div>
                    </div>
                    <Input
                      v-if="prop.type === 'string' || prop.anyOf"
                      v-model:value="childNodeConfigForm[propKey]"
                      :placeholder="prop.$dynamic === true ? '支持动态表达式，如 {{ variable }}' : prop.description || '请输入'"
                      class="w-full"
                      size="small"
                    />
                    <InputNumber
                      v-else-if="prop.type === 'number' || prop.type === 'integer'"
                      v-model:value="childNodeConfigForm[propKey]"
                      :min="prop.minimum"
                      class="w-full"
                      size="small"
                    />
                    <Switch
                      v-else-if="prop.type === 'boolean'"
                      :checked="childNodeConfigForm[propKey]"
                      @change="(val: any) => { (childNodeConfigForm as Record<string, any>)[propKey] = val; }"
                    />
                    <Textarea
                      v-else-if="prop.type === 'object' || prop.type === 'array'"
                      :value="typeof childNodeConfigForm[propKey] === 'string' ? childNodeConfigForm[propKey] : JSON.stringify(childNodeConfigForm[propKey], null, 2)"
                      @input="(e: any) => { (childNodeConfigForm as Record<string, any>)[propKey] = e.target.value; }"
                      :placeholder="prop.description || '请输入JSON格式数据'"
                      :rows="3"
                      class="w-full"
                      size="small"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="p-4 border-t border-gray-200 flex items-center justify-end gap-2">
        <Button @click="emit('close')">取消</Button>
        <Button type="primary" @click="currentArrayIndex >= 0 ? emit('confirmEdit') : emit('confirmAdd')">
          {{ currentArrayIndex >= 0 ? '确定修改' : '确定添加' }}
        </Button>
      </div>
    </div>
  </div>
</template>
