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
  Popconfirm,
  Select,
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

const totalPages = computed(() => {
  if (!store.totalWorkflows) return 1;
  return Math.ceil(store.totalWorkflows / pageSize.value);
});

const pageList = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const pages: (number | string)[] = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (current > 4) {
      pages.push('...');
    }
    const start = Math.max(2, current - 2);
    const end = Math.min(total - 1, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < total - 3) {
      pages.push('...');
    }
    pages.push(total);
  }

  return pages;
});

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return;
  currentPage.value = page;
  store.loadWorkflows(
    store.selectedFolderId || undefined,
    searchInput.value,
    startTime.value,
    endTime.value,
    currentPage.value,
    pageSize.value,
  );
}

function handlePageSizeChange(value: number) {
  pageSize.value = value;
  currentPage.value = 1;
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
  <div class="flex flex-col h-full gap-4">
    <Card class="flex-shrink-0 rounded-lg">
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

    <Card class="flex-1 overflow-hidden rounded-lg" :body-style="{ padding: '16px' }">
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
        class="h-full overflow-y-auto"
      >
        <div class="grid gap-4 pt-2" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); grid-auto-rows: 1fr;">
          <div
            v-for="workflow in workflows"
            :key="workflow.id"
            class="workflow-card bg-white border border-gray-200 rounded-lg p-4 transition-all duration-200 shadow-sm relative flex flex-col"
          >
            <!-- 头部：图标、名称、状态、ID -->
            <div class="mb-0">
              <!-- 第一行：图标 + 名称 + 状态 -->
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center text-primary-foreground flex-shrink-0 shadow-md shadow-primary/30 ring-1 ring-primary/10">
                  <IconifyIcon icon="mdi:workflow" :size="22" />
                </div>
                <Tooltip :title="workflow.name" :overlay-style="{ maxWidth: 'none' }">
                  <h3 class="text-base font-semibold text-gray-800 truncate flex-1 min-w-0">
                    {{ workflow.name }}
                  </h3>
                </Tooltip>
                <span
                  class="inline-flex items-center gap-1 text-xs font-medium flex-shrink-0"
                  :class="workflow.enabled === false ? 'text-red-500' : 'text-green-600'"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="workflow.enabled === false ? 'bg-red-500' : 'bg-green-600'"></span>
                  {{ workflow.enabled === false ? '已停用' : '已启用' }}
                </span>
              </div>
              <!-- 第二行：ID -->
              <div style="padding-left: 22px;">
                <Tooltip :title="`ID: ${workflow.flowId}`" :overlay-style="{ maxWidth: 'none' }">
                  <span class="text-xs text-gray-400 block" style="word-break: break-all; line-height: 16px;">ID: {{ workflow.flowId }}</span>
                </Tooltip>
              </div>
            </div>

            <!-- 中间：触发器信息 -->
            <div class="flex items-center gap-4 py-1.5 my-3 border-t border-gray-100 border-b border-gray-100" style="min-height: 32px;">
              <div class="flex items-center gap-1.5 text-sm text-gray-500">
                <IconifyIcon icon="mdi:cog" :size="16" />
                <span>触发器</span>
                <span class="font-semibold text-gray-700">{{ workflow.triggers?.length || 0 }}</span>
              </div>
              <div
                v-if="workflow.triggers && workflow.triggers.length > 0"
                class="flex items-center gap-1 text-xs"
                :class="workflow.hasActiveTrigger ? 'text-green-600' : 'text-gray-400'"
              >
                <IconifyIcon icon="mdi:flash" :size="14" />
                <span>{{ workflow.hasActiveTrigger ? '活跃' : '已禁用' }}</span>
              </div>
              <div v-else class="text-xs text-gray-400">无触发器</div>
            </div>

            <!-- 底部：操作按钮 -->
            <div class="flex items-center pt-0" style="min-height: 46px;">
              <span class="text-xs text-gray-400">更新于 {{ formatDate(workflow.updatedAt) }}</span>
              <div class="flex items-center gap-1 ml-auto">
                <!-- 启用/停用开关 -->
                <Tooltip :title="workflow.enabled === false ? '启用' : '停用'">
                  <button
                    type="button"
                    class="flex items-center cursor-pointer mr-2"
                    @click="handleToggleEnable(workflow)"
                  >
                    <div
                      class="w-8 h-4.5 rounded-full transition-all duration-200 relative"
                      :class="workflow.enabled === false ? 'bg-gray-300' : 'bg-green-500'"
                      style="height: 18px;"
                    >
                      <div
                        class="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all duration-200"
                        :class="workflow.enabled === false ? 'left-0.5' : 'left-[14px]'"
                        style="width: 14px; height: 14px;"
                      ></div>
                    </div>
                  </button>
                </Tooltip>
                <span class="w-px h-4 bg-gray-200"></span>
                <Tooltip title="编辑">
                  <Button
                    type="text"
                    size="small"
                    class="workflow-action-btn"
                    @click="handleEdit(workflow.id)"
                  >
                    <IconifyIcon icon="mdi:pencil" :size="16" />
                  </Button>
                </Tooltip>
                <Tooltip :title="workflow.enabled === false ? '流程已停用，无法运行' : '运行'">
                  <Button
                    type="text"
                    size="small"
                    class="workflow-action-btn"
                    :loading="runningWorkflowId === workflow.id"
                    :disabled="runningWorkflowId !== null || workflow.enabled === false"
                    @click="handleRun(workflow.id)"
                  >
                    <IconifyIcon icon="mdi:play-circle" :size="16" />
                  </Button>
                </Tooltip>
                <Popconfirm
                  title="确定删除这个流程吗？"
                  ok-text="确定"
                  cancel-text="取消"
                  @confirm="handleDelete(workflow.id)"
                >
                  <Tooltip title="删除">
                    <Button
                      type="text"
                      size="small"
                      danger
                    >
                      <IconifyIcon icon="mdi:trash-can" :size="16" />
                    </Button>
                  </Tooltip>
                </Popconfirm>
              </div>
            </div>
          </div>
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
        class="px-4 py-3 flex items-center justify-between border-t border-gray-100"
      >
        <div class="flex items-center gap-3 text-sm text-gray-500">
          <span>共 {{ store.totalWorkflows }} 条记录</span>
          <Select
            v-model:value="pageSize"
            style="width: 110px"
            size="small"
            @change="handlePageSizeChange"
          >
            <Select.Option :value="10">10条/页</Select.Option>
            <Select.Option :value="20">20条/页</Select.Option>
            <Select.Option :value="50">50条/页</Select.Option>
          </Select>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentPage === 1"
            @click="goToPage(1)"
          >
            <IconifyIcon icon="mdi:chevron-double-left" :size="18" />
          </button>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentPage === 1"
            @click="goToPage(currentPage - 1)"
          >
            <IconifyIcon icon="mdi:chevron-left" :size="18" />
          </button>
          <template v-for="p in pageList" :key="p">
            <button
              v-if="p === '...'"
              class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400"
            >
              ...
            </button>
            <button
              v-else
              class="w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-all"
              :class="p === currentPage
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'text-gray-600 hover:bg-gray-100'"
              @click="goToPage(p)"
            >
              {{ p }}
            </button>
          </template>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentPage === totalPages"
            @click="goToPage(currentPage + 1)"
          >
            <IconifyIcon icon="mdi:chevron-right" :size="18" />
          </button>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentPage === totalPages"
            @click="goToPage(totalPages)"
          >
            <IconifyIcon icon="mdi:chevron-double-right" :size="18" />
          </button>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.workflow-card {
  min-width: 280px;
  transition: all 0.2s ease;
}

.workflow-card:hover {
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.12);
  border-color: hsl(var(--primary)) !important;
  transform: translateY(-2px);
}

.workflow-card :deep(.ant-btn) {
  border-radius: 6px;
  color: hsl(var(--primary));
}

.workflow-card :deep(.ant-btn:hover) {
  background-color: hsl(var(--primary) / 0.08);
  color: hsl(var(--primary));
}

.workflow-card :deep(.ant-btn.ant-btn-dangerous) {
  color: #ef4444;
}

.workflow-card :deep(.ant-btn.ant-btn-dangerous:hover) {
  background-color: #fef2f2;
  color: #ef4444;
}

.workflow-card :deep(.workflow-action-btn) {
  color: #6b7280;
}

.workflow-card :deep(.workflow-action-btn:hover) {
  color: #1f2937 !important;
  background-color: #f3f4f6 !important;
}

.workflow-card :deep(.workflow-action-btn.ant-btn-disabled),
.workflow-card :deep(.workflow-action-btn.ant-btn-disabled:hover) {
  color: #d1d5db !important;
  background-color: transparent !important;
}
</style>
