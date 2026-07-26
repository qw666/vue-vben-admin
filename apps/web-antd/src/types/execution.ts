export interface ExecutionState {
  current: string;
  histories: Array<{
    state: string;
    date: string;
  }>;
  duration: string;
  startDate: string;
  endDate: string;
}

export interface TaskAttempt {
  state: ExecutionState;
  workerId?: string;
}

export interface TaskRun {
  id: string;
  executionId: string;
  namespace: string;
  flowId: string;
  taskId: string;
  parentTaskRunId?: string;
  attempts: TaskAttempt[];
  outputs: Record<string, any>;
  state: ExecutionState;
}

export interface ExecutionLabel {
  key: string;
  value: string;
}

export interface ExecutionTrigger {
  id: string;
  type: string;
  variables: Record<string, any>;
}

export interface ExecutionMetadata {
  attemptNumber: number;
  originalCreatedDate: string;
}

export interface Execution {
  id: string;
  namespace: string;
  flowId: string;
  flowRevision: number;
  labels: ExecutionLabel[];
  state: ExecutionState;
  taskRunList: TaskRun[];
  originalId: string;
  deleted: boolean;
  metadata: ExecutionMetadata;
  trigger?: ExecutionTrigger;
  scheduleDate?: string;
}

export interface ExecutionQueryParams {
  page?: number;
  size?: number;
  projectId: number;
  flowId?: string;
  startDate?: string;
  endDate?: string;
  state?: string[];
  triggerExecutionId?: string;
}

export interface ExecutionPageResponse {
  records: Execution[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}