<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import dayjs from 'dayjs';

import { Page } from '@vben/common-ui';
import { Table, Select, DatePicker, Button, Tag, Spin, Tooltip, Modal, Radio } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import { useRouter } from 'vue-router';
import { usePreferences } from '@vben/preferences';

import { useExecutionStore } from '#/store/execution';
import { useWorkflowStore } from '#/store/workflow';

const router = useRouter();
const executionStore = useExecutionStore();
const workflowStore = useWorkflowStore();
const { isDark } = usePreferences();

const currentPage = ref(1);
const pageSize = ref(10);
const selectedFlowId = ref('');
const selectedStates = ref<string[]>([]);
const startDate = ref<dayjs.Dayjs | null>(null);
const endDate = ref<dayjs.Dayjs | null>(null);
const isLoading = ref(true);
const localProjectId = ref<number | null>(null);

const showReplayModal = ref(false);
const replayExecutionId = ref('');
const replayLatestRevision = ref(false);

let refreshTimer: ReturnType<typeof setInterval> | null = null;

const stateOptions = [
  { value: 'CREATED', label: '已创建' },
  { value: 'RUNNING', label: '运行中' },
  { value: 'SUCCESS', label: '成功' },
  { value: 'FAILED', label: '失败' },
];

const columns = [
  {
    title: '执行ID',
    dataIndex: 'id',
    width: 200,
    ellipsis: true,
  },
  {
    title: '流程名称',
    dataIndex: 'flowName',
    width: 200,
    ellipsis: true,
  },
  {
    title: '触发方式',
    dataIndex: 'trigger',
    width: 120,
    align: 'center',
  },
  {
    title: '状态',
    dataIndex: 'state',
    width: 100,
    align: 'center',
  },
  {
    title: '开始时间',
    dataIndex: 'state',
    width: 180,
  },
  {
    title: '结束时间',
    dataIndex: 'state',
    width: 180,
  },
  {
    title: '耗时',
    dataIndex: 'state',
    width: 100,
    align: 'center',
  },
  {
    title: '版本',
    dataIndex: 'flowRevision',
    width: 80,
    align: 'center',
  },
  {
    title: '操作',
    dataIndex: 'action',
    width: 120,
    align: 'center',
  },
];

function formatDuration(duration: string | undefined): string {
  if (!duration) return '-';
  const match = duration.match(/PT((\d+)H)?((\d+)M)?((\d+\.\d+)?S)?/);
  if (!match) return duration;
  
  const hours = parseInt(match[2] || '0');
  const minutes = parseInt(match[4] || '0');
  const seconds = parseFloat(match[6] || '0');
  
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
  const lastPart = dateStr.slice(-6);
  if (!dateStr.endsWith('Z') && !lastPart.includes('+') && !lastPart.includes('-')) {
    normalizedDateStr = dateStr + 'Z';
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
    CREATED: 'gray',
    RUNNING: 'blue',
    SUCCESS: 'green',
    FAILED: 'red',
  };
  return colorMap[state] || 'gray';
}

