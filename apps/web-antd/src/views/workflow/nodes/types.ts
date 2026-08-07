export type ConnectionType = 'single' | 'list' | 'cases';
export type ConnectionMode = 'parallel' | 'sequential';

/** 前端节点分组标识（与后端 groupKey 对齐） */
export type FrontendNodeGroup =
  | 'flowControl' // 流程控制
  | 'tools' // 工具
  | 'hidden'; // 不在面板显示

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
  ports: {
    input?: number;
    output?: WorkflowNodePort[];
  };
  taskFields?: string[];
}

export interface NodeOutputDef {
  /** 输出 key，对应 Kestra 表达式 outputs.<nodeId>.<key> 的最后一段 */
  key: string;
  /** 显示名，默认与 key 相同 */
  label?: string;
  /** 类型提示，默认 any */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
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

class FlowControlNodeRegistry {
  private strategies: Map<string, FlowControlNodeStrategy> = new Map();
  private defaultStrategy: FlowControlNodeStrategy | null = null;
  private schemaMetaCache: Map<string, SchemaNodeMeta> = new Map();
  // 使用 FlowControlNodeStrategy 类型避免直接导入 SchemaNodeStrategy
  private schemaStrategyCache: Map<string, FlowControlNodeStrategy> = new Map();
  // 缓存 SchemaNodeStrategy 类，动态导入以避免循环依赖
  private schemaStrategyClass: any = null;

  /** 异步加载 SchemaNodeStrategy 类 */
  private async loadSchemaStrategyClass(): Promise<any> {
    if (!this.schemaStrategyClass) {
      const mod = await import('./SchemaNodeStrategy');
      this.schemaStrategyClass = mod.SchemaNodeStrategy;
    }
    return this.schemaStrategyClass;
  }

  /** 同步获取 SchemaNodeStrategy 类（需确保已异步加载过） */
  private getSchemaStrategyClass(): any {
    return this.schemaStrategyClass;
  }

  register(strategy: FlowControlNodeStrategy): void {
    if (strategy.nodeType === 'default') {
      this.defaultStrategy = strategy;
    }
    this.strategies.set(strategy.nodeType, strategy);
  }

  /**
   * 注册 Schema 节点元数据，用于动态创建 SchemaNodeStrategy。
   * 当调用 get() 时，如果该节点类型没有硬编码策略但有 Schema 元数据，
   * 会自动创建 SchemaNodeStrategy 并缓存。
   */
  registerSchemaMeta(meta: SchemaNodeMeta): void {
    this.schemaMetaCache.set(meta.nodeType, meta);
    // 清除缓存的策略实例，强制重新创建
    this.schemaStrategyCache.delete(meta.nodeType);
    // 确保 SchemaNodeStrategy 类已加载
    this.loadSchemaStrategyClass().catch(() => {});
  }

  /**
   * 确保节点类型有对应的策略。
   * 如果是 Schema 驱动的节点，会自动加载并注册元数据。
   * @param nodeType 节点类型
   * @param loadMeta 异步加载元数据的函数
   */
  async ensureStrategy(
    nodeType: string,
    loadMeta: (type: string) => Promise<any>,
  ): Promise<void> {
    // 如果已经有策略（硬编码或 Schema），直接返回
    if (this.hasStrategy(nodeType)) return;

    // 异步加载 Schema 元数据
    try {
      const meta = await loadMeta(nodeType);
      if (meta && meta.formProperties) {
        const schemaMeta: SchemaNodeMeta = {
          nodeType,
          nodeName: meta.nodeName || nodeType,
          icon: meta.icon || 'mdi:cube-outline',
          description: meta.description || '',
          formProperties: meta.formProperties as any,
          formRequired: meta.formRequired || [],
          formDefs: meta.formDefs || {},
        };
        this.registerSchemaMeta(schemaMeta);
      }
    } catch {
      // 加载失败，使用默认策略
    }
  }

