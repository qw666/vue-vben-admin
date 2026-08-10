import AiChatConfig from '../components/custom/AiChatConfig.vue';
import CodeConfig from '../components/custom/CodeConfig.vue';
import HttpRequestConfig from '../components/custom/HttpRequestConfig.vue';
import { nodeConfigComponentRegistry } from './NodeConfigComponentRegistry';

import './Start.node';
import './End.node';
import './If.node';
import './Switch.node';
import './ForEach.node';
import './Parallel.node';
import './Sequential.node';
import './Subflow.node';
import './Pause.node';
import './Sleep.node';
import './Default.node';
import './HttpRequest.node';
import './Code.node';
import './OutputValues.node';
import './AiChat.node';

// 注册配置组件（集中管理，与节点策略解耦）
// 只有需要复杂自定义 UI 的节点才需要注册专用组件
// Start/End 等简单节点通过 FieldRenderer 渲染，无需注册
nodeConfigComponentRegistry.register('idp_core_http_Request', HttpRequestConfig);
nodeConfigComponentRegistry.register('idp_scripts_python_Script', CodeConfig);
nodeConfigComponentRegistry.register('idp_ai_completion_ChatCompletion', AiChatConfig);

export { flowControlNodeRegistry } from './types';
export type { FlowControlNodeConfig, FlowControlNodeStrategy } from './types';
