/**
 * 条件评估工具函数
 * 用于评估节点输出变量的条件表达式，判断该变量是否应该可见。
 */

/**
 * 评估条件表达式，判断输出变量是否可用。
 * 支持的格式：
 * - "field == 'value'" 或 'field == "value"'：字段等于指定值
 * - "field in ['v1', 'v2']" 或 'field in ["v1", "v2"]'：字段在指定值列表中
 * - 无 condition 或空字符串：总是返回 true
 *
 * @param condition 条件表达式字符串
 * @param config 节点配置对象
 * @returns 条件是否满足
 */
export function evalCondition(condition: string | undefined, config: Record<string, any>): boolean {
  if (!condition || !condition.trim()) return true;

  const cond = condition.trim();

  // 匹配 "field == 'value'" 或 'field == "value"' 格式
  const eqMatch = cond.match(/^(\w+)\s*==\s*['"]([^'"]*)['"]$/);
  if (eqMatch && eqMatch[1]) {
    const field = eqMatch[1];
    const value = eqMatch[2] || '';
    return String(config[field] ?? '') === value;
  }

  // 匹配 "field in ['v1', 'v2']" 或 'field in ["v1", "v2"]' 格式
  const inMatch = cond.match(/^(\w+)\s+in\s*\[([^\]]*)\]$/);
  if (inMatch && inMatch[1]) {
    const field = inMatch[1];
    const valuesStr = inMatch[2] || '';
    const values = valuesStr.match(/['"]([^'"]*)['"]/g)?.map((s) => s.slice(1, -1)) || [];
    return values.includes(String(config[field] ?? ''));
  }

  // 未知格式，默认显示
  return true;
}
