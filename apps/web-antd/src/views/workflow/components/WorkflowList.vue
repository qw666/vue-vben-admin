<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Card,
  DatePicker,
  Input,
  message,
  Pagination,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { useWorkflowStore } from '#/store/workflow';
const router = useRouter();
const store = useWorkflowStore();
const searchInput = ref('');
const startTime = ref<string | undefined>();
const endTime = ref<string | undefined>();
const currentPage = ref(1);
const pageSize = ref(10);
const runningWorkflowId = ref<string | null>(null);
let searchTimer: null | ReturnType<typeof setTimeout> = null;

const workflows = computed(() => store.workflows);
function handleCreate() {
  if (store.selectedFolderId === null) {
    message.warning('请先选择左侧文件夹');
    return;
  }
  const newWorkflow = store.createWorkflow(
    '未命名流程',
    store.selectedFolderId,
  );
  store.setCurrentWorkflow(newWorkflow);
  router.push('/shuzhiliu/workflow/editor');
}
function handleEdit(workflowId: string) {
  router.push(`/shuzhiliu/workflow/editor/${workflowId}`);
}
async function handleRun(workflowId: string) {
  if (runningWorkflowId.value) return;
  const workflow = workflows.value.find((w) => w.id === workflowId);
  if (!workflow?.flowId) {
    message.warning('工作流ID不存在，请先保存流程');
    return;
  }
  if (workflow.enabled === false) {
    message.warning('流程已停用，请先启用流程');
    return;
  }
  runningWorkflowId.value = workflowId;
  try {
    const success = await store.runWorkflow(workflowId);
    if (success) {
      message.success('流程运行成功');
    } else {
      message.error('流程运行失败');
    }
  } catch (error) {
    console.error('Failed to run workflow:', error);
    message.error('流程运行失败');
  } finally {
    runningWorkflowId.value = null;
  }
}
async function handleDelete(workflowId: string) {
  const success = await store.deleteWorkflowById(workflowId);
  if (success) {
    message.success('删除成功');
  } else {
    message.error('删除失败');
  }
}

async function handleToggleEnable(workflow: any) {
  if (!workflow.flowId) {
    message.warning('流程ID不存在，请先保存流程');
    return;
  }
  if (workflow.enabled === false) {
    const success = await store.enableWorkflow(workflow.flowId);
    if (success) {
      message.success('流程已启用');
    } else {
      message.error('启用失败');
    }
  } else {
    const success = await store.disableWorkflow(workflow.flowId);
    if (success) {
      message.success('流程已停用');
    } else {
      message.error('停用失败');
    }
  }
}
function triggerSearch() {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => {
    currentPage.value = 1;
    store.setSearchKeyword(searchInput.value);
    store.loadWorkflows(
      store.selectedFolderId || undefined,
      searchInput.value,
      startTime.value,
      endTime.value,
      currentPage.value,
      pageSize.value,
    );
  }, 300);
}
function handleSearchClear() {
  searchInput.value = '';
  startTime.value = undefined;
  endTime.value = undefined;
  currentPage.value = 1;
  store.setSearchKeyword('');
  store.loadWorkflows(store.selectedFolderId || undefined);
}
function formatDateTimeForBackend(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  if (dateStr.length === 10) {
    return `${dateStr} 00:00:00`;
  }
  if (dateStr.length === 16) {
    return `${dateStr}:00`;
  }
  return dateStr;
}

