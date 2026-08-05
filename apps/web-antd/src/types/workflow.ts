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
  type: string;
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

export interface WorkflowOutput {
  id: string;
  type: string;
  value: string;
  description?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  folderId?: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputs?: WorkflowOutput[];
  inputs?: WorkflowInput[];
  triggers?: WorkflowTrigger[];
  createdAt: string;
  updatedAt: string;
  /** 后端真实数字 ID。新建未保存时为 undefined，保存成功后由后端返回值填充。 */
  backendId?: number;
  /** 传递给后端的 flowId，用于新建保存后从列表中匹配出后端数字 ID。 */
  flowId: string;
  status?: 'normal' | 'disabled' | 'deleted';
  /** 流程是否启用 */
  enabled?: boolean;
  /** 是否有活跃的触发器 */
  hasActiveTrigger?: boolean;
  /** 画布布局信息，用于保存和恢复节点位置 */
  flowLayout?: string;
  /** 流程级变量（vars.*） */
  variables?: Array<{ key: string; value: string; label?: string }>;
  /** 标签（labels.*） */
  labels?: Array<{ key: string; value: string }>;
  /** 环境变量（envs.*） */
  envs?: Array<{ key: string; value: string }>;
  /** 全局配置（globals.*） */
  globals?: Array<{ key: string; value: string }>;
}

export interface WorkflowInput {
  id: string;
  type: string;
  defaults?: any;
  displayName?: string;
  required?: boolean;
}

export interface WorkflowTrigger {
  id: string;
  type: string;
  [key: string]: any;
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

// ===== 变量选择器相关类型 =====

/** 变量类型，用于类型提示与校验（当前仅用于展示，不阻断） */
export type VarType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';

/** 变量来源分组，对齐 Kestra 执行上下文 */
export type VarGroup =
  | 'upstream'
  | 'inputs'
  | 'trigger'
  | 'loop'
  | 'system'
  | 'vars'
  | 'labels'
  | 'envs'
  | 'globals';

/**
 * 变量树节点。
 * - 叶子节点：有 expression，选中后直接写入字段
 * - 分支节点：有 children，仅用于分组展示
 */
export interface VarNode {
  /** 唯一标识，用于搜索和定位 */
  key: string;
  /** 显示名 */
  label: string;
  /** 选中后生成的 Kestra 表达式，如 '{{ outputs.nodeA.body }}'。分支节点为空 */
  expression?: string;
  /** 变量类型提示 */
  type?: VarType;
  /** 来源分组 */
  group: VarGroup;
  /** 图标名（mdi 系列），可选 */
  icon?: string;
  /** 禁用原因（如并行分支隔离）。设置后该节点不可选 */
  disabledReason?: string;
  /** 子节点（分支节点） */
  children?: VarNode[];
}

/** 变量来源 provider 接口，用于注册不同来源的变量 */
export interface VarSourceProvider {
  /** 来源标识 */
  id: string;
  /** 分组标签 */
  label: string;
  /** 分组 */
  group: VarGroup;
  /** 图标 */
  icon?: string;
  /** 排序权重，数字越小越靠前 */
  order?: number;
  /** 获取该来源下的变量节点列表 */
  getVars(ctx: VarSourceContext): VarNode[];
  /** 是否启用（默认 true） */
  enabled?: (ctx: VarSourceContext) => boolean;
}

/** 变量来源上下文，传递给 provider */
export interface VarSourceContext {
  /** 当前节点 ID */
  currentNodeId: string;
  /** 画布全部节点 */
  nodes: WorkflowNode[];
  /** 画布全部连线 */
  edges: WorkflowEdge[];
  /** 流程输入 */
  inputs?: WorkflowInput[];
  /** 流程触发器 */
  triggers?: WorkflowTrigger[];
  /** 流程输出 */
  outputs?: WorkflowOutput[];
  /** 流程变量（vars.*） */
  vars?: Array<{ key: string; label?: string; value?: any }>;
  /** 标签（labels.*） */
  labels?: Array<{ key: string; label?: string }>;
  /** 环境变量（envs.*） */
  envs?: Array<{ key: string; label?: string }>;
  /** 全局配置（globals.*） */
  globals?: Array<{ key: string; label?: string }>;
  /** 插件元数据缓存，用于获取动态节点的 outputs 声明 */
  pluginMetaCache?: Record<string, any>;
}
