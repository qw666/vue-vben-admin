/**
 * Task field utilities for iterating over flow control container fields.
 *
 * Flow control containers (Switch, If, ForEach, Parallel) have task fields
 * that contain either an array of items or an object keyed by case key
 * (e.g., { CASE_1: [...], CASE_2: [...] }).
 *
 * These helpers abstract over both shapes.
 */

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
