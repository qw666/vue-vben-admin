import type {
  FlowControlNodeStrategy,
  SchemaNodeMeta,
} from './nodeTypes';

/**
 * SchemaStrategyLoader 负责动态 Schema 节点的元数据缓存和策略实例化。
 *
 * 职责：
 *  - 缓存 SchemaNodeMeta（由插件元数据注册）
 *  - 按需懒加载 SchemaNodeStrategy 类（动态 import 避免循环依赖）
 *  - 为每个 schema 节点类型创建并缓存 SchemaNodeStrategy 实例
 *
 * 与 FlowControlNodeRegistry 的关系：
 *  - Registry 持有硬编码策略和默认策略
 *  - Loader 持有 Schema 驱动策略
 *  - Registry 在 get()/getAll() 中组合两者
 */
class SchemaStrategyLoader {
  /** Schema 节点元数据缓存 */
  private metaCache: Map<string, SchemaNodeMeta> = new Map();
  /** Schema 节点策略实例缓存 */
  private strategyCache: Map<string, FlowControlNodeStrategy> = new Map();
  /** 懒加载的 SchemaNodeStrategy 类 */
  private strategyClass: any = null;

  /**
   * 注册 Schema 节点元数据。
   * 注册后会清除对应的缓存策略实例，强制下次 get() 时重新创建。
   */
  registerMeta(meta: SchemaNodeMeta): void {
    this.metaCache.set(meta.nodeType, meta);
    this.strategyCache.delete(meta.nodeType);
    this.loadStrategyClass().catch(() => {});
  }

  /**
   * 判断节点类型是否有注册的 Schema 元数据。
   */
  hasMeta(nodeType: string): boolean {
    return this.metaCache.has(nodeType);
  }

  /**
   * 异步确保 Schema 节点策略已加载。
   * 如果节点类型尚未有 Schema 元数据，会调用 loadMeta 加载并注册。
   */
  async ensureLoaded(
    nodeType: string,
    loadMeta: (type: string) => Promise<any>,
  ): Promise<void> {
    if (this.hasMeta(nodeType)) return;

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
        this.registerMeta(schemaMeta);
      }
    } catch {
      // 加载失败，使用默认策略
    }
  }

  /**
   * 获取 Schema 节点的策略实例。
   * 如果策略类尚未加载完成，返回 null（调用方应回退到默认策略）。
   */
  getStrategy(nodeType: string): FlowControlNodeStrategy | null {
    const meta = this.metaCache.get(nodeType);
    if (!meta) return null;

    const cached = this.strategyCache.get(nodeType);
    if (cached) return cached;

    const Class = this.getStrategyClass();
    if (Class) {
      const strategy = new Class(meta);
      this.strategyCache.set(nodeType, strategy);
      return strategy;
    }

    // 触发异步加载，下次调用 getStrategy() 时就能使用
    this.loadStrategyClass().catch(() => {});
    return null;
  }

  /**
   * 收集所有已创建的 Schema 策略实例。
   */
  getAllStrategies(): FlowControlNodeStrategy[] {
    return Array.from(this.strategyCache.values());
  }

  /** 异步加载 SchemaNodeStrategy 类 */
  private async loadStrategyClass(): Promise<any> {
    if (!this.strategyClass) {
      const mod = await import('./SchemaNodeStrategy');
      this.strategyClass = mod.SchemaNodeStrategy;
    }
    return this.strategyClass;
  }

  /** 同步获取 SchemaNodeStrategy 类（需确保已异步加载过） */
  private getStrategyClass(): any {
    return this.strategyClass;
  }
}

export { SchemaStrategyLoader };