function handleDateChange(_dates: [string, string] | [any, any], dateString: [string, string]) {
  startTime.value = formatDateTimeForBackend(dateString[0]);
  endTime.value = dateString[1] ? `${dateString[1]} 23:59:59` : undefined;
  triggerSearch();
}
function handlePageChange(page: number, size?: number) {
  currentPage.value = page;
  if (size !== undefined) {
    pageSize.value = size;
  }
  store.loadWorkflows(
    store.selectedFolderId || undefined,
    searchInput.value,
    startTime.value,
    endTime.value,
    currentPage.value,
    pageSize.value,
  );
}
function handlePageSizeChange(current: number, size: number) {
  currentPage.value = current;
  pageSize.value = size;
  store.loadWorkflows(
    store.selectedFolderId || undefined,
    searchInput.value,
    startTime.value,
    endTime.value,
    currentPage.value,
    pageSize.value,
  );
}
function formatDate(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
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
        <div class="flex items-center gap-4">
          <div class="w-48">
            <Input
              v-model:value="searchInput"
              placeholder="搜索流程名称"
              allow-clear
              @clear="handleSearchClear"
            >
              <template #prefix>
                <IconifyIcon icon="mdi:search" :size="14" />
              </template>
            </Input>
          </div>
          <DatePicker.RangePicker
            :placeholder="['开始时间', '结束时间']"
            style="width: 320px"
            @change="handleDateChange"
          />
        </div>
        <Button type="primary" @click="handleCreate">
          <IconifyIcon icon="mdi:plus" :size="16" />
          创建流程
        </Button>
      </div>
    </Card>

    <Card class="flex-1 overflow-hidden rounded-t-none rounded-b-lg">
      <div
        v-if="store.isWorkflowsLoading"
        class="h-full flex items-center justify-center"
      >
        <div class="text-center">
          <IconifyIcon
            icon="mdi:loading"
            :size="32"
            class="text-blue-500 animate-spin"
          />
          <p class="text-gray-500 mt-2">加载中...</p>
        </div>
      </div>

      <div
        v-else-if="workflows.length > 0"
        class="h-full overflow-y-auto p-2"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card
            v-for="workflow in workflows"
            :key="workflow.id"
            :body-style="{ padding: '12px' }"
          >
            <div class="relative">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center text-primary-foreground flex-shrink-0">
                    <IconifyIcon icon="mdi:workflow" :size="20" />
                  </div>
                  <Tooltip :title="workflow.name">
                    <h3 class="font-semibold text-card-foreground truncate">
                      {{ workflow.name }}
                    </h3>
                  </Tooltip>
                </div>
                <div class="flex items-center gap-1.5">
                  <Tooltip
                    v-if="workflow.triggers && workflow.triggers.length > 0"
                    :title="workflow.hasActiveTrigger ? '有活跃触发器' : '触发器已禁用'"
                  >
                    <div
                      class="w-6 h-6 rounded-full flex items-center justify-center"
                      :class="workflow.hasActiveTrigger ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'"
                    >
                      <IconifyIcon icon="mdi:flash" :size="14" />
                    </div>
                  </Tooltip>
                  <Tag v-if="workflow.status === 'deleted'" color="red">已删除</Tag>
                  <Tag v-else-if="workflow.enabled === false" color="orange">禁用</Tag>
                  <Tag v-else color="green">启用</Tag>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">
                更新于 {{ formatDate(workflow.updatedAt) }}
              </span>
              <Space size="small">
                <Tooltip :title="workflow.enabled === false ? '启用流程' : '停用流程'">
                  <Button
                    type="text"
                    size="small"
                    :class="workflow.enabled === false ? 'text-gray-400 hover:text-orange-500' : 'text-green-500'"
                    @click="handleToggleEnable(workflow)"
                  >
                    <div class="flex items-center gap-1">
                      <div
                        class="w-8 h-4 rounded-full transition-colors duration-200 relative"
                        :class="workflow.enabled === false ? 'bg-gray-300' : 'bg-green-500'"
                      >
                        <div
                          class="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200"
                          :class="workflow.enabled === false ? 'left-0.5' : 'left-[18px]'"
                        ></div>
                      </div>
                    </div>
                  </Button>
                </Tooltip>
                <Tooltip title="编辑">
                  <Button
                    type="text"
                    size="small"
                    @click="handleEdit(workflow.id)"
                  >
                    <IconifyIcon icon="mdi:pencil" :size="16" />
                  </Button>
                </Tooltip>
                <Tooltip :title="workflow.enabled === false ? '流程已停用，无法运行' : '运行'">
                  <Button
                    type="text"
                    size="small"
                    :loading="runningWorkflowId === workflow.id"
                    :disabled="runningWorkflowId !== null || workflow.enabled === false"
                    :class="workflow.enabled === false ? 'text-gray-300 cursor-not-allowed' : ''"
                    @click="handleRun(workflow.id)"
                  >
                    <IconifyIcon icon="mdi:play" :size="16" />
                  </Button>
                </Tooltip>
                <Popconfirm
                  title="确定删除这个流程吗？"
                  ok-text="确定"
                  cancel-text="取消"
                >
                  <Tooltip title="删除">
                    <Button
                      type="text"
                      size="small"
                      danger
                      @click="handleDelete(workflow.id)"
                    >
                      <IconifyIcon icon="mdi:trash-can" :size="16" />
                    </Button>
                  </Tooltip>
                </Popconfirm>
              </Space>
            </div>
          </Card>
        </div>
      </div>

      <div v-else-if="!store.isWorkflowsLoading && workflows.length === 0" class="h-full flex items-center justify-center">
        <div class="text-center">
          <div
            class="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4"
          >
            <IconifyIcon
              icon="mdi:workflow"
              :size="40"
              class="text-gray-400"
            />
          </div>
          <h3 class="text-lg font-medium text-gray-600 mb-2">暂无流程</h3>
          <p class="text-gray-400 mb-4">点击上方按钮创建第一个流程</p>
          <Button type="primary" @click="handleCreate">
            <IconifyIcon icon="mdi:plus" :size="16" />
            创建流程
          </Button>
        </div>
      </div>

      <div
        v-if="store.totalWorkflows > 0"
        class="flex justify-center py-4"
      >
        <Pagination
          :current="currentPage"
          :page-size="pageSize"
          :total="store.totalWorkflows"
          show-size-changer
          :page-size-options="['10', '20', '50']"
          :show-total="(total: number) => `共 ${total} 条`"
          @change="handlePageChange"
          @show-size-change="handlePageSizeChange"
        />
      </div>
    </Card>
  </div>
</template>
