import { ref } from 'vue';
import { defineStore } from 'pinia';
import { requestClient } from '#/api/request';
import type { Execution, ExecutionQueryParams, ExecutionPageResponse } from '#/types/execution';

export const useExecutionStore = defineStore('execution', () => {
  const executions = ref<Execution[]>([]);
  const totalExecutions = ref(0);
  const isExecutionsLoading = ref(false);
  const currentExecution = ref<Execution | null>(null);

  async function loadExecutions(params: ExecutionQueryParams): Promise<void> {
    isExecutionsLoading.value = true;
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
      isExecutionsLoading.value = false;
    }
  }

  function setCurrentExecution(execution: Execution | null) {
    currentExecution.value = execution;
  }

  return {
    executions,
    totalExecutions,
    isExecutionsLoading,
    currentExecution,
    loadExecutions,
    setCurrentExecution,
  };
});
