import type {
  FlowControlNodeConfig,
  FlowControlNodeStrategy,
  FrontendNodeGroup,
  NodeOutputDef,
  SchemaNodeMeta,
} from './nodeTypes';
import { nodeConfigComponentRegistry } from './NodeConfigComponentRegistry';
import { SchemaStrategyLoader } from './SchemaStrategyLoader';

class FlowControlNodeRegistry {
  private strategies: Map<string, FlowControlNodeStrategy> = new Map();
  private defaultStrategy: FlowControlNodeStrategy | null = null;
  private schemaLoader = new SchemaStrategyLoader();
  private nodeConfigComponentRegistry = nodeConfigComponentRegistry;

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
    this.schemaLoader.registerMeta(meta);
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
    if (this.hasStrategy(nodeType)) return;
    await this.schemaLoader.ensureLoaded(nodeType, loadMeta);
  }

  get(nodeType: string): FlowControlNodeStrategy | null {
    // 1. 优先返回硬编码策略
    const hardcoded = this.strategies.get(nodeType);
    if (hardcoded) return hardcoded;

    // 2. 如果有 Schema 元数据，返回创建/缓存的 SchemaNodeStrategy
    const schemaStrategy = this.schemaLoader.getStrategy(nodeType);
    if (schemaStrategy) return schemaStrategy;

    // 3. 返回默认策略（可能为 null，由调用方处理）
    return this.defaultStrategy;
  }

  getAll(): FlowControlNodeStrategy[] {
    const all: FlowControlNodeStrategy[] = Array.from(this.strategies.values());
    this.schemaLoader.getAllStrategies().forEach(s => all.push(s));
    return all;
  }

  /**
   * 判断节点是否是流控容器节点（有 taskFields，如 Switch/If/ForEach/Parallel）。
   * 用于：连线管理、拖拽判断、端口计算、配置面板、序列化等场景。
   */
  isFlowControlContainer(nodeType: string): boolean {
    const strategy = this.get(nodeType);
    if (!strategy) return false;
    const taskFields = strategy.config.taskFields || [];
    return taskFields.length > 0;
  }

  /**
   * 判断节点是否实现了 getOutputs 方法（有可声明的输出变量）。
   * 用于：变量收集、VarPicker 数据源等场景。
   */
  hasNodeOutputs(nodeType: string): boolean {
    const strategy = this.get(nodeType);
    if (!strategy) return false;
    return !!strategy.getOutputs;
  }

  /**
   * 获取节点分类。
   * 用于：ConfigPanel 渲染判断等场景。
   */
  getCategory(nodeType: string): string | undefined {
    const strategy = this.get(nodeType);
    if (!strategy) return undefined;
    return strategy.config.category;
  }

  /**
   * 判断节点是否属于指定分类。
   * 用于：ConfigPanel 渲染判断等场景。
   * 当 category 未设置时，回退到节点类型名称匹配（兼容 Schema 动态节点）。
   */
  isCategory(nodeType: string, category: string): boolean {
    const configCategory = this.getCategory(nodeType);
    if (configCategory) {
      return configCategory === category;
    }
    // Fallback: 根据节点类型名称匹配（兼容 Schema 动态节点）
    const typeLower = nodeType.toLowerCase();
    switch (category) {
      case 'http':
        return typeLower.includes('http') || typeLower.includes('request');
      case 'code':
        return typeLower.includes('python') || typeLower.includes('code') || typeLower.includes('script');
      case 'start':
        return typeLower.includes('start');
      case 'end':
        return typeLower.includes('end');
      case 'flow':
        return typeLower.includes('switch') || typeLower.includes('if') || typeLower.includes('foreach') || typeLower.includes('parallel');
      case 'output':
        return typeLower.includes('output');
      default:
        return false;
    }
  }

  /**
   * 获取节点描述信息，用于 ConfigPanel 显示。
   * 优先使用策略的 getNodeDescription，回退到 config 中的 description。
   */
  getNodeDescription(nodeType: string): { title?: string; description?: string } {
    const strategy = this.get(nodeType);
    if (!strategy) return { title: '未知节点' };
    const desc = strategy.getNodeDescription?.();
    if (desc) return desc;
    return {
      title: strategy.config.nodeName,
      description: strategy.config.description,
    };
  }

  /**
   * 判断节点是否显示基本信息区（节点ID/名称/类型）
   * 默认返回 true，Start/End 节点等可设置为 false
   */
  getShowBasicInfo(nodeType: string): boolean {
    const strategy = this.get(nodeType);
    if (!strategy) return true;
    // 如果策略显式设置了 showBasicInfo，使用策略的值
    if (strategy.showBasicInfo !== undefined) {
      return strategy.showBasicInfo;
    }
    // 默认：Start/End 节点不显示基本信息
    const category = strategy.config.category;
    if (category === 'start' || category === 'end') {
      return false;
    }
    return true;
  }

  /**
   * 获取节点的专用配置组件
   * 查询顺序：1. 节点策略的 getConfigComponent() 2. 配置组件注册表
   * 未找到返回 null，ConfigPanel 会回退到通用 FieldRenderer
   */
  getConfigComponent(nodeType: string): any | null {
    // 1. 优先从策略获取
    const strategy = this.get(nodeType);
    if (strategy?.getConfigComponent) {
      const component = strategy.getConfigComponent();
      if (component) return component;
    }
    // 2. 回退到配置组件注册表
    return this.nodeConfigComponentRegistry?.get(nodeType) || null;
  }

  /**
   * 保存前校验（统一入口）
   * 如果策略实现了 validateBeforeSave，调用它
   * 否则返回 null（校验通过）
   */
  validateBeforeSave(nodeType: string, config: Record<string, any>): string | null {
    const strategy = this.get(nodeType);
    if (strategy?.validateBeforeSave) {
      return strategy.validateBeforeSave(config);
    }
    return null;
  }

  /**
   * 获取节点必填项字段列表（用于全流程校验）。
   */
  getRequiredFieldLabels(nodeType: string): string[] {
    const strategy = this.get(nodeType);
    const fields = strategy?.getRequiredFields?.() || [];
    return fields
      .filter(f => f.props?.label)
      .map(f => f.props.label);
  }

  /**
   * 判断节点类型是否有策略（硬编码或 Schema 适配器）。
   * 用于区分：有前端策略的节点 vs 无任何策略的节点。
   */
  hasStrategy(nodeType: string): boolean {
    return this.strategies.has(nodeType) || this.schemaLoader.hasMeta(nodeType);
  }

  /**
   * 判断节点是否是纯 Schema 驱动的节点（无硬编码策略）。
   */
  isSchemaNode(nodeType: string): boolean {
    return !this.strategies.has(nodeType) && this.schemaLoader.hasMeta(nodeType);
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
    return this.get(nodeType)?.config || {} as FlowControlNodeConfig;
  }

  getTaskFields(nodeType: string): string[] {
    return this.get(nodeType)?.config.taskFields || [];
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

export { FlowControlNodeRegistry };
