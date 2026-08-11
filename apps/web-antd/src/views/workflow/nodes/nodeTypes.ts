export type ConnectionType = 'single' | 'list' | 'cases';
export type ConnectionMode = 'parallel' | 'sequential';

/** 前端节点分组标识（与后端 groupKey 对齐） */
export type FrontendNodeGroup =
  | 'flowControl' // 流程控制
  | 'tools' // 工具
  | 'ai' // AI 能力
  | 'hidden'; // 不在面板显示

/** 节点功能分类，用于 UI 渲染判断 */
export type NodeCategory =
  | 'start' // 开始节点
  | 'end' // 结束节点
  | 'http' // HTTP 请求节点
  | 'code' // 代码/脚本节点
  | 'flow' // 流程控制节点（Switch/If/ForEach 等）
  | 'output' // 输出节点
  | 'tool' // 通用工具节点
  | 'ai'; // AI 节点

export interface WorkflowNodePort {
  field: string;
  label: string;
  color: string;
  dynamic?: boolean;
  excludeFromBounds?: boolean;
  connectionType: ConnectionType;
  connectionMode: ConnectionMode;
}

export interface FlowControlNodeConfig {
  nodeType: string;
  nodeName: string;
  icon: string;
  description: string;
  /** 前端节点声明的分组 */
  group: FrontendNodeGroup;
  /** 节点功能分类，用于 UI 渲染判断 */
  category?: NodeCategory;
  ports: {
    input?: number;
    output?: WorkflowNodePort[];
  };
  taskFields?: string[];
  /**
   * 透明容器标志：标记为 true 的容器节点在反序列化时会被展开为子任务，
   * 在序列化时由策略的 serializeTaskFieldItems 方法决定如何包装。
   * 用于实现 Sequential 等序列化层概念的节点，对画布层完全透明。
   */
  transparentContainer?: boolean;
}

export interface NodeOutputDef {
  /** 输出 key，对应 Kestra 表达式 outputs.<nodeId>.<key> 的最后一段 */
  key: string;
  /** 显示名，默认与 key 相同 */
  label?: string;
  /** 类型提示，默认 any */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  /**
   * 实际访问路径（可选）
   * 如果设置，VarPicker 生成表达式时使用 path 而非 key
   * 用于 key 与实际访问路径不一致的场景（如嵌套路径 choices[0].message.content）
   */
  path?: string;
}

export interface FlowControlNodeStrategy {
  nodeType: string;
  config: FlowControlNodeConfig;
  initConfig(savedConfig: Record<string, any>): Record<string, any>;
  /** 获取节点描述信息，用于 ConfigPanel 显示 */
  getNodeDescription?(): {
    title?: string;
    description?: string;
  };
  getRequiredFields?(formValues?: Record<string, any>): { type: string; props: Record<string, any> }[];
  getOptionalFields?(formValues?: Record<string, any>): { type: string; props: Record<string, any> }[];
  serializeConfig?(config: Record<string, any>): Record<string, any>;
  deserializeConfig?(config: Record<string, any>): Record<string, any>;
  validateConfig?(config: Record<string, any>): string | null;
  handleConnection?(params: {
    conn: any;
    isAdd: boolean;
    nodeConfigForm?: any;
    store?: any;
  }): void;
  saveConfig?(config: Record<string, any>, store: any): void;
  /**
   * 声明该节点的输出变量，供下游 VarPicker 选择。
   * 返回空数组表示该节点无业务输出（如容器节点、终止节点）。
   * 动态插件节点不经过此方法，由 schema outputs 解析。
   */
  getOutputs?(config: Record<string, any>): NodeOutputDef[];
  /**
   * 序列化 task field items（保存时调用）
   * 允许策略自定义如何将 task field items 转换为 Kestra YAML 结构
   * 用于实现透明容器（如 Sequential）的自动包装逻辑
   */
  serializeTaskFieldItems?(
    field: string,
    items: any[],
    helpers: {
      collectChain: (nodeId: string) => any[];
    },
  ): any[];
  /**
   * 是否显示基本信息区（节点ID/名称/类型），默认 true
   * Start/End 节点等可设置为 false 隐藏基本信息
   */
  showBasicInfo?: boolean;
  /**
   * 专用配置组件（可选）
   * 如果节点需要复杂的自定义 UI，返回对应 Vue 组件
   * 如果返回 null 或未实现，ConfigPanel 会自动回退到通用 FieldRenderer
   */
  getConfigComponent?(): any | null;
  /**
   * 保存前校验（替代 ConfigPanel 中的 ref 校验）
   * 返回 null 表示校验通过，返回字符串表示错误信息
   */
  validateBeforeSave?(config: Record<string, any>): string | null;
}

/**
 * Schema 节点元数据，用于动态创建 SchemaNodeStrategy。
 * 注意：此接口故意使用 any 避免与 useSchemaParser 的循环依赖。
 */
export interface SchemaNodeMeta {
  nodeType: string;
  nodeName: string;
  icon: string;
  description: string;
  formProperties: Record<string, any>;
  formRequired: string[];
  formDefs: Record<string, any>;
  taskFields?: string[];
  /** 输出变量声明，支持条件过滤（condition） */
  outputs?: { key: string; label?: string; type?: string; condition?: string }[];
  /** @deprecated 使用 outputs 字段替代，保留用于向后兼容 */
  outputKeys?: { key: string; label?: string }[];
}
