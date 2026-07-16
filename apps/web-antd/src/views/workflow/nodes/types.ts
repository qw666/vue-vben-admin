export interface WorkflowNodePort {
  field: string;
  label: string;
  color: string;
  dynamic?: boolean;
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

export interface FlowControlNodeStrategy {
  nodeType: string;
  config: FlowControlNodeConfig;
  initConfig(savedConfig: Record<string, any>): Record<string, any>;
  getRequiredFields(): { type: string; props: Record<string, any> }[];
  getOptionalFields(): { type: string; props: Record<string, any> }[];
}

class FlowControlNodeRegistry {
  private strategies: Map<string, FlowControlNodeStrategy> = new Map();

  register(strategy: FlowControlNodeStrategy): void {
    this.strategies.set(strategy.nodeType, strategy);
  }

  get(nodeType: string): FlowControlNodeStrategy | undefined {
    return this.strategies.get(nodeType);
  }

  getAll(): FlowControlNodeStrategy[] {
    return Array.from(this.strategies.values());
  }

  isFlowControlNode(nodeType: string): boolean {
    return this.strategies.has(nodeType);
  }

  getFlowControlNodes(): { type: string; nodeName: string; icon: string; description: string }[] {
    return Array.from(this.strategies.entries()).map(([type, strategy]) => ({
      type,
      nodeName: strategy.config.nodeName,
      icon: strategy.config.icon,
      description: strategy.config.description,
    }));
  }

  getConfig(nodeType: string): FlowControlNodeConfig | undefined {
    return this.strategies.get(nodeType)?.config;
  }

  getTaskFields(nodeType: string): string[] {
    return this.strategies.get(nodeType)?.config.taskFields || [];
  }
}

export const flowControlNodeRegistry = new FlowControlNodeRegistry();
