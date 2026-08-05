import { flowControlNodeRegistry } from '../config/workflow-node-config';

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    nodeId: string;
    nodeLabel: string;
    missingFields: string[];
  }>;
}

function isEmptyValue(value: any): boolean {
  if (value === '' || value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
    return true;
  }
  return false;
}

/**
 * 统一校验节点配置。
 * 所有节点都通过策略的 getRequiredFields 获取必填项，不再需要 pluginMetaCache。
 */
export function validateNodeConfig(node: any): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!node.data.label || !node.data.label.trim()) {
    missingFields.push('节点名称');
  }

  const nodeType = node.data.type;
  const strategy = flowControlNodeRegistry.get(nodeType);
  const config = node.data.config || {};

  // 1. 检查必填字段是否为空
  const requiredFields = strategy.getRequiredFields?.() || [];
  requiredFields.forEach(field => {
    if (field.props) {
      const fieldValue = config[field.props.key];
      // ArrayTable 字段允许空数组（用户可以选择不配置任何项）
      const isArrayTableField = field.type === 'ArrayTable';
      if (isArrayTableField) {
        if (fieldValue === undefined || fieldValue === null || 
            (Array.isArray(fieldValue) && fieldValue.length === 0)) {
          return;
        }
      }
      if (isEmptyValue(fieldValue)) {
        missingFields.push(field.props.label);
      }
    }
  });

  // 2. 如果策略有 validateConfig，也调用它
  if (strategy.validateConfig) {
    const error = strategy.validateConfig(config);
    if (error) {
      // 尝试从错误消息中提取字段名
      missingFields.push(error);
    }
  }

  return { isValid: missingFields.length === 0, missingFields };
}

export function validateAllNodes(nodes: any[]): ValidationResult {
  const errors: ValidationResult['errors'] = [];

  nodes.forEach(node => {
    const result = validateNodeConfig(node);
    if (!result.isValid) {
      errors.push({
        nodeId: node.id,
        nodeLabel: node.data.label || node.id,
        missingFields: result.missingFields,
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
