import type { Component } from 'vue';

export interface TriggerConfigComponent {
  type: string;
  label: string;
  component: Component;
  fieldLabels?: Record<string, { label: string; tooltip: string }>;
}

const triggerConfigRegistry: TriggerConfigComponent[] = [];

export function registerTriggerConfig(config: TriggerConfigComponent): void {
  const existing = triggerConfigRegistry.find((c) => c.type === config.type);
  if (!existing) {
    triggerConfigRegistry.push(config);
  }
}

export function getTriggerConfig(type: string): TriggerConfigComponent | undefined {
  return triggerConfigRegistry.find((c) => c.type === type);
}

export function getAllTriggerConfigs(): TriggerConfigComponent[] {
  return [...triggerConfigRegistry];
}

export function getFrontendTriggerTypes(): string[] {
  return triggerConfigRegistry.map((c) => c.type);
}

export function isFrontendTrigger(type: string): boolean {
  return triggerConfigRegistry.some((c) => c.type === type);
}