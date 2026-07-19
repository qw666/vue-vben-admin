export type WorkflowNodeType =
  | 'code'
  | 'condition'
  | 'data'
  | 'end'
  | 'input'
  | 'llm'
  | 'output'
  | 'prompt'
  | 'start'
  | 'webhook';

export interface WorkflowNodeData {
  label: string;
  type: WorkflowNodeType;
  icon?: string;
  description?: string;
  config?: Record<string, any>;
}

export interface WorkflowNode {
  id: string;
  type: string | undefined;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  folderId?: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
  /** 后端真实数字 ID。新建未保存时为 undefined，保存成功后由后端返回值填充。 */
  backendId?: number;
  /** 传递给后端的 flowId，用于新建保存后从列表中匹配出后端数字 ID。 */
  flowId: string;
  status?: 'normal' | 'disabled' | 'deleted';
}

export interface WorkflowFolder {
  id: number;
  name: string;
  parentId: number;
  sort: number;
  children?: WorkflowFolder[];
  createdAt?: string;
}

export interface NodeTemplate {
  type: WorkflowNodeType;
  label: string;
  icon: string;
  category: string;
  description: string;
}
