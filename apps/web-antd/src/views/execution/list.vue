<script lang="ts" setup>
import { onMounted, ref, watch, nextTick } from 'vue';

import { Page } from '@vben/common-ui';
import { Table, Select, DatePicker, Button, Tag, Spin, Tooltip } from 'ant-design-vue';
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
const isLoading = ref(true);
const localProjectId = ref<number | null>(null);
const showTriggerTooltip = ref('');

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
    title: '触发器',
    dataIndex: 'trigger',
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
    title: '结束时间',
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

function getTriggerType(record: any): string {
  if (record.trigger || record.scheduleDate) {
    return 'trigger';
  }
  return 'ui';
}

function viewDetail(executionId: string) {
  router.push(`/shuzhiliu/execution/detail/${executionId}`);
}

async function loadData() {
  const pid = localProjectId.value ?? workflowStore.projectId;
  await executionStore.loadExecutions({
    page: currentPage.value,
    size: pageSize.value,
    projectId: pid,
    flowId: selectedFlowId.value || undefined,
    startDate: startDate.value || undefined,
    endDate: endDate.value || undefined,
    state: selectedStates.value.length > 0 ? selectedStates.value : undefined,
  });
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

function handleProjectChange(value: number) {
  localProjectId.value = value;
  workflowStore.setProjectId(value);
  currentPage.value = 1;
  loadData();
}

onMounted(async () => {
  try {
    await workflowStore.loadProjects();
    await workflowStore.loadWorkflows();
    localProjectId.value = workflowStore.projectId;
    await loadData();
  } finally {
    isLoading.value = false;
  }
});

watch(() => workflowStore.projectId, (newVal) => {
  if (localProjectId.value !== newVal) {
    localProjectId.value = newVal;
    currentPage.value = 1;
    loadData();
  }
});
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
          :loading="isLoading"
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
            <a class="text-blue-600 hover:text-blue-800" @click="viewDetail(record.id)">
              {{ record.id }}
            </a>
          </template>

          <template v-else-if="column.dataIndex === 'trigger'">
            <template v-if="record.trigger">
              <div class="relative flex items-center justify-center">
                <span 
                  class="flex items-center gap-1 text-orange-600 cursor-help"
                  @mouseenter="() => { showTriggerTooltip = record.id; }"
                  @mouseleave="() => { showTriggerTooltip = ''; }"
                >
                  <IconifyIcon icon="mdi:flash" :size="14" />
                  <span>触发器</span>
                </span>
                <div 
                  v-if="showTriggerTooltip === record.id"
                  class="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[280px]"
                >
                  <div class="font-semibold mb-2 text-gray-800">Trigger details: {{ record.trigger.id }}</div>
                  <div class="border-t border-gray-200 pt-2">
                    <div class="flex gap-4 mb-1">
                      <span class="text-gray-500 text-sm w-12 flex-shrink-0">Id:</span>
                      <span class="text-gray-800 text-sm">{{ record.trigger.id }}</span>
                    </div>
                    <div class="flex gap-4 mb-1">
                      <span class="text-gray-500 text-sm w-12 flex-shrink-0">Type:</span>
                      <span class="text-gray-800 text-sm">{{ record.trigger.type }}</span>
                    </div>
                    <div v-if="record.trigger.variables" class="mt-2">
                      <div class="text-gray-500 text-sm mb-1">Variables:</div>
                      <pre class="text-xs whitespace-pre-wrap bg-gray-100 text-gray-800 p-2 rounded max-h-40 overflow-auto">{{ JSON.stringify(record.trigger.variables, null, 2) }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <span v-else class="text-gray-400 flex items-center justify-center w-full">—</span>
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
        </template>
      </Table>
    </Spin>
  </Page>
</template>
