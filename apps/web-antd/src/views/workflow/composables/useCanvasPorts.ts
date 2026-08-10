// 重构后的模块化结构 - 保持向后兼容的 API
// 所有调用方无需修改导入路径

export {
  getNodePorts,
  getPortPosition,
  getGroupBounds,
  getConnectionPath,
  getConnectionColor,
} from './useCanvasPorts/index';

export type {
  ResolvedInputPort,
  ResolvedOutputPort,
  ResolvedOutputPorts,
  PositionInput,
} from './useCanvasPorts/index';
