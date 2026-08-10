/**
 * NodeConfigComponentRegistry: 配置组件注册表
 * 
 * 职责：管理 nodeType → ConfigComponent 的映射
 * 
 * 设计原则：
 * - 与节点策略注册表解耦：策略负责行为逻辑（序列化、校验、输出声明），
 *   注册表负责展示逻辑（配置组件映射）
 * - 支持动态节点：未注册的节点自动回退到通用 FieldRenderer
 * 
 * 使用场景：
 * - ConfigPanel 渲染时查询配置组件
 * - NodeConfigRenderer 动态选择渲染方式
 */

export class NodeConfigComponentRegistry {
  private registry = new Map<string, any>();

  /**
   * 注册配置组件
   * @param nodeType 节点类型（如 'idp_core_http_Request'）
   * @param component Vue 组件引用
   */
  register(nodeType: string, component: any): void {
    this.registry.set(nodeType, component);
  }

  /**
   * 获取配置组件
   * @param nodeType 节点类型
   * @returns 组件引用，未注册返回 null
   */
  get(nodeType: string): any | null {
    return this.registry.get(nodeType) || null;
  }

  /**
   * 判断节点是否有专用配置组件
   * @param nodeType 节点类型
   */
  has(nodeType: string): boolean {
    return this.registry.has(nodeType);
  }
}

/** 全局配置组件注册表实例 */
export const nodeConfigComponentRegistry = new NodeConfigComponentRegistry();
