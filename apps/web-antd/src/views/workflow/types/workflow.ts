import type { WorkflowNode, WorkflowEdge } from '#/types/workflow';

export interface NodePort {
  id: string;
  nodeId: string;
  type: 'input' | 'output';
  label?: string;
  position: { x: number; y: number };
  color?: string;
  portGroup?: string;
}

export interface GroupBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasTransform {
  panX: number;
  panY: number;
  scale: number;
}

export interface TempLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Connection extends WorkflowEdge {
  sourceHandle: string;
  targetHandle: string;
}

export interface TaskItem {
  type: string;
  nodeId: string;
  label: string;
  [key: string]: any;
}

export interface NodeConfigForm {
  [key: string]: any;
}

export interface SelectedNode {
  value: WorkflowNode | null;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuItem {
  label: string;
  action: () => void;
}

export interface ContextMenuState {
  visible: boolean;
  position: ContextMenuPosition;
  items: ContextMenuItem[];
  type: 'node' | 'connection' | null;
}

export interface SchemaField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  description?: string;
  tooltip?: string;
  dynamic?: boolean;
  connectionField?: string;
  maxLimited?: boolean;
}

export interface SchemaNode {
  type?: string;
  title?: string;
  properties?: Record<string, SchemaField>;
  required?: string[];
}

export interface FormFieldValue {
  type: string;
  value: any;
  field: SchemaField;
}

export interface FormFieldResolver {
  (field: SchemaField, nodeConfigForm: NodeConfigForm): any;
}

export type NodeConnectedCallback = (node: WorkflowNode) => void;
