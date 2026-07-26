<script lang="ts" setup>
import { onMounted, ref, computed } from 'vue';

import { Page } from '@vben/common-ui';
import { Tag, Descriptions, Collapse, Spin } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import { useRoute, useRouter } from 'vue-router';

import { useExecutionStore } from '#/store/execution';
import { useWorkflowStore } from '#/store/workflow';
import type { Execution, TaskRun } from '#/types/execution';

const route = useRoute();
const router = useRouter();
const executionStore = useExecutionStore();
const workflowStore = useWorkflowStore();

const execution = ref<Execution | null>(null);
const isLoading = ref(true);
const expandedTaskIds = ref<string[]>([]);

const executionId = computed(() => route.params.id as string);

const stateColorMap: Record<string, string> = {
  CREATED: 'gray',
  RUNNING: 'blue',
  SUCCESS: 'green',
  FAILED: 'red',
};

const stateLabelMap: Record<string, string> = {
  CREATED: '已创建',
  RUNNING: '运行中',
  SUCCESS: '成功',
  FAILED: '失败',
};

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

function getTaskBarStyle(task: TaskRun, executionStart: number, executionEnd: number) {
  const taskStart = new Date(task.state.startDate).getTime();
  const taskEnd = new Date(task.state.endDate).getTime();
  const totalDuration = executionEnd - executionStart;
  const left = ((taskStart - executionStart) / totalDuration) * 100;
  const width = Math.max(((taskEnd - taskStart) / totalDuration) * 100, 2);
  return {
    left: `${left}%`,
    width: `${width}%`,
  };
}

function getTaskColor(state: string): string {
  const colorMap: Record<string, string> = {
    CREATED: '#9CA3AF',
    RUNNING: '#3B82F6',
    SUCCESS: '#22C55E',
    FAILED: '#EF4444',
  };
  return colorMap[state] || '#9CA3AF';
}

function toggleTaskExpand(taskId: string) {
  const index = expandedTaskIds.value.indexOf(taskId);
  if (index > -1) {
    expandedTaskIds.value.splice(index, 1);
  } else {
    expandedTaskIds.value.push(taskId);
  }
}

function getTriggerLabel(type: string): string {
  const parts = type.split('.');
  return parts[parts.length - 1] || type;
}

function getTaskLabel(taskId: string): string {
  const parts = taskId.split('_');
  if (parts.length > 1) {
    return parts[0];
  }
  return taskId;
}

