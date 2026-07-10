export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'llm'
  | 'prompt'
  | 'code'
  | 'condition'
  | 'webhook'
  | 'data'
  | 'input'
  | 'output';

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
  folderId?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowFolder {
  id: string;
  name: string;
  parentId?: string;
  children?: WorkflowFolder[];
  createdAt: string;
}

export interface NodeTemplate {
  type: WorkflowNodeType;
  label: string;
  icon: string;
  category: string;
  description: string;
}
