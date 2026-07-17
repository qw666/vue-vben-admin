<script lang="ts" setup>import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Card, Button, message, Popconfirm, Tooltip, Space, Tag, Input } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import { useWorkflowStore } from '#/store/workflow';
const router = useRouter();
const store = useWorkflowStore();
const searchInput = ref('');
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const filteredWorkflows = computed(() => {
 let result = store.workflows;
 if (store.selectedFolderId) {
 result = result.filter((w) => w.folderId === store.selectedFolderId);
 }
 if (searchInput.value.trim()) {
 const keyword = searchInput.value.toLowerCase();
 result = result.filter((w) => w.name.toLowerCase().includes(keyword) ||
 w.description.toLowerCase().includes(keyword));
 }
 return result;
});
function handleCreate() {
 const folderId = store.selectedFolderId || undefined;
 const newWorkflow = store.createWorkflow('未命名流程', folderId);
 router.push(`/workflow/editor/${newWorkflow.id}`);
}
function handleEdit(workflowId: string) {
 router.push(`/workflow/editor/${workflowId}`);
}
async function handleRun(workflowId: string) {
 message.info('正在运行流程...');
 setTimeout(() => {
 message.success('流程运行成功');
 }, 1500);
}
async function handleDelete(workflowId: string) {
 const success = await store.deleteWorkflowById(workflowId);
 if (success) {
 message.success('删除成功');
 }
 else {
 message.error('删除失败');
 }
}
function triggerSearch() {
 if (searchTimer) {
 clearTimeout(searchTimer);
 }
 searchTimer = setTimeout(() => {
 store.setSearchKeyword(searchInput.value);
 store.loadWorkflows(store.selectedFolderId || undefined, searchInput.value);
 }, 300);
}
function handleSearchClear() {
 searchInput.value = '';
 store.setSearchKeyword('');
 store.loadWorkflows(store.selectedFolderId || undefined);
}
function formatDate(dateStr: string) {
 try {
 const date = new Date(dateStr);
 return date.toLocaleDateString('zh-CN', {
 year: 'numeric',
 month: '2-digit',
 day: '2-digit',
 });
 }
 catch {
 return '-';
 }
}
watch(searchInput, () => {
 triggerSearch();
});
</script>

<template>
  <div class="flex flex-col h-full">
    <Card class="rounded-t-lg rounded-b-none border-b-0">
      <div class="flex items-center justify-between">
        <div class="w-48">
          <Input
            v-model:value="searchInput"
            placeholder="搜索流程名称"
            size="small"
            allow-clear
            @clear="handleSearchClear"
          >
            <template #prefix>
              <IconifyIcon icon="mdi:search" :size="14" />
            </template>
          </Input>
        </div>
        <Button type="primary" @click="handleCreate">
          <IconifyIcon icon="mdi:plus" :size="16" />
          创建流程
        </Button>
      </div>
    </Card>

    <Card class="flex-1 overflow-hidden rounded-t-none rounded-b-lg">
      <div v-if="store.isWorkflowsLoading" class="h-full flex items-center justify-center">
        <div class="text-center">
          <IconifyIcon icon="mdi:loader" :size="32" class="text-blue-500 animate-spin" />
          <p class="text-gray-500 mt-2">加载中...</p>
        </div>
      </div>

      <div v-else-if="filteredWorkflows.length > 0" class="h-full overflow-y-auto p-2">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card
            v-for="workflow in filteredWorkflows"
            :key="workflow.id"
            hoverable
            class="cursor-pointer group"
            @click="handleEdit(workflow.id)"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                  <IconifyIcon icon="mdi:flow-tree" :size="20" />
                </div>
                <div>
                  <h3 class="font-semibold text-gray-800">{{ workflow.name }}</h3>
                  <span class="text-xs text-gray-500">{{ workflow.nodes.length }} 个节点</span>
                </div>
              </div>
              <Tag color="blue">草稿</Tag>
            </div>
            <p class="text-sm text-gray-600 mb-4 line-clamp-2">
              {{ workflow.description || '暂无描述' }}
            </p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">
                更新于 {{ formatDate(workflow.updatedAt) }}
              </span>
              <Space size="small" class="opacity-0 group-hover:opacity-100 transition-opacity">
                <Tooltip title="编辑">
                  <Button type="text" size="small" @click.stop="handleEdit(workflow.id)">
                    <IconifyIcon icon="mdi:pencil" :size="16" />
                  </Button>
                </Tooltip>
                <Tooltip title="运行">
                  <Button type="text" size="small" @click.stop="handleRun(workflow.id)">
                    <IconifyIcon icon="mdi:play" :size="16" />
                  </Button>
                </Tooltip>
                <Popconfirm title="确定删除这个流程吗？" ok-text="确定" cancel-text="取消">
                  <Tooltip title="删除">
                    <Button type="text" size="small" danger @click.stop="handleDelete(workflow.id)">
                      <IconifyIcon icon="mdi:trash-can" :size="16" />
                    </Button>
                  </Tooltip>
                </Popconfirm>
              </Space>
            </div>
          </Card>
        </div>
      </div>

      <div v-else class="h-full flex items-center justify-center">
        <div class="text-center">
          <div class="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <IconifyIcon icon="mdi:flow-tree" :size="40" class="text-gray-400" />
          </div>
          <h3 class="text-lg font-medium text-gray-600 mb-2">暂无流程</h3>
          <p class="text-gray-400 mb-4">点击上方按钮创建第一个流程</p>
          <Button type="primary" @click="handleCreate">
            <IconifyIcon icon="mdi:plus" :size="16" />
            创建流程
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>
