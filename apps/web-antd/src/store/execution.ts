import { ref } from 'vue';
import { defineStore } from 'pinia';
import { requestClient } from '#/api/request';
import type { Execution, ExecutionQueryParams, ExecutionPageResponse } from '#/types/execution';
import type { ExecutionLogVO, LogSearchDTO } from '#/types/log';

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

  async function listExecutionLog(params: LogSearchDTO): Promise<ExecutionLogVO[]> {
    try {
      const result = await requestClient.post<ExecutionLogVO[]>(
        '/flow/plat/execution/log/list',
        params,
        {
          headers: {
            tenantId: 'tenant001',
            loginUser: 'admin',
          },
        },
      );
      return result;
    } catch (error) {
      console.error('Failed to load execution log:', error);
      return [];
    }
  }

  function followExecutionLog(
    projectId: number,
    flowId: string,
    executionId: string,
    minLevel?: string,
    onMessage?: (log: ExecutionLogVO) => void,
    onError?: (error: any) => void,
    onComplete?: () => void,
  ): { abort: () => void } | null {
    try {
      const url = new URL('/api/flow/plat/execution/log/follow', window.location.origin);
      url.searchParams.set('projectId', String(projectId));
      url.searchParams.set('flowId', flowId);
      url.searchParams.set('executionId', executionId);
      url.searchParams.set('tenantId', 'tenant001');
      if (minLevel) {
        url.searchParams.set('minLevel', minLevel);
      }

      console.log('Connecting to SSE:', url.toString());

      const controller = new AbortController();
      const signal = controller.signal;

      fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        signal,
      })
        .then(async (response) => {
          console.log('SSE response status:', response.status);
          console.log('SSE response Content-Type:', response.headers.get('content-type'));
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('Failed to get reader');
          }

          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log('SSE connection closed');
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                console.log('SSE raw line:', line);
                
                if (line.startsWith('data: ')) {
                  try {
                    const dataStr = line.substring(6);
                    const log = JSON.parse(dataStr);
                    console.log('Parsed log:', log);
                    if (onMessage) {
                      onMessage(log);
                    }
                  } catch (error) {
                    console.error('Failed to parse log message:', error, 'raw data:', line.substring(6));
                  }
                } else if (line.startsWith('data:')) {
                  try {
                    const dataStr = line.substring(5);
                    const log = JSON.parse(dataStr);
                    console.log('Parsed log (no space):', log);
                    if (onMessage) {
                      onMessage(log);
                    }
                  } catch (error) {
                    console.error('Failed to parse log message:', error, 'raw data:', line.substring(5));
                  }
                }
              }
            }
          }

          if (onComplete) {
            onComplete();
          }
        })
        .catch((error) => {
          console.error('SSE error:', error);
          if (onError) {
            onError(error);
          }
        });

      return {
        abort: () => {
          console.log('Aborting SSE connection');
          controller.abort();
        },
      };
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      if (onError) {
        onError(error);
      }
      return null;
    }
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
    listExecutionLog,
    followExecutionLog,
  };
});
