<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { Card, Button, message, Popconfirm, Tooltip, Space, Tag } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import { useWorkflowStore } from '#/store/workflow';

const router = useRouter();
const store = useWorkflowStore();

const workflows = computed(() => {
  if (!store.selectedFolderId) {
    return store.workflows;
  }
  return store.workflows.filter((w) => w.folderId === store.selectedFolderId);
});

function handleCreate() {
  const newWorkflow = store.createWorkflow('未命名流程', store.selectedFolderId);
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
  store.deleteWorkflow(workflowId);
  message.success('删除成功');
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

onMounted(() => {
  store.initMockData();
});
</script>

<template>
  <div class="flex flex-col h-full p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-800">
        {{ store.selectedFolderId ? '流程' : '全部流程' }}
      </h2>
      <Button type="primary" @click="handleCreate">
        <IconifyIcon icon="mdi:plus" :size="16" />
        创建流程
      </Button>
    </div>

    <div v-if="workflows.length > 0" class="flex-1 overflow-y-auto">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          v-for="workflow in workflows"
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

    <div v-else class="flex-1 flex items-center justify-center">
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
  </div>
</template>
