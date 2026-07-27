import { ref } from 'vue';
import { defineStore } from 'pinia';
import { requestClient } from '#/api/request';
import type { Execution, ExecutionQueryParams, ExecutionPageResponse } from '#/types/execution';

export interface ExecutionBatchOperateDTO {
  projectId: number;
  executionIdList: string[];
}

export interface ExecutionBatchReplayDTO extends ExecutionBatchOperateDTO {
  latestRevision?: boolean;
}

export const useExecutionStore = defineStore('execution', () => {
  const executions = ref<Execution[]>([]);
  const totalExecutions = ref(0);
  const isExecutionsLoading = ref(false);
  const currentExecution = ref<Execution | null>(null);
  const isOperationLoading = ref(false);

  async function loadExecutions(params: ExecutionQueryParams, isAutoRefresh = false): Promise<void> {
    if (!isAutoRefresh) {
      isExecutionsLoading.value = true;
    }
    try {
      const result = await requestClient.post<ExecutionPageResponse>(
        '/flow/plat/execution/page',
        params,
        {
          headers: {
            tenantId: 'tenant001',
            loginUser: 'admin',
          },
        },
      );
      executions.value = result.records || [];
      totalExecutions.value = result.total || 0;
    } catch (error) {
      console.error('Failed to load executions:', error);
      executions.value = [];
      totalExecutions.value = 0;
    } finally {
      if (!isAutoRefresh) {
        isExecutionsLoading.value = false;
      }
    }
  }

  async function batchKill(params: ExecutionBatchOperateDTO): Promise<void> {
    isOperationLoading.value = true;
    try {
      await requestClient.post(
        '/flow/plat/execution/batch/kill',
        params,
        {
          headers: {
            tenantId: 'tenant001',
            loginUser: 'admin',
          },
        },
      );
    } finally {
      isOperationLoading.value = false;
    }
  }

  async function batchRestart(params: ExecutionBatchOperateDTO): Promise<void> {
    isOperationLoading.value = true;
    try {
      await requestClient.post(
        '/flow/plat/execution/batch/restart',
        params,
        {
          headers: {
            tenantId: 'tenant001',
            loginUser: 'admin',
          },
        },
      );
    } finally {
      isOperationLoading.value = false;
    }
  }

  async function batchReplay(params: ExecutionBatchReplayDTO): Promise<void> {
    isOperationLoading.value = true;
    try {
      await requestClient.post(
        '/flow/plat/execution/batch/replay',
        params,
        {
          headers: {
            tenantId: 'tenant001',
            loginUser: 'admin',
          },
        },
      );
    } finally {
      isOperationLoading.value = false;
    }
  }

  async function batchPause(params: ExecutionBatchOperateDTO): Promise<void> {
    isOperationLoading.value = true;
    try {
      await requestClient.post(
        '/flow/plat/execution/batch/pause',
        params,
        {
          headers: {
            tenantId: 'tenant001',
            loginUser: 'admin',
          },
        },
      );
    } finally {
      isOperationLoading.value = false;
    }
  }

  async function batchResume(params: ExecutionBatchOperateDTO): Promise<void> {
    isOperationLoading.value = true;
    try {
      await requestClient.post(
        '/flow/plat/execution/batch/resume',
        params,
        {
          headers: {
            tenantId: 'tenant001',
            loginUser: 'admin',
          },
        },
      );
    } finally {
      isOperationLoading.value = false;
    }
  }

  async function loadExecutionDetail(projectId: number, flowId: string, executionId: string): Promise<Execution | null> {
    try {
      console.log('loadExecutionDetail called with:', { projectId, flowId, executionId });
      const result = await requestClient.post<Execution>(
        '/flow/plat/execution/detail',
        {
          projectId,
          flowId,
          executionId,
        },
        {
          headers: {
            tenantId: 'tenant001',
            loginUser: 'admin',
          },
        },
      );
      console.log('loadExecutionDetail result:', result);
      return result;
    } catch (error) {
      console.error('Failed to load execution detail:', error);
      return null;
    }
  }

  function setCurrentExecution(execution: Execution | null) {
    currentExecution.value = execution;
  }

  return {
    executions,
    totalExecutions,
    isExecutionsLoading,
    isOperationLoading,
    currentExecution,
    loadExecutions,
    loadExecutionDetail,
    batchKill,
    batchRestart,
    batchReplay,
    batchPause,
    batchResume,
    setCurrentExecution,
  };
});
