<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Input,
  message,
  Modal,
  Select,
  Tooltip,
} from 'ant-design-vue';

import { exportFlows } from '#/api/core/workflow';
import { useWorkflowStore } from '#/store/workflow';

import {
  downloadBlob,
  generateExportFilename,
} from '../utils/flowTransfer';
import ImportFlowDialog from './ImportFlowDialog.vue';
import RunInputDialog from './RunInputDialog.vue';

const router = useRouter();
const store = useWorkflowStore();
const searchInput = ref('');
const startTime = ref<string | undefined>();
const endTime = ref<string | undefined>();
const currentPage = ref(1);
const pageSize = ref(10);
const runningWorkflowId = ref<string | null>(null);

// 输入对话框状态
const showInputDialog = ref(false);
const inputDialogLoading = ref(false);
const currentRunWorkflow = ref<any>(null);
let searchTimer: null | ReturnType<typeof setTimeout> = null;

// 批量模式状态
const isBatchMode = ref(false);
const selectedIds = ref<string[]>([]);
const showImportDialog = ref(false);
const exportLoading = ref(false);

const workflows = computed(() => store.workflows);

const allSelected = computed(() => {
  if (workflows.value.length === 0) return false;
  return selectedIds.value.length === workflows.value.length;
});

const isIndeterminate = computed(() => {
  return selectedIds.value.length > 0 && selectedIds.value.length < workflows.value.length;
});

function toggleBatchMode() {
  isBatchMode.value = !isBatchMode.value;
  if (!isBatchMode.value) {
    selectedIds.value = [];
  }
}

function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id);
  if (idx === -1) {
    selectedIds.value.push(id);
  } else {
    selectedIds.value.splice(idx, 1);
  }
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = workflows.value.map((w) => w.id);
  }
}

function handleCardClick(workflow: any, event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest('button') || target.closest('.workflow-action-btn')) {
    return;
  }
  if (isBatchMode.value) {
    toggleSelect(workflow.id);
  }
}

async function handleExport(workflow: any) {
  if (!workflow.backendId) {
    message.warning('流程尚未保存，无法导出');
    return;
  }
  try {
    exportLoading.value = true;
    const blob = await exportFlows({
      projectId: store.projectId,
      idList: [workflow.backendId],
    });
    downloadBlob(blob, generateExportFilename());
    message.success('导出成功');
  } catch (error: any) {
    message.error(`导出失败: ${error?.message || '未知错误'}`);
  } finally {
    exportLoading.value = false;
  }
}

async function handleBatchExport() {
  const backendIds = selectedIds.value
    .map((id) => workflows.value.find((w) => w.id === id)?.backendId)
    .filter((id): id is number => id !== undefined);

  if (backendIds.length === 0) {
    message.warning('请先选择要导出的流程');
    return;
  }
  try {
    exportLoading.value = true;
    const blob = await exportFlows({
      projectId: store.projectId,
      idList: backendIds,
    });
    downloadBlob(blob, generateExportFilename());
    message.success(`已导出 ${backendIds.length} 个流程`);
  } catch (error: any) {
    message.error(`导出失败: ${error?.message || '未知错误'}`);
  } finally {
    exportLoading.value = false;
  }
}

function handleImportSuccess() {
  showImportDialog.value = false;
  store.loadWorkflows(store.selectedFolderId || undefined);
}

function handleImportClick() {
  if (store.selectedFolderId === null) {
    message.warning('请先选择左侧文件夹');
    return;
  }
  showImportDialog.value = true;
}

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
  const query: Record<string, string> = {};
  if (store.projectId != null) {
    query.projectId = String(store.projectId);
  }
  router.push({
    path: '/shuzhiliu/workflow/editor',
    query,
  });
}
function handleEdit(workflowId: string) {
  const query: Record<string, string> = {};
  if (store.projectId != null) {
    query.projectId = String(store.projectId);
  }
  router.push({
    path: `/shuzhiliu/workflow/editor/${workflowId}`,
    query,
  });
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

  const inputs = workflow.inputs || [];
  const hasWebhook = !!(workflow.flowId && store.projectId);
  
  // 有 inputs 或有 flowId（可配置 webhook），弹框显示
  if (inputs.length > 0 || hasWebhook) {
    currentRunWorkflow.value = workflow;
    showInputDialog.value = true;
    return;
  }

  // 无 inputs 且无 flowId，弹框二次确认
  Modal.confirm({
    title: '确认运行',
    content: `确定要运行流程「${workflow.name}」吗？`,
    okText: '运行',
    cancelText: '取消',
    onOk: async () => {
      await doRunWorkflow(workflow);
    },
  });
}

