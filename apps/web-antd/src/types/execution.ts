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
  taskId: string;
  parentTaskRunId?: string;
  attempts: TaskAttempt[];
  outputs: Record<string, any>;
  state: ExecutionState;
}

export interface ExecutionTrigger {
  id: string;
  type: string;
  variables: Record<string, any>;
}

export interface Execution {
  id: string;
  flowId: string;
  flowRevision: number;
  state: ExecutionState;
  taskRunList: TaskRun[];
  trigger?: ExecutionTrigger;
  scheduleDate?: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  /** 流程名称（后端关联 SysFlowBiz.description 返回） */
  flowName?: string;
  /** 流程模型（后端关联 SysFlowBiz.flowModelRaw 解析返回） */
  flowModel?: Record<string, any>;
  /** 节点布局（后端关联 SysFlowBiz.flowLayout 返回） */
  flowLayout?: string;
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
