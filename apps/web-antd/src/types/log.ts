export interface ExecutionLogVO {
  flowId: string;
  taskId: string;
  executionId: string;
  taskRunId: string;
  attemptNumber: number;
  triggerId: string;
  timestamp: string;
  level: string;
  thread: string;
  message: string;
  executionKind: string;
  deleted: boolean;
  progress: string;
}

export interface LogSearchDTO {
  projectId: number;
  flowId: string;
  executionId: string;
  minLevel?: string;
  taskRunId?: string;
  taskId?: string;
  attempt?: number;
}