<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { usePreferences } from '@vben/preferences';

import {
  Button,
  DatePicker,
  Dropdown,
  Modal,
  Radio,
  Select,
  Spin,
  Table,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { getFlowSelectList } from '#/api/core/workflow';
import { useExecutionStore } from '#/store/execution';
import { useWorkflowStore } from '#/store/workflow';

import LogModal from '../components/LogModal.vue';

const router = useRouter();
const executionStore = useExecutionStore();
const workflowStore = useWorkflowStore();
const { isDark } = usePreferences();

const currentPage = ref(1);
const pageSize = ref(10);
const selectedFlowId = ref('');
const selectedStates = ref<string[]>([]);
const dateRange = ref<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
const startDate = ref<dayjs.Dayjs | null>(null);
const endDate = ref<dayjs.Dayjs | null>(null);
const isLoading = ref(true);
const localProjectId = ref<null | number>(null);

// 流程名称远程搜索
const flowOptions = ref<{ description: string; flowId: string; }[]>([]);
const flowSearchLoading = ref(false);
let flowSearchTimer: null | ReturnType<typeof setTimeout> = null;

async function searchFlows(keyword: string) {
  const pid = localProjectId.value ?? workflowStore.projectId;
  if (!pid) {
    flowOptions.value = [];
    return;
  }
  flowSearchLoading.value = true;
  try {
    const list = await getFlowSelectList(pid, keyword || undefined);
    flowOptions.value = (list || []).map((item) => ({
      flowId: item.flowId,
      description: item.description || item.flowId,
    }));
  } catch {
    flowOptions.value = [];
  } finally {
    flowSearchLoading.value = false;
  }
}

function handleFlowSearch(value: string) {
  if (flowSearchTimer) clearTimeout(flowSearchTimer);
  flowSearchTimer = setTimeout(() => {
    searchFlows(value);
  }, 300);
}

// 列显示配置
const columnVisibility = ref<Record<string, boolean>>({
  id: true,
  flowName: true,
  trigger: true,
  state: true,
  startTime: true,
  endTime: true,
  duration: true,
  log: true,
  action: true,
});

const columnVisibilityMenuVisible = ref(false);

const columnVisibilityOptions = [
  { key: 'id', label: '执行ID' },
  { key: 'flowName', label: '流程名称' },
  { key: 'trigger', label: '触发方式' },
  { key: 'state', label: '状态' },
  { key: 'startTime', label: '开始时间' },
  { key: 'endTime', label: '结束时间' },
  { key: 'duration', label: '耗时' },
  { key: 'log', label: '日志' },
  { key: 'action', label: '操作' },
];

const visibleColumns = computed(() => {
  const cols = [...columns];
  if (!columnVisibility.value.id) {
    const idx = cols.findIndex((c) => c.dataIndex === 'id');
    if (idx !== -1) cols.splice(idx, 1);
  }
  if (!columnVisibility.value.flowName) {
    const idx = cols.findIndex((c) => c.dataIndex === 'flowName');
    if (idx !== -1) cols.splice(idx, 1);
  }
  if (!columnVisibility.value.trigger) {
    const idx = cols.findIndex((c) => c.dataIndex === 'trigger');
    if (idx !== -1) cols.splice(idx, 1);
  }
  if (!columnVisibility.value.state) {
    const idx = cols.findIndex((c) => c.dataIndex === 'state');
    if (idx !== -1) cols.splice(idx, 1);
  }
  // 注意：开始时间、结束时间、耗时使用相同的dataIndex 'state'，需要用title区分
  if (!columnVisibility.value.startTime) {
    const idx = cols.findIndex((c) => c.title === '开始时间');
    if (idx !== -1) cols.splice(idx, 1);
  }
  if (!columnVisibility.value.endTime) {
    const idx = cols.findIndex((c) => c.title === '结束时间');
    if (idx !== -1) cols.splice(idx, 1);
  }
  if (!columnVisibility.value.duration) {
    const idx = cols.findIndex((c) => c.title === '耗时');
    if (idx !== -1) cols.splice(idx, 1);
  }
  if (!columnVisibility.value.log) {
    const idx = cols.findIndex((c) => c.dataIndex === 'log');
    if (idx !== -1) cols.splice(idx, 1);
  }
  if (!columnVisibility.value.action) {
    const idx = cols.findIndex((c) => c.dataIndex === 'action');
    if (idx !== -1) cols.splice(idx, 1);
  }
  return cols;
});

function resetColumnVisibility() {
  columnVisibility.value = {
    id: true,
    flowName: true,
    trigger: true,
    state: true,
    startTime: true,
    endTime: true,
    duration: true,
    log: true,
    action: true,
  };
  columnVisibilityMenuVisible.value = false;
}

function toggleColumn(key: string) {
  columnVisibility.value[key] = !columnVisibility.value[key];
}

const showReplayModal = ref(false);
const replayExecutionId = ref('');
const replayLatestRevision = ref(false);

const showLogModal = ref(false);
const logExecutionId = ref('');
const logFlowId = ref('');
const logState = ref('');

let refreshTimer: null | ReturnType<typeof setInterval> = null;

const stateOptions = [
  { value: 'RUNNING', label: '运行中' },
  { value: 'SUCCESS', label: '成功' },
  { value: 'FAILED', label: '失败' },
  { value: 'WARNING', label: '警告' },
  { value: 'CREATED', label: '已创建' },
  { value: 'QUEUED', label: '排队中' },
  { value: 'RETRYING', label: '重试中' },
  { value: 'RETRIED', label: '已重试' },
  { value: 'PAUSED', label: '已暂停' },
  { value: 'KILLING', label: '终止中' },
  { value: 'KILLED', label: '已终止' },
  { value: 'CANCELLED', label: '已取消' },
  { value: 'RESTARTED', label: '已重启' },
  { value: 'SUBMITTED', label: '已提交' },
  { value: 'RESUBMITTED', label: '已重提' },
  { value: 'BREAKPOINT', label: '断点' },
  { value: 'SKIPPED', label: '已跳过' },
];

const columns = [
  {
    title: '执行ID',
    dataIndex: 'id',
    width: 160,
    ellipsis: true,
    align: 'center',
  },
  {
    title: '流程名称',
    dataIndex: 'flowName',
    width: 150,
    ellipsis: true,
    align: 'center',
  },
  {
    title: '触发方式',
    dataIndex: 'trigger',
    width: 100,
    align: 'center',
  },
  {
    title: '状态',
    dataIndex: 'state',
    width: 80,
    align: 'center',
  },
  {
    title: '开始时间',
    dataIndex: 'state',
    width: 150,
    align: 'center',
  },
  {
    title: '结束时间',
    dataIndex: 'state',
    width: 150,
    align: 'center',
  },
  {
    title: '耗时',
    dataIndex: 'state',
    width: 80,
    align: 'center',
  },
  {
    title: '日志',
    dataIndex: 'log',
    width: 60,
    align: 'center',
  },
  {
    title: '操作',
    dataIndex: 'action',
    width: 180,
    align: 'center',
    fixed: 'right',
  },
];

function formatDuration(duration: string | undefined): string {
  if (!duration) return '-';
  const match = duration.match(/PT((\d+)H)?((\d+)M)?((\d+\.\d+)?S)?/);
  if (!match) return duration;

  const hours = Number.parseInt(match[2] || '0');
  const minutes = Number.parseInt(match[4] || '0');
  const seconds = Number.parseFloat(match[6] || '0');

  if (hours > 0) {
    const totalSeconds = minutes * 60 + seconds;
    const displayMinutes = Math.floor(totalSeconds / 60);
    const displaySeconds = Math.round(totalSeconds % 60);
    if (displayMinutes > 0 && displaySeconds > 0) {
      return `${hours}h ${displayMinutes}m ${displaySeconds}s`;
    } else if (displayMinutes > 0) {
      return `${hours}h ${displayMinutes}m`;
    } else if (displaySeconds > 0) {
      return `${hours}h ${displaySeconds}s`;
    }
    return `${hours}h`;
  }

  if (minutes > 0) {
    const secs = Math.round(seconds);
    if (secs > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${minutes}m`;
  }

  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  }

  return `${Math.round(seconds)}s`;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  let normalizedDateStr = dateStr;
  const lastPart = new Set(dateStr.slice(-6));
  if (!dateStr.endsWith('Z') && !lastPart.has('+') && !lastPart.has('-')) {
    normalizedDateStr = `${dateStr}Z`;
  }
  const date = new Date(normalizedDateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Shanghai',
  });
}

function getStateColor(state: string): string {
  const colorMap: Record<string, string> = {
    RUNNING: '#3b82f6',
    SUCCESS: '#10b981',
    FAILED: '#ef4444',
    WARNING: '#f59e0b',
    CREATED: '#9ca3af',
    QUEUED: '#6366f1',
    RETRYING: '#f97316',
    RETRIED: '#f97316',
    PAUSED: '#8b5cf6',
    KILLING: '#dc2626',
    KILLED: '#dc2626',
    CANCELLED: '#6b7280',
    RESTARTED: '#14b8a6',
    SUBMITTED: '#64748b',
    RESUBMITTED: '#0ea5e9',
    BREAKPOINT: '#ec4899',
    SKIPPED: '#94a3b8',
  };
  return colorMap[state] || '#9ca3af';
}

function getStateLabel(state: string): string {
  const labelMap: Record<string, string> = {
    RUNNING: '运行中',
    SUCCESS: '成功',
    FAILED: '失败',
    WARNING: '警告',
    CREATED: '已创建',
    QUEUED: '排队中',
    RETRYING: '重试中',
    RETRIED: '已重试',
    PAUSED: '已暂停',
    KILLING: '终止中',
    KILLED: '已终止',
    CANCELLED: '已取消',
    RESTARTED: '已重启',
    SUBMITTED: '已提交',
    RESUBMITTED: '已重提',
    BREAKPOINT: '断点',
    SKIPPED: '已跳过',
  };
  return labelMap[state] || state;
}

function getActionButtonClass(
  enabled: boolean,
  color: string,
  _gray: string,
): string {
  if (!enabled) {
    return '!text-gray-300 !bg-transparent cursor-not-allowed rounded-full w-6 h-6 flex items-center justify-center';
  }
  const colorMap: Record<string, string> = {
    blue: '!text-blue-500 hover:!text-blue-700 hover:bg-blue-50',
    green: '!text-green-500 hover:!text-green-700 hover:bg-green-50',
    red: '!text-red-500 hover:!text-red-700 hover:bg-red-50',
    orange: '!text-orange-500 hover:!text-orange-700 hover:bg-orange-50',
    indigo: '!text-indigo-500 hover:!text-indigo-700 hover:bg-indigo-50',
  };
  return `${colorMap[color] || colorMap.blue} rounded-full w-6 h-6 flex items-center justify-center`;
}

function getTriggerType(record: any): string {
  if (record.trigger || record.scheduleDate) {
    return 'trigger';
  }
  return 'ui';
}

function getTriggerTooltip(trigger: any): string {
  let tooltip = `触发器详情\n\n`;
  tooltip += `Id:\t\t${trigger.id}\n`;
  tooltip += `Type:\t${trigger.type}\n`;
  if (trigger.variables) {
    tooltip += `\nVariables:\n${JSON.stringify(trigger.variables, null, 2)}`;
  }
  return tooltip;
}

function viewDetail(executionId: string, flowId: string) {
  router.push({
    path: `/shuzhiliu/execution/detail/${executionId}`,
    query: { flowId },
  });
}

async function loadData(isAutoRefresh = false) {
  const pid = localProjectId.value ?? workflowStore.projectId;
  const start = dateRange.value ? dateRange.value[0] : null;
  const end = dateRange.value ? dateRange.value[1] : null;
  await executionStore.loadExecutions(
    {
      page: currentPage.value,
      size: pageSize.value,
      projectId: pid,
      flowId: selectedFlowId.value || undefined,
      startDate: start
        ? dayjs(start).utc().format('YYYY-MM-DDTHH:mm:ss[Z]')
        : undefined,
      endDate: end
        ? dayjs(end).utc().format('YYYY-MM-DDTHH:mm:ss[Z]')
        : undefined,
      state: selectedStates.value.length > 0 ? selectedStates.value : undefined,
    },
    isAutoRefresh,
  );

  if (executionStore.executions && executionStore.executions.length > 0) {
    const hasRunning = executionStore.executions.some(
      (e) => e && e.state && e.state.current === 'RUNNING',
    );
    toggleAutoRefresh(hasRunning);
  } else {
    toggleAutoRefresh(false);
  }
}

function handlePageChange(page: number, size: number) {
  currentPage.value = page;
  pageSize.value = size;
  loadData();
}

function handlePageSizeChange(value: number) {
  pageSize.value = value;
  currentPage.value = 1;
  loadData();
}

const totalPages = computed(() => {
  if (!executionStore.totalExecutions) return 1;
  return Math.ceil(executionStore.totalExecutions / pageSize.value);
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
  loadData();
}

function resetSearch() {
  selectedFlowId.value = '';
  selectedStates.value = [];
  dateRange.value = null;
  currentPage.value = 1;
  searchFlows('');
  loadData();
}

async function handleKill(executionId: string) {
  const pid = localProjectId.value ?? workflowStore.projectId;
  await executionStore.batchKill({
    projectId: pid,
    executionIdList: [executionId],
  });
  await loadData();
}

async function handleRestart(executionId: string) {
  const pid = localProjectId.value ?? workflowStore.projectId;
  await executionStore.batchRestart({
    projectId: pid,
    executionIdList: [executionId],
  });
  await loadData();
}

function handleReplay(executionId: string) {
  replayExecutionId.value = executionId;
  replayLatestRevision.value = false;
  showReplayModal.value = true;
}

async function confirmReplay() {
  const pid = localProjectId.value ?? workflowStore.projectId;
  await executionStore.batchReplay({
    projectId: pid,
    executionIdList: [replayExecutionId.value],
    latestRevision: replayLatestRevision.value,
  });
  showReplayModal.value = false;
  await loadData();
}

function cancelReplay() {
  showReplayModal.value = false;
}

function handleViewLog(executionId: string, flowId: string, state: string) {
  logExecutionId.value = executionId;
  logFlowId.value = flowId;
  logState.value = state;
  showLogModal.value = true;
}

async function handlePause(executionId: string) {
  const pid = localProjectId.value ?? workflowStore.projectId;
  await executionStore.batchPause({
    projectId: pid,
    executionIdList: [executionId],
  });
  await loadData();
}

async function handleResume(executionId: string) {
  const pid = localProjectId.value ?? workflowStore.projectId;
  await executionStore.batchResume({
    projectId: pid,
    executionIdList: [executionId],
  });
  await loadData();
}

function handleDateChange(date: any, type: 'end' | 'start') {
  if (date) {
    if (type === 'start') {
      startDate.value = dayjs(date);
    } else {
      endDate.value = dayjs(date);
    }
  } else {
    if (type === 'start') {
      startDate.value = null;
    } else {
      endDate.value = null;
    }
  }
}

async function handleProjectFocus() {
  if (!workflowStore.projects || workflowStore.projects.length === 0) {
    await workflowStore.loadProjects();
  }
}

function handleProjectChange(value: number) {
  localProjectId.value = value;
  workflowStore.setProjectId(value);
  currentPage.value = 1;
  selectedFlowId.value = '';
  flowOptions.value = [];
  searchFlows('');
  loadData();
}

onMounted(async () => {
  try {
    if (!workflowStore.projects || workflowStore.projects.length === 0) {
      await workflowStore.loadProjects();
    }
    localProjectId.value = workflowStore.projectId;
    await Promise.all([searchFlows(''), loadData()]);
  } finally {
    isLoading.value = false;
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

watch(
  () => workflowStore.projectId,
  (newVal) => {
    if (localProjectId.value !== newVal) {
      localProjectId.value = newVal;
      currentPage.value = 1;
      selectedFlowId.value = '';
      flowOptions.value = [];
      searchFlows('');
      loadData();
    }
  },
);

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

function toggleAutoRefresh(hasRunning: boolean) {
  if (hasRunning && !refreshTimer && !document.hidden) {
    refreshTimer = setInterval(async () => {
      await loadData(true);
    }, 5000);
  } else if (!hasRunning && refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  } else {
    const hasRunning = executionStore.executions.some(
      (e) => e && e.state && e.state.current === 'RUNNING',
    );
    if (hasRunning) {
      toggleAutoRefresh(true);
    }
  }
}
</script>

<template>
  <Page header-class="py-2">
    <Spin :spinning="executionStore.isOperationLoading">
      <!-- 搜索区域 -->
      <div class="mb-4 bg-card rounded-lg shadow-sm">
        <div class="px-6 py-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div class="flex items-center gap-2">
              <label
                class="text-sm whitespace-nowrap w-16 text-right" :class="[
                  isDark ? 'text-white/80' : 'text-gray-600',
                ]"
                >项目</label>
              <Select
                v-model:value="localProjectId"
                class="flex-1"
                placeholder="选择项目"
                :loading="isLoading || executionStore.isOperationLoading"
                :disabled="executionStore.isOperationLoading"
                @change="handleProjectChange"
                @focus="handleProjectFocus"
              >
                <Select.Option
                  v-for="project in workflowStore.projects"
                  :key="project.id"
                  :value="project.id"
                >
                  {{ project.projectName }}
                </Select.Option>
              </Select>
            </div>

            <div class="flex items-center gap-2">
              <label
                class="text-sm whitespace-nowrap w-16 text-right" :class="[
                  isDark ? 'text-white/80' : 'text-gray-600',
                ]"
                >流程名称</label>
              <Select
                v-model:value="selectedFlowId"
                show-search
                placeholder="请输入流程名称搜索"
                class="flex-1"
                allow-clear
                :filter-option="false"
                :loading="flowSearchLoading"
                :disabled="executionStore.isOperationLoading"
                @search="handleFlowSearch"
              >
                <Select.Option
                  v-for="item in flowOptions"
                  :key="item.flowId"
                  :value="item.flowId"
                >
                  {{ item.description }}
                </Select.Option>
              </Select>
            </div>

            <div class="flex items-center gap-2">
              <label
                class="text-sm whitespace-nowrap w-16 text-right" :class="[
                  isDark ? 'text-white/80' : 'text-gray-600',
                ]"
                >状态</label>
              <Select
                v-model:value="selectedStates"
                placeholder="请选择"
                class="flex-1"
                mode="multiple"
                allow-clear
                :disabled="executionStore.isOperationLoading"
              >
                <Select.Option
                  v-for="option in stateOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </Select.Option>
              </Select>
            </div>

            <div class="flex items-center gap-2 lg:col-span-2">
              <label
                class="text-sm whitespace-nowrap w-16 text-right" :class="[
                  isDark ? 'text-white/80' : 'text-gray-600',
                ]"
                >启动时间</label>
              <DatePicker.RangePicker
                v-model:value="dateRange"
                class="flex-1"
                :show-time="{ format: 'HH:mm:ss' }"
                format="YYYY-MM-DD HH:mm:ss"
                :placeholder="['开始时间', '结束时间']"
                :disabled="executionStore.isOperationLoading"
              />
              <Button
                type="primary"
                @click="loadData"
                :disabled="executionStore.isOperationLoading"
              >
                搜索
              </Button>
              <Button
                @click="resetSearch"
                :disabled="executionStore.isOperationLoading"
              >
                重置
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- 表格区域 -->
      <div class="bg-card rounded-lg shadow-sm">
        <div
          class="px-6 py-4 flex items-center justify-between border-b border-gray-100"
        >
          <div
            class="text-base font-semibold"
            :class="isDark ? 'text-white' : 'text-gray-800'"
          >
            执行记录
          </div>
          <div class="flex items-center gap-2">
            <!-- 列筛选按钮 -->
            <Dropdown
              v-model:open="columnVisibilityMenuVisible"
              :trigger="['click']"
              :overlay-style="{ minWidth: '160px' }"
            >
              <button
                type="button"
                class="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="列设置"
              >
                <IconifyIcon icon="mdi:table-column" :size="18" />
              </button>
              <template #overlay>
                <div class="column-filter-menu py-2">
                  <div
                    v-for="option in columnVisibilityOptions"
                    :key="option.key"
                    class="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 transition-colors"
                    @click="toggleColumn(option.key)"
                  >
                    <span
                      class="w-4 h-4 border rounded flex items-center justify-center"
                      :class="
                        columnVisibility[option.key]
                          ? 'bg-primary border-primary'
                          : 'border-gray-300'
                      "
                    >
                      <IconifyIcon
                        v-if="columnVisibility[option.key]"
                        icon="mdi:check"
                        :size="12"
                        class="text-white"
                      />
                    </span>
                    <span
                      class="text-sm"
                      :class="isDark ? 'text-gray-300' : 'text-gray-700'"
                      >{{ option.label }}</span>
                  </div>
                  <div class="border-t border-gray-100 my-1"></div>
                  <div
                    class="px-3 py-2 text-sm text-center text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors"
                    @click="resetColumnVisibility"
                  >
                    恢复默认
                  </div>
                </div>
              </template>
            </Dropdown>
          </div>
        </div>
        <div class="px-2 py-2">
          <Spin :spinning="executionStore.isExecutionsLoading">
            <Table
              :columns="visibleColumns"
              :data-source="executionStore.executions"
              :pagination="false"
              :scroll="{ x: 1110 }"
              row-key="id"
              size="middle"
              class="execution-table"
              :row-class-name="() => ''"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'id'">
                  <a
                    class="text-primary hover:text-primary/80 font-medium"
                    @click="viewDetail(record.id, record.flowId)"
                  >
                    {{ record.id }}
                  </a>
                </template>

                <template v-else-if="column.dataIndex === 'trigger'">
                  <div v-if="record.trigger">
                    <Tooltip
                      placement="top"
                      :overlay-style="{ maxWidth: 'none' }"
                      :overlay-inner-style="{
                        backgroundColor: isDark ? '#1f2937' : '#fff',
                        color: isDark ? '#e5e7eb' : '#333',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        padding: '0',
                        maxWidth: 'none',
                        width: 'auto',
                      }"
                    >
                      <template #title>
                        <div style="width: 420px">
                          <div
                            :style="{
                              padding: '12px 16px',
                              fontWeight: 600,
                              fontSize: '14px',
                              borderBottom: `1px solid ${isDark ? '#374151' : '#f0f0f0'}`,
                              color: isDark ? '#e5e7eb' : '#333',
                              backgroundColor: isDark ? '#1f2937' : '#fff',
                            }"
                          >
                            触发器详情: {{ record.trigger.id }}
                          </div>
                          <div style=" width: 100%;border-collapse: collapse">
                            <div
                              style="display: table-row; borderBottom: `1px solid ${isDark ? '#374151' : '#f0f0f0'}`;"
                            >
                              <div
                                :style="{
                                  display: 'table-cell',
                                  padding: '8px 16px',
                                  fontSize: '12px',
                                  color: isDark ? '#9ca3af' : '#666',
                                  backgroundColor: isDark
                                    ? '#374151'
                                    : '#fafafa',
                                  width: '80px',
                                  fontWeight: 500,
                                }"
                              >
                                Id
                              </div>
                              <div
                                :style="{
                                  display: 'table-cell',
                                  padding: '8px 16px',
                                  fontSize: '12px',
                                  color: isDark ? '#e5e7eb' : '#333',
                                }"
                              >
                                {{ record.trigger.id }}
                              </div>
                            </div>
                            <div
                              style="display: table-row; borderBottom: `1px solid ${isDark ? '#374151' : '#f0f0f0'}`;"
                            >
                              <div
                                :style="{
                                  display: 'table-cell',
                                  padding: '8px 16px',
                                  fontSize: '12px',
                                  color: isDark ? '#9ca3af' : '#666',
                                  backgroundColor: isDark
                                    ? '#374151'
                                    : '#fafafa',
                                  width: '80px',
                                  fontWeight: 500,
                                }"
                              >
                                Type
                              </div>
                              <div
                                :style="{
                                  display: 'table-cell',
                                  padding: '8px 16px',
                                  fontSize: '12px',
                                  color: isDark ? '#e5e7eb' : '#333',
                                  wordBreak: 'break-all',
                                }"
                              >
                                {{ record.trigger.type }}
                              </div>
                            </div>
                            <div
                              v-if="record.trigger.variables"
                              style="display: table-row"
                            >
                              <div
                                :style="{
                                  display: 'table-cell',
                                  padding: '8px 16px',
                                  fontSize: '12px',
                                  color: isDark ? '#9ca3af' : '#666',
                                  backgroundColor: isDark
                                    ? '#374151'
                                    : '#fafafa',
                                  width: '80px',
                                  fontWeight: 500,
                                  verticalAlign: 'top',
                                }"
                              >
                                Variables
                              </div>
                              <div
                                :style="{
                                  display: 'table-cell',
                                  padding: '8px 16px',
                                  fontSize: '12px',
                                  color: isDark ? '#e5e7eb' : '#333',
                                }"
                              >
                                <pre
                                  :style="{
                                    whiteSpace: 'pre-wrap',
                                    margin: 0,
                                    fontSize: '11px',
                                    backgroundColor: isDark
                                      ? '#374151'
                                      : '#f5f5f5',
                                    padding: '6px',
                                    borderRadius: '4px',
                                    maxWidth: '280px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                  }"
                                  >{{
                                    JSON.stringify(
                                      record.trigger.variables,
                                      null,
                                      2,
                                    )
                                  }}</pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      </template>
                      <span
                        v-if="record.trigger.type === 'idp_core_flow_Subflow'"
                        class="flex items-center justify-center gap-1 cursor-help" :class="[
                          isDark ? 'text-white/80' : 'text-gray-800',
                        ]"
                      >
                        <IconifyIcon
                          icon="mdi:workflow"
                          :size="14"
                          class="text-purple-500"
                        />
                        <span>子流程触发</span>
                      </span>
                      <span
                        v-else
                        class="flex items-center justify-center gap-1 cursor-help" :class="[
                          isDark ? 'text-white/80' : 'text-gray-800',
                        ]"
                      >
                        <IconifyIcon
                          icon="mdi:flash"
                          :size="14"
                          class="text-orange-500"
                        />
                        <span>触发器触发</span>
                      </span>
                    </Tooltip>
                  </div>
                  <span
                    v-else
                    class="flex items-center justify-center w-full" :class="[
                      isDark ? 'text-white/80' : 'text-gray-800',
                    ]"
                    >调用触发</span>
                </template>

                <template v-else-if="column.dataIndex === 'state'">
                  <template v-if="column.title === '状态'">
                    <span
                      :style="{
                        color: getStateColor(record.state.current),
                        fontWeight: 500,
                      }"
                    >
                      {{ getStateLabel(record.state.current) }}
                    </span>
                  </template>
                  <template v-else-if="column.title === '开始时间'">
                    {{ formatDate(record.state.startDate) }}
                  </template>
                  <template v-else-if="column.title === '结束时间'">
                    {{ formatDate(record.state.endDate) }}
                  </template>
                  <template v-else-if="column.title === '耗时'">
                    {{ formatDuration(record.state.duration) }}
                  </template>
                </template>

                <template v-else-if="column.dataIndex === 'log'">
                  <Button
                    type="text"
                    size="small"
                    @click="
                      handleViewLog(
                        record.id,
                        record.flowId,
                        record.state.current,
                      )
                    "
                    class="!text-blue-500 hover:!text-blue-700 hover:bg-blue-50 rounded-full w-6 h-6 flex items-center justify-center"
                  >
                    <IconifyIcon icon="mdi:file-document" :size="16" />
                  </Button>
                </template>

                <template v-else-if="column.dataIndex === 'action'">
                  <div class="flex items-center justify-center gap-1">
                    <Tooltip placement="top" title="暂停">
                      <Button
                        type="text"
                        size="small"
                        @click="handlePause(record.id)"
                        :loading="executionStore.isOperationLoading"
                        :disabled="
                          executionStore.isOperationLoading ||
                          record.state.current !== 'RUNNING'
                        "
                        :class="
                          getActionButtonClass(
                            record.state.current === 'RUNNING',
                            'blue',
                            'gray',
                          )
                        "
                      >
                        <IconifyIcon icon="mdi:pause-circle" :size="16" />
                      </Button>
                    </Tooltip>
                    <Tooltip placement="top" title="恢复">
                      <Button
                        type="text"
                        size="small"
                        @click="handleResume(record.id)"
                        :loading="executionStore.isOperationLoading"
                        :disabled="
                          executionStore.isOperationLoading ||
                          record.state.current !== 'PAUSED'
                        "
                        :class="
                          getActionButtonClass(
                            record.state.current === 'PAUSED',
                            'green',
                            'gray',
                          )
                        "
                      >
                        <IconifyIcon icon="mdi:play-circle" :size="16" />
                      </Button>
                    </Tooltip>
                    <Tooltip placement="top" title="终止">
                      <Button
                        type="text"
                        size="small"
                        @click="handleKill(record.id)"
                        :loading="executionStore.isOperationLoading"
                        :disabled="
                          executionStore.isOperationLoading ||
                          (record.state.current !== 'RUNNING' &&
                            record.state.current !== 'PAUSED')
                        "
                        :class="
                          getActionButtonClass(
                            record.state.current === 'RUNNING' ||
                              record.state.current === 'PAUSED',
                            'red',
                            'gray',
                          )
                        "
                      >
                        <IconifyIcon icon="mdi:stop-circle" :size="16" />
                      </Button>
                    </Tooltip>
                    <Tooltip placement="top" title="重启">
                      <Button
                        type="text"
                        size="small"
                        @click="handleRestart(record.id)"
                        :loading="executionStore.isOperationLoading"
                        :disabled="
                          executionStore.isOperationLoading ||
                          (record.state.current !== 'FAILED' &&
                            record.state.current !== 'WARNING')
                        "
                        :class="
                          getActionButtonClass(
                            record.state.current === 'FAILED' ||
                              record.state.current === 'WARNING',
                            'orange',
                            'gray',
                          )
                        "
                      >
                        <IconifyIcon icon="mdi:refresh-circle" :size="16" />
                      </Button>
                    </Tooltip>
                    <Tooltip placement="top" title="重跑">
                      <Button
                        type="text"
                        size="small"
                        @click="handleReplay(record.id)"
                        :loading="executionStore.isOperationLoading"
                        :disabled="
                          executionStore.isOperationLoading ||
                          ![
                            'SUCCESS',
                            'FAILED',
                            'WARNING',
                            'KILLED',
                            'CANCELLED',
                          ].includes(record.state.current)
                        "
                        :class="
                          getActionButtonClass(
                            [
                              'SUCCESS',
                              'FAILED',
                              'WARNING',
                              'KILLED',
                              'CANCELLED',
                            ].includes(record.state.current),
                            'indigo',
                            'gray',
                          )
                        "
                      >
                        <IconifyIcon icon="mdi:rotate-3d-variant" :size="16" />
                      </Button>
                    </Tooltip>
                  </div>
                </template>
              </template>
            </Table>
          </Spin>
        </div>
        <!-- 分页区域 -->
        <div
          class="px-4 py-3 flex items-center justify-between border-t border-gray-100"
        >
          <div
            class="flex items-center gap-3 text-sm"
            :class="isDark ? 'text-gray-400' : 'text-gray-500'"
          >
            <span>共 {{ executionStore.totalExecutions }} 条记录</span>
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
                :class="
                  p === currentPage
                    ? 'bg-primary text-white hover:bg-primary/90'
                    : 'text-gray-600 hover:bg-gray-100'
                "
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
      </div>
    </Spin>

    <Modal
      v-model:open="showReplayModal"
      title="重跑执行"
      :footer="null"
      width="400px"
    >
      <div class="p-4">
        <p class="text-sm text-gray-600 mb-4">请选择重跑使用的流程版本：</p>
        <Radio.Group v-model:value="replayLatestRevision" class="space-y-2">
          <Radio :value="false">
            使用历史版本
            <span class="text-xs text-gray-400 ml-2">（沿用原执行对应的流程版本）</span>
          </Radio>
          <Radio :value="true">
            使用最新版本
            <span class="text-xs text-gray-400 ml-2">（使用当前最新流程版本）</span>
          </Radio>
        </Radio.Group>
      </div>
      <div class="flex justify-end gap-2 mt-6">
        <Button @click="cancelReplay">取消</Button>
        <Button type="primary" @click="confirmReplay">确定重跑</Button>
      </div>
    </Modal>

    <LogModal
      v-model:visible="showLogModal"
      :execution-id="logExecutionId"
      :flow-id="logFlowId"
      :project-id="localProjectId ?? workflowStore.projectId"
      :state="logState"
    />
  </Page>
</template>

<style scoped>
.execution-table :deep(.ant-table) {
  border: none;
  border-radius: 0;
}

.execution-table :deep(.ant-table-container) {
  border-right: none;
  border-left: none;
  border-radius: 0;
}

.execution-table :deep(.ant-table-thead > tr > th) {
  font-size: 12px;
  font-weight: 600;
  color: #323639 !important;
  text-align: center;
  background-color: #f5f7fa !important;
  border-top: none !important;
  border-right: none !important;
  border-bottom: 1px solid #e5e7eb;
  border-left: none !important;
}

.execution-table :deep(.ant-table-thead > tr > th:first-child) {
  border-left: none;
}

.execution-table :deep(.ant-table-thead > tr > th:last-child) {
  border-right: none;
}

.execution-table :deep(.ant-table-tbody > tr > td) {
  font-size: 12px;
  color: #323639;
  text-align: center;
  border-right: none !important;
  border-bottom: 1px solid #f0f0f0;
  border-left: none !important;
}

.execution-table :deep(.ant-table-tbody > tr:last-child > td) {
  border-bottom: none;
}

.execution-table :deep(.ant-table-tbody > tr:hover > td) {
  background-color: #f8fafc;
}
</style>
