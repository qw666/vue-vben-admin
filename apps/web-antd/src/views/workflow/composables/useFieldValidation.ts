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

export function validateNodeConfig(node: any, pluginMetaCache: Record<string, any>): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  const strategy = flowControlNodeRegistry.get(node.data.type);
  if (strategy) {
    const requiredFieldKeys = strategy.getRequiredFields();
    const config = node.data.config || {};
    requiredFieldKeys.forEach(field => {
      if (field.props && isEmptyValue(config[field.props.key])) {
        missingFields.push(field.props.label);
      }
    });
    return { isValid: missingFields.length === 0, missingFields };
  }

  const meta = pluginMetaCache[node.data.type];
  if (!meta || !meta.formProperties) {
    return { isValid: true, missingFields };
  }

  const properties = meta.formProperties;
  const formRequired = meta.formRequired || [];
  const config = node.data.config || {};

  Object.keys(properties).forEach(key => {
    if (key === '$schema') return;
    const prop = properties[key];
    const isRequired = prop.$required === true || formRequired.includes(key);
    if (isRequired && isEmptyValue(config[key])) {
      const label = prop.title || key;
      missingFields.push(label);
    }
  });

  return { isValid: missingFields.length === 0, missingFields };
}

export function validateAllNodes(nodes: any[], pluginMetaCache: Record<string, any>): ValidationResult {
  const errors: ValidationResult['errors'] = [];

  nodes.forEach(node => {
    const result = validateNodeConfig(node, pluginMetaCache);
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