  get(nodeType: string): FlowControlNodeStrategy {
    // 1. 优先返回硬编码策略
    const hardcoded = this.strategies.get(nodeType);
    if (hardcoded) return hardcoded;

    // 2. 如果有 Schema 元数据，创建或返回缓存的 SchemaNodeStrategy
    const schemaMeta = this.schemaMetaCache.get(nodeType);
    if (schemaMeta) {
      const schemaStrategy = this.schemaStrategyCache.get(nodeType);
      if (schemaStrategy) {
        return schemaStrategy;
      }
      // SchemaNodeStrategy 类可能还在加载中，此时返回默认策略
      const SchemaStrategyClass = this.getSchemaStrategyClass();
      if (SchemaStrategyClass) {
        const newStrategy = new SchemaStrategyClass(schemaMeta);
        this.schemaStrategyCache.set(nodeType, newStrategy);
        return newStrategy;
      }
      // 触发异步加载，下次调用 get() 时就能使用
      this.loadSchemaStrategyClass().catch(() => {});
    }

    // 3. 返回默认策略
    return this.defaultStrategy!;
  }

  getAll(): FlowControlNodeStrategy[] {
    const all: FlowControlNodeStrategy[] = Array.from(this.strategies.values());
    this.schemaStrategyCache.forEach(s => all.push(s));
    return all;
  }

  /**
   * 判断节点是否是流控容器节点（有 taskFields，如 Switch/If/ForEach/Parallel）。
   * 用于：连线管理、拖拽判断、端口计算、配置面板、序列化等场景。
   */
  isFlowControlContainer(nodeType: string): boolean {
    const strategy = this.get(nodeType);
    const taskFields = strategy.config.taskFields || [];
    return taskFields.length > 0;
  }

  /**
   * 判断节点是否实现了 getOutputs 方法（有可声明的输出变量）。
   * 用于：变量收集、VarPicker 数据源等场景。
   */
  hasNodeOutputs(nodeType: string): boolean {
    const strategy = this.get(nodeType);
    return !!strategy.getOutputs;
  }

  /**
   * 获取节点描述信息，用于 ConfigPanel 显示。
   * 优先使用策略的 getNodeDescription，回退到 config 中的 description。
   */
  getNodeDescription(nodeType: string): { title?: string; description?: string } {
    const strategy = this.get(nodeType);
    const desc = strategy.getNodeDescription?.();
    if (desc) return desc;
    return {
      title: strategy.config.nodeName,
      description: strategy.config.description,
    };
  }

  /**
   * 获取节点必填项字段列表（用于全流程校验）。
   */
  getRequiredFieldLabels(nodeType: string): string[] {
    const strategy = this.get(nodeType);
    const fields = strategy.getRequiredFields?.() || [];
    return fields
      .filter(f => f.props?.label)
      .map(f => f.props.label);
  }

  /**
   * 判断节点类型是否有策略（硬编码或 Schema 适配器）。
   * 用于区分：有前端策略的节点 vs 无任何策略的节点。
   */
  hasStrategy(nodeType: string): boolean {
    return this.strategies.has(nodeType) || this.schemaMetaCache.has(nodeType);
  }

  /**
   * 判断节点是否是纯 Schema 驱动的节点（无硬编码策略）。
   */
  isSchemaNode(nodeType: string): boolean {
    return !this.strategies.has(nodeType) && this.schemaMetaCache.has(nodeType);
  }

  /**
   * @deprecated Use isFlowControlContainer() instead.
   * 保留为兼容层，避免影响现有调用。
   */
  isFlowControlNode(nodeType: string): boolean {
    return this.isFlowControlContainer(nodeType);
  }

  getFlowControlNodes(): { type: string; nodeName: string; icon: string; description: string }[] {
    const result: { type: string; nodeName: string; icon: string; description: string }[] = [];
    this.strategies.forEach((strategy, type) => {
      if (type !== 'default') {
        result.push({
          type,
          nodeName: strategy.config.nodeName,
          icon: strategy.config.icon,
          description: strategy.config.description,
        });
      }
    });
    return result;
  }

  /**
   * 获取前端维护的所有节点（含分组信息）
   */
  getFrontendNodes(): Array<{
    type: string;
    nodeName: string;
    icon: string;
    description: string;
    group: FrontendNodeGroup;
  }> {
    const result: Array<{
      type: string;
      nodeName: string;
      icon: string;
      description: string;
      group: FrontendNodeGroup;
    }> = [];
    this.strategies.forEach((strategy, type) => {
      if (type !== 'default') {
        result.push({
          type,
          nodeName: strategy.config.nodeName,
          icon: strategy.config.icon,
          description: strategy.config.description,
          group: strategy.config.group || 'tools',
        });
      }
    });
    return result;
  }