async function loadExecution() {
  isLoading.value = true;
  try {
    await executionStore.loadExecutions({
      projectId: workflowStore.projectId,
    });
    execution.value = executionStore.executions.find((e) => e.id === executionId.value) || null;
  } catch (error) {
    console.error('Failed to load execution:', error);
    execution.value = null;
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  router.push('/shuzhiliu/execution/list');
}

onMounted(async () => {
  await workflowStore.loadProjects();
  await loadExecution();
});
</script>

<template>
  <Page>
    <template #title>执行详情</template>

    <template #extra>
      <button class="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors" @click="goBack">
        <IconifyIcon icon="mdi:arrow-left" :size="16" />
        返回列表
      </button>
    </template>

    <Spin :spinning="isLoading">
      <div v-if="execution" class="space-y-4">
        <div class="bg-card rounded-lg shadow-sm p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="text-2xl font-bold text-foreground">{{ execution.id }}</div>
            <Tag :color="stateColorMap[execution.state.current]" class="text-lg">
              {{ stateLabelMap[execution.state.current] }}
            </Tag>
          </div>

          <Descriptions :column="2" bordered>
            <Descriptions.Item label="流程ID">{{ execution.flowId }}</Descriptions.Item>
            <Descriptions.Item label="流程名称">{{ execution.flowName || '-' }}</Descriptions.Item>
            <Descriptions.Item label="流程版本">{{ execution.flowRevision }}</Descriptions.Item>
            <Descriptions.Item label="开始时间">{{ formatDate(execution.state.startDate) }}</Descriptions.Item>
            <Descriptions.Item label="结束时间">{{ execution.state.endDate ? formatDate(execution.state.endDate) : '-' }}</Descriptions.Item>
            <Descriptions.Item label="耗时">{{ formatDuration(execution.state.duration) }}</Descriptions.Item>
            <Descriptions.Item label="尝试次数" :span="2">{{ execution.metadata.attemptNumber }}</Descriptions.Item>
          </Descriptions>
        </div>

        <div class="bg-card rounded-lg shadow-sm p-6">
          <h3 class="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <IconifyIcon icon="mdi:timeline" :size="20" />
            任务执行时序图
          </h3>

          <div class="relative">
            <div class="h-8 border-b border-border relative mb-2">
              <div class="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {{ formatDate(execution.state.startDate) }}
              </div>
              <div class="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {{ execution.state.endDate ? formatDate(execution.state.endDate) : '-' }}
              </div>
            </div>

            <div class="space-y-3">
              <div
                v-for="task in execution.taskRunList"
                :key="task.id"
                class="relative"
                :class="{ 'pl-6': task.parentTaskRunId }"
              >
                <div class="flex items-center gap-3 mb-1">
                  <span class="w-24 text-sm text-foreground truncate flex-shrink-0">
                    {{ getTaskLabel(task.taskId) }}
                  </span>
                  <Tag :color="stateColorMap[task.state.current]" class="flex-shrink-0">
                    {{ stateLabelMap[task.state.current] }}
                  </Tag>
                  <span class="text-xs text-muted-foreground">
                    {{ formatDuration(task.state.duration) }}
                  </span>
                  <button
                    class="ml-auto text-muted-foreground hover:text-foreground"
                    @click="toggleTaskExpand(task.id)"
                  >
                    <IconifyIcon
                      icon="mdi:chevron-down"
                      :size="16"
                      :class="{ 'rotate-180': expandedTaskIds.includes(task.id) }"
                    />
                  </button>
                </div>

                <div class="h-6 bg-muted rounded relative overflow-hidden">
                  <div
                    class="absolute top-0 h-full rounded transition-all"
                    :style="{
                      ...getTaskBarStyle(task, new Date(execution.state.startDate).getTime(), new Date(execution.state.endDate || execution.state.startDate).getTime()),
                      backgroundColor: getTaskColor(task.state.current),
                    }"
                  />
                </div>

                <Collapse v-model:activeKey="expandedTaskIds" :keys="[task.id]" class="mt-2">
                  <Collapse.Panel :header="'任务详情'" :key="task.id">
                    <Descriptions :column="2" bordered class="text-sm">
                      <Descriptions.Item label="任务ID">{{ task.taskId }}</Descriptions.Item>
                      <Descriptions.Item label="运行ID">{{ task.id }}</Descriptions.Item>
                      <Descriptions.Item label="开始时间">{{ formatDate(task.state.startDate) }}</Descriptions.Item>
                      <Descriptions.Item label="结束时间">{{ task.state.endDate ? formatDate(task.state.endDate) : '-' }}</Descriptions.Item>
                      <Descriptions.Item label="状态">{{ stateLabelMap[task.state.current] }}</Descriptions.Item>
                      <Descriptions.Item label="尝试次数">{{ task.attempts.length }}</Descriptions.Item>
                      <Descriptions.Item label="输出" :span="2">
                        <pre class="bg-muted p-2 rounded text-xs overflow-auto max-h-40">{{ JSON.stringify(task.outputs, null, 2) }}</pre>
                      </Descriptions.Item>
                    </Descriptions>

                    <div v-if="task.attempts.length > 0" class="mt-4">
                      <h4 class="text-sm font-semibold text-foreground mb-2">尝试记录</h4>
                      <div class="space-y-2">
                        <div
                          v-for="(attempt, index) in task.attempts"
                          :key="index"
                          class="p-3 bg-gray-50 rounded"
                        >
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs text-gray-500">尝试 {{ index + 1 }}</span>
                            <Tag :color="stateColorMap[attempt.state.current]" class="text-xs">
                              {{ stateLabelMap[attempt.state.current] }}
                            </Tag>
                          </div>
                          <div class="text-xs text-gray-600 space-y-1">
                            <div>开始: {{ formatDate(attempt.state.startDate) }}</div>
                            <div>结束: {{ attempt.state.endDate ? formatDate(attempt.state.endDate) : '-' }}</div>
                            <div>耗时: {{ formatDuration(attempt.state.duration) }}</div>
                            <div v-if="attempt.workerId">Worker: {{ attempt.workerId }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Collapse.Panel>
                </Collapse>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-card rounded-lg shadow-sm p-6">
          <h3 class="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <IconifyIcon icon="mdi:history" :size="20" />
            状态历史
          </h3>

          <div class="flex items-start gap-4">
            <div class="flex flex-col items-center">
              <div
                v-for="(history, index) in execution.state.histories"
                :key="index"
                class="flex flex-col items-center"
              >
                <div
                  class="w-3 h-3 rounded-full border-2"
                  :style="{
                    backgroundColor: getTaskColor(history.state),
                    borderColor: getTaskColor(history.state),
                  }"
                />
                <div v-if="index < execution.state.histories.length - 1" class="w-0.5 h-6 bg-border" />
              </div>
            </div>
            <div class="flex-1 space-y-6">
              <div
                v-for="(history, index) in execution.state.histories"
                :key="index"
              >
                <div class="flex items-center gap-2">
                  <Tag :color="stateColorMap[history.state]">
                    {{ stateLabelMap[history.state] }}
                  </Tag>
                  <span class="text-sm text-gray-600">{{ formatDate(history.date) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="bg-white rounded-lg shadow-sm p-12 text-center">
        <IconifyIcon icon="mdi:alert-circle" :size="48" class="text-gray-400 mx-auto mb-4" />
        <p class="text-gray-500">未找到执行记录</p>
        <button
          class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="goBack"
        >
          返回列表
        </button>
      </div>
    </Spin>
  </Page>
</template>
