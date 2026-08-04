import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';
import { getFlowControlConfig } from '../config/workflow-node-config';

export const SwitchNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_flow_Switch',
  config: {
    nodeType: 'idp_core_flow_Switch',
    nodeName: '分支路由',
    icon: 'mdi:hexagon',
    description: '多条件分支',
    ports: {
      input: 1,
      output: [
        { field: 'cases', label: 'Cases', color: '#3b82f6', dynamic: true, connectionType: 'cases', connectionMode: 'sequential' },
        { field: 'defaults', label: 'Default', color: '#64748b', connectionType: 'list', connectionMode: 'sequential' },
        { field: 'errors', label: 'Errors', color: '#f59e0b', excludeFromBounds: true, connectionType: 'list', connectionMode: 'sequential' },
        { field: 'finally', label: 'Finally', color: '#64748b', excludeFromBounds: true, connectionType: 'list', connectionMode: 'sequential' },
        { field: 'next', label: 'Next', color: '#8b5cf6', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: ['cases', 'defaults', 'errors', 'finally'],
  },
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const deserialized = this.deserializeConfig?.(savedConfig) || savedConfig;
    return {
      value: deserialized.value || '',
      cases: deserialized.cases,
      defaults: deserialized.defaults,
      errors: deserialized.errors,
      finally: deserialized.finally,
      next: deserialized.next,
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    return { ...config };
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    const casesValue = config.cases;
    
    // Helper: deserialize child node config in task items
    function deserializeTaskItems(items: any[]): any[] {
      if (!Array.isArray(items)) return items;
      return items.map(item => {
        if (!item || !item.type) return item;
        // Get the strategy for this child node type
        const strategy = flowControlNodeRegistry.get(item.type);
        if (strategy?.deserializeConfig) {
          // Extract child node config from task item (everything except type, nodeId, label)
          const { type, nodeId, label, ...childConfig } = item;
          const deserializedConfig = strategy.deserializeConfig(childConfig);
          return { type, nodeId, label, ...deserializedConfig };
        }
        return item;
      });
    }
    
    // Process cases - they are objects with case keys mapping to arrays of task items
    let deserializedCases: Record<string, any[]> = {};
    if (typeof casesValue === 'object' && casesValue !== null && !Array.isArray(casesValue)) {
      deserializedCases = {};
      for (const [caseKey, taskItems] of Object.entries(casesValue)) {
        deserializedCases[caseKey] = deserializeTaskItems(taskItems as any[]);
      }
    }
    
    // Process other task fields (defaults, errors, finally)
    const deserializedDefaults = deserializeTaskItems(
      Array.isArray(config.defaults) ? config.defaults : []
    );
    const deserializedErrors = deserializeTaskItems(
      Array.isArray(config.errors) ? config.errors : []
    );
    const deserializedFinally = deserializeTaskItems(
      Array.isArray(config.finally) ? config.finally : []
    );
    const deserializedNext = deserializeTaskItems(
      Array.isArray(config.next) ? config.next : []
    );
    
    return {
      ...config,
      cases: deserializedCases,
      defaults: deserializedDefaults,
      errors: deserializedErrors,
      finally: deserializedFinally,
      next: deserializedNext,
    };
  },

  handleConnection(params: {
    conn: any;
    isAdd: boolean;
    nodeConfigForm?: any;
    store?: any;
  }): void {
    const { conn, isAdd, nodeConfigForm, store } = params;
    const sourceNode = store.currentWorkflow?.nodes.find((n: any) => n.id === conn.source);
    if (!sourceNode) return;

    const flowControlConfig = getFlowControlConfig(sourceNode.data.type);
    if (!flowControlConfig) return;

    const sourceHandle = conn.sourceHandle.replace(`${conn.source}-output-`, '');
    let targetField = sourceHandle;
    let caseKey: string | undefined;
    let connectionType: 'single' | 'list' | 'cases' | undefined;

    if (flowControlConfig.ports.output) {
      const port = flowControlConfig.ports.output.find((p: any) =>
        sourceHandle === p.field || sourceHandle.startsWith(p.field + '-')
      );
      if (port) {
        connectionType = port.connectionType;
        targetField = port.field;
        if (port.dynamic && sourceHandle.startsWith(port.field + '-')) {
          const remaining = sourceHandle.replace(port.field + '-', '');
          if (remaining !== 'add') {
            caseKey = remaining;
          }
        }
      }
    }

    const targetNode = store.currentWorkflow?.nodes.find((n: any) => n.id === conn.target);
    if (!targetNode) return;

    const taskItem = {
      type: targetNode.data.type,
      nodeId: targetNode.id,
      label: targetNode.data.label,
      ...targetNode.data.config,
    };

    if (!sourceNode.data.config) {
      sourceNode.data.config = {};
    }

    if (connectionType === 'cases') {
      const casesObj = sourceNode.data.config[targetField] || {};
      if (!sourceNode.data.config[targetField]) {
        sourceNode.data.config[targetField] = casesObj;
      }

      if (isAdd && !caseKey) {
        const caseCount = Object.keys(casesObj).length + 1;
        const newCaseKey = `CASE_${caseCount}`;
        casesObj[newCaseKey] = [taskItem];
        conn.sourceHandle = `${conn.source}-output-${targetField}-add`;
        if (nodeConfigForm) {
          nodeConfigForm[targetField] = { ...casesObj };
        }
      } else if (isAdd && caseKey) {
        let caseItems = Array.isArray(casesObj[caseKey]) ? [...casesObj[caseKey]] : [];
        const existing = caseItems.find((item: any) => item.nodeId === conn.target);
        if (!existing) {
          caseItems.push(taskItem);
        }
        casesObj[caseKey] = caseItems;
        if (nodeConfigForm) {
          nodeConfigForm[targetField] = { ...casesObj };
        }
      } else if (!isAdd && caseKey) {
        casesObj[caseKey] = casesObj[caseKey].filter(
          (item: any) => item.nodeId !== conn.target
        );
        if (casesObj[caseKey].length === 0) {
          delete casesObj[caseKey];
        }
        if (nodeConfigForm) {
          nodeConfigForm[targetField] = { ...casesObj };
        }
      } else if (!isAdd) {
        const caseKeyToRemove = Object.keys(casesObj).find(key =>
          Array.isArray(casesObj[key]) && casesObj[key].some((item: any) => item.nodeId === conn.target)
        );
        if (caseKeyToRemove) {
          casesObj[caseKeyToRemove] = casesObj[caseKeyToRemove].filter(
            (item: any) => item.nodeId !== conn.target
          );
          if (casesObj[caseKeyToRemove].length === 0) {
            delete casesObj[caseKeyToRemove];
          }
          if (nodeConfigForm) {
            nodeConfigForm[targetField] = { ...casesObj };
          }
        }
      }
    } else if (connectionType === 'list' || connectionType === 'single') {
      if (!Array.isArray(sourceNode.data.config[targetField])) {
        sourceNode.data.config[targetField] = [];
      }
      const configArray = sourceNode.data.config[targetField];

      if (isAdd) {
        const existing = configArray.find((item: any) => item.nodeId === conn.target);
        if (!existing) {
          configArray.push(taskItem);
        }
      } else {
        sourceNode.data.config[targetField] = configArray.filter(
          (item: any) => item.nodeId !== conn.target
        );
      }

      if (nodeConfigForm && sourceNode.data.config) {
        nodeConfigForm[targetField] = [...sourceNode.data.config[targetField]];
      }
    }

    store.updateNode(conn.source, { data: { ...sourceNode.data } });
  },
  getRequiredFields(): { props: Record<string, any>; type: string }[] {
    return [
      {
        type: 'VarPicker',
        props: {
          key: 'value',
          label: '匹配值',
          required: true,
          description: '用于分支匹配判断的表达式/值',
          tooltip: '支持变量选择或手写表达式，输入 / 选择变量',
          dynamic: true,
        },
      },
    ];
  },
  getOptionalFields(): { props: Record<string, any>; type: string }[] {
    return [
      {
        type: 'SwitchCases',
        props: {
          key: 'cases',
          label: 'Cases',
          required: false,
          description: '匹配键与对应执行任务列表映射',
          tooltip: '',
          dynamic: false,
        },
      },
      {
        type: 'ConnectionStatus',
        props: {
          key: 'defaults',
          label: 'Default',
          required: false,
          description: '无任何case匹配时执行的默认任务列表',
          tooltip: '',
          dynamic: false,
        },
      },
      {
        type: 'ConnectionStatus',
        props: {
          key: 'errors',
          label: 'Errors',
          required: false,
          description: '当前分支任务出现异常时执行的任务列表',
          tooltip: '',
          dynamic: false,
        },
      },
      {
        type: 'ConnectionStatus',
        props: {
          key: 'finally',
          label: 'Finally',
          required: false,
          description: '所有分支执行完成后执行的收尾任务',
          tooltip: '',
          dynamic: false,
        },
      },
    ];
  },
};

flowControlNodeRegistry.register(SwitchNodeStrategy);
