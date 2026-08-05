export type ConnectionType = 'single' | 'list' | 'cases';
export type ConnectionMode = 'parallel' | 'sequential';

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
  getRequiredFields(): { type: string; props: Record<string, any> }[];
  getOptionalFields(): { type: string; props: Record<string, any> }[];
  serializeConfig?(config: Record<string, any>): Record<string, any>;
  deserializeConfig?(config: Record<string, any>): Record<string, any>;
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

class FlowControlNodeRegistry {
  private strategies: Map<string, FlowControlNodeStrategy> = new Map();
  private defaultStrategy: FlowControlNodeStrategy | null = null;

  register(strategy: FlowControlNodeStrategy): void {
    if (strategy.nodeType === 'default') {
      this.defaultStrategy = strategy;
    }
    this.strategies.set(strategy.nodeType, strategy);
  }

  get(nodeType: string): FlowControlNodeStrategy {
    return this.strategies.get(nodeType) || this.defaultStrategy!;
  }

  getAll(): FlowControlNodeStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 判断节点是否是流控容器节点（有 taskFields，如 Switch/If/ForEach/Parallel）。
   * 用于：连线管理、拖拽判断、端口计算、配置面板、序列化等场景。
   */
  isFlowControlContainer(nodeType: string): boolean {
    const strategy = this.strategies.get(nodeType);
    if (!strategy) return false;
    const taskFields = strategy.config.taskFields || [];
    return taskFields.length > 0;
  }

  /**
   * 判断节点是否实现了 getOutputs 方法（有可声明的输出变量）。
   * 用于：变量收集、VarPicker 数据源等场景。
   */
  hasNodeOutputs(nodeType: string): boolean {
    const strategy = this.strategies.get(nodeType);
    return !!strategy?.getOutputs;
  }

  /**
   * 判断节点类型是否在 registry 中注册了策略（不含 default fallback）。
   * 用于区分：有前端策略的节点 vs 纯动态插件节点。
   * 避免使用 get() 导致 default strategy 干扰判断。
   */
  hasStrategy(nodeType: string): boolean {
    return this.strategies.has(nodeType);
  }

  /**
   * @deprecated Use isFlowControlContainer() instead.
   * 保留为兼容层，避免影响现有调用。
   */
  isFlowControlNode(nodeType: string): boolean {
    return this.isFlowControlContainer(nodeType);
  }

  getFlowControlNodes(): { type: string; nodeName: string; icon: string; description: string }[] {
    return Array.from(this.strategies.entries())
      .filter(([type]) => type !== 'default')
      .map(([type, strategy]) => ({
        type,
        nodeName: strategy.config.nodeName,
        icon: strategy.config.icon,
        description: strategy.config.description,
      }));
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
   * 动态插件节点不走此方法，应在调用方另行从 schema 解析。
   */
  getOutputs(nodeType: string, config: Record<string, any>): NodeOutputDef[] {
    const strategy = this.strategies.get(nodeType);
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
