import type { WorkflowNode } from '#/types/workflow';

// ===== 表达式反解析工具 =====

const SINGLE_VAR_PATTERN = /^\s*\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}\s*$/;

export interface ParsedVarRef {
  expression: string;
  segments: string[];
}

export function tryParseVarRef(expression: string): ParsedVarRef | null {
  if (!expression) return null;
  const match = expression.match(SINGLE_VAR_PATTERN);
  if (!match || match[1] === undefined) return null;
  const path = match[1];
  const segments = path.split('.');
  if (segments.length < 2) return null;
  return { expression, segments };
}

export function isSingleVarRef(expression: string): boolean {
  return SINGLE_VAR_PATTERN.test(expression);
}

// ===== 引用重构 =====

function rewriteExprString(input: string, oldId: string, newId: string): string {
  if (!input || typeof input !== 'string') return input;
  const pattern = new RegExp(`outputs\\.${escapeRegExp(oldId)}\\.`, 'g');
  return input.replace(pattern, `outputs.${newId}.`);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rewriteVarReferences(
  obj: any,
  oldNodeId: string,
  newNodeId: string,
): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return rewriteExprString(obj, oldNodeId, newNodeId);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => rewriteVarReferences(item, oldNodeId, newNodeId));
  }
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      result[key] = rewriteVarReferences(obj[key], oldNodeId, newNodeId);
    }
    return result;
  }
  return obj;
}

export function countNodeReferences(
  nodes: WorkflowNode[],
  nodeId: string,
): number {
  const pattern = new RegExp(`outputs\\.${escapeRegExp(nodeId)}\\.`);
  let count = 0;
  const walk = (val: any) => {
    if (val === null || val === undefined) return;
    if (typeof val === 'string') {
      if (pattern.test(val)) count++;
      return;
    }
    if (Array.isArray(val)) {
      val.forEach(walk);
      return;
    }
    if (typeof val === 'object') {
      for (const k of Object.keys(val)) walk(val[k]);
    }
  };
  nodes.forEach((n) => {
    if (n.id === nodeId) return;
    walk(n.data?.config);
  });
  return count;
}