function getStateLabel(state: string): string {
  const labelMap: Record<string, string> = {
    CREATED: '已创建',
    RUNNING: '运行中',
    SUCCESS: '成功',
    FAILED: '失败',
  };
  return labelMap[state] || state;
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
  await executionStore.loadExecutions({
    page: currentPage.value,
    size: pageSize.value,
    projectId: pid,
    flowId: selectedFlowId.value || undefined,
    startDate: startDate.value ? dayjs(startDate.value).utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : undefined,
    endDate: endDate.value ? dayjs(endDate.value).utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : undefined,
    state: selectedStates.value.length > 0 ? selectedStates.value : undefined,
  }, isAutoRefresh);
  
  if (executionStore.executions && executionStore.executions.length > 0) {
    const hasRunning = executionStore.executions.some(e => e && e.state && e.state.current === 'RUNNING');
    toggleAutoRefresh(hasRunning);
  } else {
    toggleAutoRefresh(false);
  }
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

function handleDateChange(date: any, type: 'start' | 'end') {
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

function handleProjectChange(value: number) {
  localProjectId.value = value;
  workflowStore.setProjectId(value);
  currentPage.value = 1;
  loadData();
}

onMounted(async () => {
  try {
    await workflowStore.loadProjects();
    localProjectId.value = workflowStore.projectId;
    await loadData();
  } finally {
    isLoading.value = false;
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

watch(() => workflowStore.projectId, (newVal) => {
  if (localProjectId.value !== newVal) {
    localProjectId.value = newVal;
    currentPage.value = 1;
    loadData();
  }
});

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
    const hasRunning = executionStore.executions.some(e => e && e.state && e.state.current === 'RUNNING');
    if (hasRunning) {
      toggleAutoRefresh(true);
    }
  }
}
</script>

<template>
  <Page>
    <template #title>
      <div class="flex items-center gap-4">
        <span>项目</span>
        <Select
          v-model:value="localProjectId"
          class="w-48"
          size="small"
          placeholder="选择项目"
          :loading="isLoading || executionStore.isOperationLoading"
          :disabled="executionStore.isOperationLoading"
          @change="handleProjectChange"
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
    </template>

    <Spin :spinning="executionStore.isOperationLoading">
      <div class="mb-4 p-4 bg-card rounded-lg shadow-sm">
        <div class="flex flex-wrap gap-4 items-center">
          <div class="flex items-center gap-2">
            <label :class="['text-sm', isDark ? 'text-white/80' : 'text-gray-600']">流程：</label>
            <Select
              v-model:value="selectedFlowId"
              placeholder="请选择流程"
              style="width: 200px"
              allowClear
              :disabled="executionStore.isOperationLoading"
            >
              <Select.Option
                v-for="workflow in workflowStore.workflows"
                :key="workflow.flowId"
                :value="workflow.flowId"
              >
                {{ workflow.name }}
              </Select.Option>
            </Select>
          </div>

          <div class="flex items-center gap-2">
            <label :class="['text-sm', isDark ? 'text-white/80' : 'text-gray-600']">状态：</label>
            <Select
              v-model:value="selectedStates"
              placeholder="请选择状态"
              style="width: 200px"
              mode="multiple"
              allowClear
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

          <div class="flex items-center gap-2">
            <label :class="['text-sm', isDark ? 'text-white/80' : 'text-gray-600']">开始时间：</label>
            <DatePicker
              v-model:value="startDate"
              placeholder="开始时间"
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              @change="(date: any) => handleDateChange(date, 'start')"
              :disabled="executionStore.isOperationLoading"
            />
          </div>

          <div class="flex items-center gap-2">
            <label :class="['text-sm', isDark ? 'text-white/80' : 'text-gray-600']">结束时间：</label>
            <DatePicker
              v-model:value="endDate"
              placeholder="结束时间"
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              @change="(date: any) => handleDateChange(date, 'end')"
              :disabled="executionStore.isOperationLoading"
            />
          </div>

          <Button type="primary" @click="loadData" :disabled="executionStore.isOperationLoading">
            查询
          </Button>
        </div>
      </div>

      <Spin :spinning="executionStore.isExecutionsLoading">
      <Table
        :columns="columns"
        :data-source="executionStore.executions"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: executionStore.totalExecutions,
          showSizeChanger: true,
          showTotal: (total: number) => `共 ${total} 条`,
          onChange: (page: number, size: number) => {
            currentPage.value = page;
            pageSize.value = size;
            loadData();
          },
        }"
        row-key="id"
        bordered
        class="mt-4"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'id'">
            <a class="text-blue-600 hover:text-blue-800" @click="viewDetail(record.id, record.flowId)">
              {{ record.id }}
            </a>
          </template>

          <template v-else-if="column.dataIndex === 'trigger'">
            <div v-if="record.trigger">
              <Tooltip placement="top" :overlay-style="{ maxWidth: 'none' }" :overlay-inner-style="{ backgroundColor: isDark ? '#1f2937' : '#fff', color: isDark ? '#e5e7eb' : '#333', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '0', maxWidth: 'none', width: 'auto' }">
                <template #title>
                  <div style="width: 420px;">
                    <div :style="{ padding: '12px 16px', fontWeight: 600, fontSize: '14px', borderBottom: `1px solid ${isDark ? '#374151' : '#f0f0f0'}`, color: isDark ? '#e5e7eb' : '#333', backgroundColor: isDark ? '#1f2937' : '#fff' }">触发器详情: {{ record.trigger.id }}</div>
                    <div style="border-collapse: collapse; width: 100%;">
                      <div style="display: table-row; borderBottom: `1px solid ${isDark ? '#374151' : '#f0f0f0'}`;">
                        <div :style="{ display: 'table-cell', padding: '8px 16px', fontSize: '12px', color: isDark ? '#9ca3af' : '#666', backgroundColor: isDark ? '#374151' : '#fafafa', width: '80px', fontWeight: 500 }">Id</div>
                        <div :style="{ display: 'table-cell', padding: '8px 16px', fontSize: '12px', color: isDark ? '#e5e7eb' : '#333' }">{{ record.trigger.id }}</div>
                      </div>
                      <div style="display: table-row; borderBottom: `1px solid ${isDark ? '#374151' : '#f0f0f0'}`;">
                        <div :style="{ display: 'table-cell', padding: '8px 16px', fontSize: '12px', color: isDark ? '#9ca3af' : '#666', backgroundColor: isDark ? '#374151' : '#fafafa', width: '80px', fontWeight: 500 }">Type</div>
                        <div :style="{ display: 'table-cell', padding: '8px 16px', fontSize: '12px', color: isDark ? '#e5e7eb' : '#333', wordBreak: 'break-all' }">{{ record.trigger.type }}</div>
                      </div>
                      <div v-if="record.trigger.variables" style="display: table-row;">
                        <div :style="{ display: 'table-cell', padding: '8px 16px', fontSize: '12px', color: isDark ? '#9ca3af' : '#666', backgroundColor: isDark ? '#374151' : '#fafafa', width: '80px', fontWeight: 500, verticalAlign: 'top' }">Variables</div>
                        <div :style="{ display: 'table-cell', padding: '8px 16px', fontSize: '12px', color: isDark ? '#e5e7eb' : '#333' }">
                          <pre :style="{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '11px', backgroundColor: isDark ? '#374151' : '#f5f5f5', padding: '6px', borderRadius: '4px', maxWidth: '280px', maxHeight: '200px', overflowY: 'auto' }">{{ JSON.stringify(record.trigger.variables, null, 2) }}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                <span class="flex items-center justify-center gap-1 text-orange-600 cursor-help">
                  <IconifyIcon icon="mdi:flash" :size="14" />
                  <span>触发器触发</span>
                </span>
              </Tooltip>
            </div>
            <span v-else class="text-gray-500 flex items-center justify-center w-full">手动触发</span>
          </template>

          <template v-else-if="column.dataIndex === 'state'">
            <template v-if="column.title === '状态'">
              <Tag :color="getStateColor(record.state.current)">
                {{ getStateLabel(record.state.current) }}
              </Tag>
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

          <template v-else-if="column.dataIndex === 'action'">
            <div class="flex items-center justify-center gap-1">
              <Tooltip placement="top" title="暂停">
                <Button
                  v-if="record.state.current === 'RUNNING'"
                  type="text"
                  size="small"
                  @click="handlePause(record.id)"
                  :loading="executionStore.isOperationLoading"
                  :disabled="executionStore.isOperationLoading"
                  class="!text-blue-500 hover:!text-blue-700 hover:bg-blue-50 rounded-full w-6 h-6 flex items-center justify-center"
                >
                  <IconifyIcon icon="mdi:pause-circle" :size="16" />
                </Button>
              </Tooltip>
              <Tooltip placement="top" title="恢复">
                <Button
                  v-if="record.state.current === 'PAUSED'"
                  type="text"
                  size="small"
                  @click="handleResume(record.id)"
                  :loading="executionStore.isOperationLoading"
                  :disabled="executionStore.isOperationLoading"
                  class="!text-green-500 hover:!text-green-700 hover:bg-green-50 rounded-full w-6 h-6 flex items-center justify-center"
                >
                  <IconifyIcon icon="mdi:play-circle" :size="16" />
                </Button>
              </Tooltip>
              <Tooltip placement="top" title="终止">
                <Button
                  v-if="record.state.current === 'RUNNING' || record.state.current === 'PAUSED'"
                  type="text"
                  size="small"
                  @click="handleKill(record.id)"
                  :loading="executionStore.isOperationLoading"
                  :disabled="executionStore.isOperationLoading"
                  class="!text-red-500 hover:!text-red-700 hover:bg-red-50 rounded-full w-6 h-6 flex items-center justify-center"
                >
                  <IconifyIcon icon="mdi:stop-circle" :size="16" />
                </Button>
              </Tooltip>
              <Tooltip placement="top" title="重启">
                <Button
                  v-if="record.state.current === 'FAILED' || record.state.current === 'WARNING'"
                  type="text"
                  size="small"
                  @click="handleRestart(record.id)"
                  :loading="executionStore.isOperationLoading"
                  :disabled="executionStore.isOperationLoading"
                  class="!text-orange-500 hover:!text-orange-700 hover:bg-orange-50 rounded-full w-6 h-6 flex items-center justify-center"
                >
                  <IconifyIcon icon="mdi:refresh-circle" :size="16" />
                </Button>
              </Tooltip>
              <Tooltip placement="top" title="重跑">
                <Button
                  v-if="['SUCCESS', 'FAILED', 'WARNING', 'KILLED', 'CANCELLED'].includes(record.state.current)"
                  type="text"
                  size="small"
                  @click="handleReplay(record.id)"
                  :loading="executionStore.isOperationLoading"
                  :disabled="executionStore.isOperationLoading"
                  class="!text-indigo-500 hover:!text-indigo-700 hover:bg-indigo-50 rounded-full w-6 h-6 flex items-center justify-center"
                >
                  <IconifyIcon icon="mdi:rotate-3d-variant" :size="16" />
                </Button>
              </Tooltip>
            </div>
          </template>
        </template>
      </Table>
    </Spin>
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
  </Page>
</template>
