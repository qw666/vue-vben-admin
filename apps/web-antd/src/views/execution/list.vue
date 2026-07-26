<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Table, Select, DatePicker, Button, Tag, Spin } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import { useRouter } from 'vue-router';

import { useExecutionStore } from '#/store/execution';
import { useWorkflowStore } from '#/store/workflow';

const router = useRouter();
const executionStore = useExecutionStore();
const workflowStore = useWorkflowStore();

const currentPage = ref(1);
const pageSize = ref(10);
const selectedFlowId = ref('');
const selectedStates = ref<string[]>([]);
const startDate = ref<string>('');
const endDate = ref<string>('');

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
    dataIndex: 'flowId',
    width: 200,
    ellipsis: true,
  },
  {
    title: '触发方式',
    dataIndex: 'labels',
    width: 120,
  },
  {
    title: '状态',
    dataIndex: 'state',
    width: 100,
  },
  {
    title: '开始时间',
    dataIndex: 'state',
    width: 180,
  },
  {
    title: '耗时',
    dataIndex: 'state',
    width: 100,
  },
  {
    title: '版本',
    dataIndex: 'flowRevision',
    width: 80,
  },
];

function formatDuration(duration: string): string {
  const match = duration.match(/PT(\d+\.\d+)?S/);
  if (match) {
    const seconds = parseFloat(match[1] || '0');
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(0)}ms`;
    }
    if (seconds < 60) {
      return `${seconds.toFixed(2)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }
  return duration;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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

function getTriggerType(labels: Array<{ key: string; value: string }>): string {
  const fromLabel = labels.find((l) => l.key === 'system.from');
  return fromLabel?.value === 'trigger' ? 'trigger' : 'ui';
}

function viewDetail(executionId: string) {
  router.push(`/execution/detail/${executionId}`);
}

async function loadData() {
  await executionStore.loadExecutions({
    page: currentPage.value,
    size: pageSize.value,
    projectId: workflowStore.projectId,
    flowId: selectedFlowId.value || undefined,
    startDate: startDate.value || undefined,
    endDate: endDate.value || undefined,
    state: selectedStates.value.length > 0 ? selectedStates.value : undefined,
  });
}

function handleReset() {
  selectedFlowId.value = '';
  selectedStates.value = [];
  startDate.value = '';
  endDate.value = '';
  currentPage.value = 1;
  loadData();
}

function handleDateChange(date: any, type: 'start' | 'end') {
  if (date) {
    const utcDate = date.toISOString().replace('.000Z', 'Z');
    if (type === 'start') {
      startDate.value = utcDate;
    } else {
      endDate.value = utcDate;
    }
  } else {
    if (type === 'start') {
      startDate.value = '';
    } else {
      endDate.value = '';
    }
  }
}

onMounted(async () => {
  await workflowStore.loadProjects();
  await workflowStore.loadWorkflows();
  await loadData();
});

watch(() => workflowStore.projectId, () => {
  currentPage.value = 1;
  loadData();
});
</script>

<template>
  <Page>
    <template #title>流程执行记录</template>

    <template #extra>
      <Button type="primary" @click="loadData">
        <IconifyIcon icon="mdi:refresh" :size="16" />
        刷新
      </Button>
      <Button @click="handleReset">
        <IconifyIcon icon="mdi:rotate-ccw" :size="16" />
        重置
      </Button>
    </template>

    <div class="mb-4 p-4 bg-white rounded-lg shadow-sm">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600">流程：</label>
          <Select
            v-model:value="selectedFlowId"
            placeholder="请选择流程"
            style="width: 200px"
            allowClear
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
          <label class="text-sm text-gray-600">状态：</label>
          <Select
            v-model:value="selectedStates"
            placeholder="请选择状态"
            style="width: 200px"
            mode="multiple"
            allowClear
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
          <label class="text-sm text-gray-600">开始时间：</label>
          <DatePicker
            v-model:value="startDate"
            placeholder="开始时间"
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            @change="(date: any) => handleDateChange(date, 'start')"
          />
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600">结束时间：</label>
          <DatePicker
            v-model:value="endDate"
            placeholder="结束时间"
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            @change="(date: any) => handleDateChange(date, 'end')"
          />
        </div>

        <Button type="primary" @click="loadData">
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
            currentPage = page;
            pageSize = size;
            loadData();
          },
        }"
        row-key="id"
        bordered
        class="mt-4"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'id'">
            <a class="text-blue-600 hover:text-blue-800" @click="viewDetail(record.id)">
              {{ record.id }}
            </a>
          </template>

          <template v-else-if="column.dataIndex === 'labels'">
            <span v-if="getTriggerType(record.labels) === 'trigger'" class="flex items-center gap-1 text-orange-600">
              <IconifyIcon icon="mdi:flash" :size="14" />
              <span>触发器</span>
            </span>
            <span v-else class="flex items-center gap-1 text-blue-600">
              <IconifyIcon icon="mdi:account" :size="14" />
              <span>手动运行</span>
            </span>
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
            <template v-else-if="column.title === '耗时'">
              {{ formatDuration(record.state.duration) }}
            </template>
          </template>
        </template>
      </Table>
    </Spin>
  </Page>
</template>
