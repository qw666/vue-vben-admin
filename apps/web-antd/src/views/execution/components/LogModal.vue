<script lang="ts" setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { Modal, Select, InputNumber, Button } from 'ant-design-vue';
import { useExecutionStore } from '#/store/execution';
import type { ExecutionLogVO } from '#/types/log';

const props = defineProps<{
  visible: boolean;
  executionId: string;
  flowId: string;
  projectId: number;
  state: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

const executionStore = useExecutionStore();

const logs = ref<ExecutionLogVO[]>([]);
const isInitialLoading = ref(false);
const isRefreshing = ref(false);
const currentState = ref(props.state);

const minLevel = ref<string>('');
const taskRunId = ref<string>('');
const taskId = ref<string>('');
const attempt = ref<number | undefined>();

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let isLoadingData = false;

const isRunningOrPaused = computed(() => {
  return currentState.value === 'RUNNING' || currentState.value === 'PAUSED';
});

const levelOptions = [
  { value: '', label: '全部' },
  { value: 'TRACE', label: 'TRACE' },
  { value: 'DEBUG', label: 'DEBUG' },
  { value: 'INFO', label: 'INFO' },
  { value: 'WARN', label: 'WARN' },
  { value: 'ERROR', label: 'ERROR' },
];

const levelColors: Record<string, string> = {
  TRACE: 'text-gray-500',
  DEBUG: 'text-blue-500',
  INFO: 'text-green-500',
  WARN: 'text-yellow-500',
  ERROR: 'text-red-500',
};

async function checkExecutionState() {
  try {
    const detail = await executionStore.loadExecutionDetail(
      props.projectId,
      props.flowId,
      props.executionId
    );
    if (detail && detail.state && detail.state.current) {
      currentState.value = detail.state.current;
      if (!isRunningOrPaused.value) {
        stopAutoRefresh();
      }
    }
  } catch (error) {
    console.error('Failed to check execution state:', error);
  }
}

async function loadHistoryLogs(isRefresh = false) {
  if (isLoadingData) return;
  
  isLoadingData = true;
  if (!isRefresh) {
    isInitialLoading.value = true;
  } else {
    isRefreshing.value = true;
  }
  
  try {
    const result = await executionStore.listExecutionLog({
      projectId: props.projectId,
      flowId: props.flowId,
      executionId: props.executionId,
      minLevel: minLevel.value || undefined,
      taskRunId: taskRunId.value || undefined,
      taskId: taskId.value || undefined,
      attempt: attempt.value,
    });
    logs.value = result;
    
    if (isRefresh) {
      await checkExecutionState();
    }
  } catch (error) {
    console.error('Failed to load history logs:', error);
  } finally {
    isLoadingData = false;
    isInitialLoading.value = false;
    isRefreshing.value = false;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  if (isRunningOrPaused.value) {
    refreshTimer = setInterval(() => {
      loadHistoryLogs(true);
    }, 3000);
  }
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function handleRefresh() {
  loadHistoryLogs(true);
}

function handleCancel() {
  stopAutoRefresh();
  emit('update:visible', false);
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return '-';
  let normalizedDateStr = timestamp;
  const lastPart = timestamp.slice(-6);
  if (!timestamp.endsWith('Z') && !lastPart.includes('+') && !lastPart.includes('-')) {
    normalizedDateStr = timestamp + 'Z';
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

watch(() => props.visible, (newVal) => {
  if (newVal) {
    currentState.value = props.state;
    logs.value = [];
    minLevel.value = '';
    taskRunId.value = '';
    taskId.value = '';
    attempt.value = undefined;
    loadHistoryLogs(false);
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<template>
  <Modal
    :open="visible"
    title="执行日志"
    width="900px"
    :footer="null"
    @cancel="handleCancel"
    @update:open="emit('update:visible', $event)"
  >
    <div class="mb-4">
      <div class="flex flex-wrap gap-4 items-center mb-4">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">日志级别:</span>
          <Select
            v-model:value="minLevel"
            class="w-24"
            size="small"
            :options="levelOptions"
          />
        </div>
        
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">taskRunId:</span>
          <input
            v-model="taskRunId"
            type="text"
            class="w-40 px-3 py-1.5 border border-gray-300 rounded text-sm"
            placeholder="输入taskRunId"
          />
        </div>
        
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">taskId:</span>
          <input
            v-model="taskId"
            type="text"
            class="w-32 px-3 py-1.5 border border-gray-300 rounded text-sm"
            placeholder="输入taskId"
          />
        </div>
        
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">attempt:</span>
          <InputNumber
            v-model:value="attempt"
            class="w-20"
            :min="0"
          />
        </div>
        
        <Button type="primary" size="small" @click="loadHistoryLogs(false)">
          查询
        </Button>
        
        <div v-if="isRunningOrPaused" class="flex items-center gap-1 ml-auto">
          <span class="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span class="text-xs text-gray-500">自动刷新中</span>
        </div>
      </div>
    </div>
    
    <div class="relative">
      <div
        class="h-96 overflow-y-auto bg-gray-50 rounded-lg p-4 font-mono text-sm"
      >
        <div v-if="logs.length === 0" class="text-center text-gray-500 py-8">
          {{ isInitialLoading ? '加载中...' : '暂无日志' }}
        </div>
        
        <div v-else class="space-y-2">
          <div
            v-for="(log, index) in logs"
            :key="index"
            class="p-2 bg-white rounded border border-gray-100 transition-opacity duration-300"
          >
            <div class="flex flex-wrap gap-3 mb-1">
              <span class="text-gray-400">{{ formatTimestamp(log.timestamp) }}</span>
              <span :class="levelColors[log.level] || 'text-gray-500'" class="font-bold">
                [{{ log.level }}]
              </span>
              <span v-if="log.taskId" class="text-gray-500">taskId: {{ log.taskId }}</span>
              <span v-if="log.taskRunId" class="text-gray-500">taskRunId: {{ log.taskRunId }}</span>
              <span v-if="log.attemptNumber !== undefined" class="text-gray-500">attempt: {{ log.attemptNumber }}</span>
            </div>
            <div class="text-gray-800 break-all">{{ log.message }}</div>
          </div>
        </div>
      </div>
      
      <div v-if="isInitialLoading" class="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-50">
        <div class="text-gray-500 text-sm">加载中...</div>
      </div>
    </div>
    
    <div class="mt-4 flex justify-end items-center gap-2">
      <span v-if="isRefreshing" class="text-xs text-gray-400">刷新中...</span>
      <Button size="small" @click="handleRefresh">
        刷新
      </Button>
    </div>
  </Modal>
</template>
