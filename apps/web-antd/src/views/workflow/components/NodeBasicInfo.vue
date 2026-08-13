<script lang="ts" setup>
import { Input } from 'ant-design-vue';

const props = defineProps<{
  node: any;
  nodeTypeDisplayName: string;
}>();

const emit = defineEmits<{
  (e: 'updateNodeLabel', value: string): void;
}>();
</script>

<template>
  <div class="space-y-1">
    <div>
      <div class="text-xs text-gray-500 mb-0.5">节点ID</div>
      <Input
        :value="props.node.id"
        :disabled="true"
      />
    </div>
    <div>
      <div class="text-xs text-gray-500 mb-0.5">节点类型</div>
      <Input
        :value="nodeTypeDisplayName"
        :disabled="true"
      />
    </div>
    <div>
      <div class="text-xs text-gray-500 flex items-center gap-1 mb-0.5">
        <span>节点名称</span>
        <span class="text-red-500">*</span>
      </div>
      <div class="flex items-center gap-2">
        <Input
          :value="props.node.data.label"
          @input="(e: any) => emit('updateNodeLabel', e.target.value)"
          placeholder="请输入节点名称"
        />
      </div>
    </div>
  </div>
</template>