async function doRunWorkflow(workflow: any, inputs?: Record<string, any>) {
  if (runningWorkflowId.value) return;
  runningWorkflowId.value = workflow.id;
  try {
    const success = await store.runWorkflow(workflow.id, inputs);
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

function handleRunWithInputs(values: Record<string, any>) {
  showInputDialog.value = false;
  inputDialogLoading.value = true;
  const workflow = currentRunWorkflow.value;
  if (workflow) {
    doRunWorkflow(workflow, values).finally(() => {
      inputDialogLoading.value = false;
    });
  } else {
    inputDialogLoading.value = false;
  }
}
function handleDelete(workflow: any) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除流程「${workflow.name}」吗？此操作不可恢复。`,
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: async () => {
      const success = await store.deleteWorkflowById(workflow.id);
      if (success) {
        message.success('删除成功');
      } else {
        message.error('删除失败');
      }
    },
  });
}

function handleToggleEnable(workflow: any) {
  if (!workflow.flowId) {
    message.warning('流程ID不存在，请先保存流程');
    return;
  }
  const isDisabling = workflow.enabled !== false;
  Modal.confirm({
    title: isDisabling ? '确认停用' : '确认启用',
    content: isDisabling
      ? `确定要停用流程「${workflow.name}」吗？停用后流程将无法触发。`
      : `确定要启用流程「${workflow.name}」吗？启用后流程可以正常触发。`,
    okText: isDisabling ? '停用' : '启用',
    okButtonProps: isDisabling ? { danger: true } : { type: 'primary' },
    cancelText: '取消',
    onOk: async () => {
      if (isDisabling) {
        const success = await store.disableWorkflow(workflow.flowId);
        if (success) {
          message.success('流程已停用');
        } else {
          message.error('停用失败');
        }
      } else {
        const success = await store.enableWorkflow(workflow.flowId);
        if (success) {
          message.success('流程已启用');
        } else {
          message.error('启用失败');
        }
      }
    },
  });
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
  <div class="workflow-list-container flex flex-col h-full gap-4">
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

        <!-- 正常模式工具栏 -->
        <div v-if="!isBatchMode" class="flex items-center gap-2 toolbar-buttons">
          <Button @click="handleImportClick">
            导入
          </Button>
          <Tooltip title="批量导出">
            <Button @click="toggleBatchMode">
              导出
            </Button>
          </Tooltip>
          <Button type="primary" @click="handleCreate">
            创建流程
          </Button>
        </div>

        <!-- 批量模式工具栏 -->
        <div v-else class="flex items-center gap-2 toolbar-buttons">
          <Checkbox
            :checked="allSelected"
            :indeterminate="isIndeterminate"
            @change="toggleSelectAll"
          >
            全选
          </Checkbox>
          <span class="text-sm text-gray-500 mr-2">
            已选 <span class="font-medium text-primary">{{ selectedIds.length }}</span> 个
          </span>
          <Button
            type="primary"
            :loading="exportLoading"
            :disabled="selectedIds.length === 0"
            @click="handleBatchExport"
          >
            批量导出
          </Button>
          <Button @click="toggleBatchMode">
            退出
          </Button>
        </div>
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
            :class="{
              'cursor-pointer': isBatchMode,
              'border-primary ring-2 ring-primary/20': isBatchMode && selectedIds.includes(workflow.id),
            }"
            @click="(e) => handleCardClick(workflow, e)"
          >
            <!-- 批量模式 checkbox -->
            <div
              v-if="isBatchMode"
              class="absolute top-3 left-3 z-10"
              @click.stop
            >
              <Checkbox
                :checked="selectedIds.includes(workflow.id)"
                @click.stop="toggleSelect(workflow.id)"
              />
            </div>

            <!-- 头部：图标、名称、状态、ID -->
            <div class="mb-0" :class="{ 'pl-7': isBatchMode }">
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
                <Tooltip title="导出">
                  <Button
                    type="text"
                    size="small"
                    class="workflow-action-btn"
                    :loading="exportLoading"
                    @click="handleExport(workflow)"
                  >
                    <IconifyIcon icon="mdi:download" :size="16" />
                  </Button>
                </Tooltip>
                <Tooltip title="删除">
                  <Button
                    type="text"
                    size="small"
                    danger
                    @click="handleDelete(workflow)"
                  >
                    <IconifyIcon icon="mdi:trash-can" :size="16" />
                  </Button>
                </Tooltip>
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

    <!-- 运行参数输入对话框 -->
    <RunInputDialog
      :visible="showInputDialog"
      :inputs="currentRunWorkflow?.inputs || []"
      :loading="inputDialogLoading"
      :project-id="store.projectId"
      :flow-id="currentRunWorkflow?.flowId"
      @update:visible="showInputDialog = $event"
      @confirm="handleRunWithInputs"
    />

    <!-- 导入流程对话框 -->
    <ImportFlowDialog
      :visible="showImportDialog"
      @update:visible="showImportDialog = $event"
      @success="handleImportSuccess"
    />
  </div>
</template>

<style>
.toolbar-buttons .ant-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}
</style>

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