  /**
   * 获取前端节点（排除 hidden 分组）
   */
  getVisibleFrontendNodes(): Array<{
    type: string;
    nodeName: string;
    icon: string;
    description: string;
    group: FrontendNodeGroup;
  }> {
    return this.getFrontendNodes().filter((n) => n.group !== 'hidden');
  }

  getConfig(nodeType: string): FlowControlNodeConfig {
    return this.get(nodeType).config;
  }

  getTaskFields(nodeType: string): string[] {
    return this.get(nodeType).config.taskFields || [];
  }

  serializeConfig(nodeType: string, config: Record<string, any>): Record<string, any> {
    const strategy = this.get(nodeType);
    if (strategy?.serializeConfig) {
      return strategy.serializeConfig(config);
    }
    return config;
  }

  deserializeConfig(nodeType: string, config: Record<string, any>): Record<string, any> {
    const strategy = this.get(nodeType);
    if (strategy?.deserializeConfig) {
      return strategy.deserializeConfig(config);
    }
    return config;
  }

  handleConnection(nodeType: string, params: {
    conn: any;
    isAdd: boolean;
    nodeConfigForm?: any;
    store?: any;
  }): void {
    const strategy = this.get(nodeType);
    if (strategy?.handleConnection) {
      strategy.handleConnection(params);
    }
  }

  saveConfig(nodeType: string, config: Record<string, any>, store: any): void {
    const strategy = this.get(nodeType);
    if (strategy?.saveConfig) {
      strategy.saveConfig(config, store);
    }
  }

  /**
   * 获取节点声明的输出。未实现 getOutputs 的节点返回空数组。
   */
  getOutputs(nodeType: string, config: Record<string, any>): NodeOutputDef[] {
    const strategy = this.get(nodeType);
    if (!strategy?.getOutputs) return [];
    try {
      return strategy.getOutputs(config || {}) || [];
    } catch {
      return [];
    }
  }
}

export const flowControlNodeRegistry = new FlowControlNodeRegistry();

export function mapTaskField<T>(
  fieldValue: any,
  callback: (item: any, caseKey?: string) => T,
): T[] | Record<string, T[]> | undefined {
  if (Array.isArray(fieldValue)) {
    return fieldValue.map((item) => callback(item));
  } else if (typeof fieldValue === 'object' && fieldValue !== null) {
    const result: Record<string, T[]> = {};
    for (const caseKey of Object.keys(fieldValue)) {
      const caseItems = fieldValue[caseKey];
      if (Array.isArray(caseItems)) {
        result[caseKey] = caseItems.map((item) => callback(item, caseKey));
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return undefined;
}

export function filterTaskField(
  fieldValue: any,
  predicate: (item: any, caseKey?: string) => boolean,
): any[] | Record<string, any[]> | undefined {
  if (Array.isArray(fieldValue)) {
    return fieldValue.filter((item) => predicate(item));
  } else if (typeof fieldValue === 'object' && fieldValue !== null) {
    const result: Record<string, any[]> = {};
    for (const caseKey of Object.keys(fieldValue)) {
      const caseItems = fieldValue[caseKey];
      if (Array.isArray(caseItems)) {
        result[caseKey] = caseItems.filter((item) => predicate(item, caseKey));
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return undefined;
}

export function forEachTaskField(
  fieldValue: any,
  callback: (item: any, caseKey?: string) => void,
): void {
  if (Array.isArray(fieldValue)) {
    fieldValue.forEach((item) => callback(item));
  } else if (typeof fieldValue === 'object' && fieldValue !== null) {
    for (const caseKey of Object.keys(fieldValue)) {
      const caseItems = fieldValue[caseKey];
      if (Array.isArray(caseItems)) {
        caseItems.forEach((item) => callback(item, caseKey));
      }
    }
  }
}

export function findTaskField(
  fieldValue: any,
  predicate: (item: any, caseKey?: string) => boolean,
): any | undefined {
  if (Array.isArray(fieldValue)) {
    return fieldValue.find((item) => predicate(item));
  } else if (typeof fieldValue === 'object' && fieldValue !== null) {
    for (const caseKey of Object.keys(fieldValue)) {
      const caseItems = fieldValue[caseKey];
      if (Array.isArray(caseItems)) {
        const found = caseItems.find((item) => predicate(item, caseKey));
        if (found) return found;
      }
    }
  }
  return undefined;
}
