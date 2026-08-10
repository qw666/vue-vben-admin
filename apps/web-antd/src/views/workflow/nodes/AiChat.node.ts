import type { FlowControlNodeStrategy, NodeOutputDef } from './types';

import { flowControlNodeRegistry } from './types';

/**
 * AI 对话节点策略
 *
 * 基于 Kestra AI Completion 插件：
 * https://kestra.io/plugins/plugin-ai/completion/io.kestra.plugin.ai.completion.chatcompletion
 *
 * 支持多种主流大模型引擎，所有 Provider 都支持 baseUrl 自定义端点，
 * 可用于连接本地部署、代理转发、企业网关等场景。
 *
 * 使用场景：任务型调用，输入提示词 -> AI 处理 -> 输出结果给下游节点
 */

/** 前端 AI 引擎选项配置 */
const ENGINE_PRESETS: Record<
  string,
  { baseUrl: string; label: string; modelName: string; type: string }
> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    label: 'OpenAI',
    modelName: 'gpt-4o',
    type: 'idp_ai_provider_OpenAI',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    label: '通义千问',
    modelName: 'qwen-max',
    type: 'idp_ai_provider_DashScope',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    label: 'DeepSeek',
    modelName: 'deepseek-chat',
    type: 'idp_ai_provider_DeepSeek',
  },
};

export const AiChatNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_ai_completion_ChatCompletion',
  config: {
    nodeType: 'idp_ai_completion_ChatCompletion',
    nodeName: '大模型',
    icon: 'ai-chat',
    description: '调用大模型处理任务，返回结果传给下游',
    group: 'ai',
    category: 'ai',
    ports: {
      input: 1,
      output: [
        {
          field: 'output',
          label: 'Next',
          color: '#8b5cf6',
          connectionType: 'single',
          connectionMode: 'sequential',
        },
      ],
    },
    taskFields: [],
  },

  /**
   * 输出变量：供下游节点通过 {{ outputs.nodeId.response }} 引用
   */
  getOutputs(): NodeOutputDef[] {
    return [
      { key: 'response', label: 'AI 响应', type: 'string' },
      { key: 'tokens', label: 'Token 用量', type: 'object' },
      { key: 'model', label: '使用的模型', type: 'string' },
    ];
  },

  /**
   * 初始化配置（后端配置 → 前端编辑格式）
   *
   * 注意：此方法用于从后端加载已有配置，需要完整解析所有字段
   * 此方法需要幂等，因为可能被调用多次
   */
  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    // 检测是否已经是前端格式（包含 providerKey 或 providerType 等字段）
    if ('providerKey' in savedConfig || 'providerType' in savedConfig) {
      // 已经是前端格式，直接返回（但需要确保默认值完整）
      return {
        providerKey: savedConfig.providerKey || 'openai',
        providerType: savedConfig.providerType || ENGINE_PRESETS.openai!.type,
        apiKey: savedConfig.apiKey || '',
        modelName: savedConfig.modelName || '',
        baseUrl: savedConfig.baseUrl || '',
        systemPrompt: savedConfig.systemPrompt || '',
        userPrompt: savedConfig.userPrompt || '',
        temperature: savedConfig.temperature ?? 0.7,
        maxToken: savedConfig.maxToken ?? 4096,
        topP: savedConfig.topP ?? 1,
      };
    }

    // 后端格式 → 前端格式
    const defaultPreset = ENGINE_PRESETS.openai!;
    const providerType = savedConfig.provider?.type || defaultPreset.type;

    // 根据 provider type 查找前端选项 key
    let providerKey = 'openai';
    for (const [key, preset] of Object.entries(ENGINE_PRESETS)) {
      if (preset.type === providerType) {
        providerKey = key;
        break;
      }
    }
    if (!ENGINE_PRESETS[providerKey]) {
      providerKey = 'openai';
    }

    // 从 messages 数组中提取 system 和 user 提示词
    let systemPrompt = '';
    let userPrompt = '';
    if (Array.isArray(savedConfig.messages)) {
      for (const msg of savedConfig.messages) {
        if (msg.type === 'SYSTEM' && msg.content) {
          systemPrompt = msg.content;
        } else if (msg.type === 'USER' && msg.content) {
          userPrompt = msg.content;
        }
      }
    }

    return {
      providerKey,
      providerType,
      apiKey: savedConfig.provider?.apiKey || '',
      modelName: savedConfig.provider?.modelName || defaultPreset.modelName,
      baseUrl: savedConfig.provider?.baseUrl || defaultPreset.baseUrl,
      systemPrompt,
      userPrompt,
      temperature: savedConfig.configuration?.temperature ?? 0.7,
      maxToken: savedConfig.configuration?.maxToken ?? 4096,
      topP: savedConfig.configuration?.topP ?? 1,
    };
  },

  /**
   * 序列化配置（前端编辑格式 → 后端存储格式）
   *
   * 生成符合 Kestra YAML 规范的结构：
   * provider: { type, apiKey, modelName, baseUrl, ... }
   * messages: [{ type: 'SYSTEM'|'USER', content }]
   * configuration: { temperature, maxToken, topP }
   *
   * 注意：此函数需要幂等，因为它会被调用两次：
   * 1. flushConfig 调用（前端表单 → 中间格式）
   * 2. convertWorkflowToFlowModel 调用（中间格式 → 后端格式）
   */
  serializeConfig(config: Record<string, any>): Record<string, any> {
    // 检测是否已经是序列化后的格式（包含 provider 和 messages 字段）
    if (config.provider && Array.isArray(config.messages)) {
      // 已经是序列化后的格式，直接返回
      // 但需要清理空的 messages 数组
      const result: Record<string, any> = {
        provider: config.provider,
        messages: config.messages.filter((msg: any) => msg && msg.content),
      };
      if (config.configuration && Object.keys(config.configuration).length > 0) {
        result.configuration = config.configuration;
      }
      return result;
    }

    // 获取默认预设
    const engineKey = config.providerKey || 'openai';
    const preset = ENGINE_PRESETS[engineKey] || ENGINE_PRESETS.openai!;

    // 前端表单格式 → 序列化格式
    const providerData: Record<string, any> = {};

    // 确保 type 和 modelName 有值（使用默认值）
    const providerType = config.providerType || preset.type;
    const modelName = config.modelName || preset.modelName;

    if (providerType) {
      providerData.type = providerType;
    }
    if (modelName) {
      providerData.modelName = modelName;
    }
    if (config.apiKey) {
      providerData.apiKey = config.apiKey;
    }
    if (config.baseUrl) {
      providerData.baseUrl = config.baseUrl;
    }

    const messages: Array<{ content: string; type: string }> = [];
    if (config.systemPrompt && config.systemPrompt.trim()) {
      messages.push({ content: config.systemPrompt, type: 'SYSTEM' });
    }
    if (config.userPrompt && config.userPrompt.trim()) {
      messages.push({ content: config.userPrompt, type: 'USER' });
    }

    // 构建 configuration 对象
    const configuration: Record<string, any> = {};
    if (config.temperature !== undefined && config.temperature !== null) {
      configuration.temperature = config.temperature;
    }
    if (config.maxToken !== undefined && config.maxToken !== null) {
      configuration.maxToken = config.maxToken;
    }
    if (config.topP !== undefined && config.topP !== 1) {
      configuration.topP = config.topP;
    }

    const result: Record<string, any> = {
      provider: providerData,
      messages,
    };

    // 只有 configuration 不为空时才添加
    if (Object.keys(configuration).length > 0) {
      result.configuration = configuration;
    }

    return result;
  },

  /**
   * 反序列化（后端存储格式 → 前端编辑格式）
   */
  deserializeConfig(config: Record<string, any>): Record<string, any> {
    const defaultPreset = ENGINE_PRESETS.openai!;
    const providerType = config.provider?.type || defaultPreset.type;

    // 根据 provider type 查找前端选项 key
    let providerKey = 'openai';
    for (const [key, preset] of Object.entries(ENGINE_PRESETS)) {
      if (preset.type === providerType) {
        providerKey = key;
        break;
      }
    }
    // 如果没匹配到，默认用 openai
    if (!ENGINE_PRESETS[providerKey]) {
      providerKey = 'openai';
    }

    // 从 messages 数组中提取 system 和 user 提示词
    let systemPrompt = '';
    let userPrompt = '';
    if (Array.isArray(config.messages)) {
      for (const msg of config.messages) {
        if (msg.type === 'SYSTEM' && msg.content) {
          systemPrompt = msg.content;
        } else if (msg.type === 'USER' && msg.content) {
          userPrompt = msg.content;
        }
      }
    }

    return {
      providerKey,
      providerType,
      apiKey: config.provider?.apiKey || '',
      modelName: config.provider?.modelName || '',
      baseUrl: config.provider?.baseUrl || '',
      systemPrompt,
      userPrompt,
      temperature: config.configuration?.temperature ?? 0.7,
      maxToken: config.configuration?.maxToken ?? 4096,
      topP: config.configuration?.topP ?? 1,
    };
  },

  /**
   * 保存前校验
   */
  validateConfig(config: Record<string, any>): null | string {
    // provider 校验
    if (!config.provider?.type) {
      return '请选择 AI 供应商';
    }
    if (!config.provider?.modelName || !config.provider.modelName.trim()) {
      return '请填写模型名称';
    }

    // messages 校验
    if (!config.messages || config.messages.length === 0) {
      return '请至少添加一条用户提示词';
    }
    const userMessage = config.messages.find((m: any) => m.type === 'USER');
    if (!userMessage || !userMessage.content || !userMessage.content.trim()) {
      return '请填写用户提示词';
    }

    return null;
  },

  /**
   * 声明使用专用配置组件
   */
  getConfigComponent(): null {
    return null;
  },

  /**
   * AI 节点使用专用组件渲染
   */
  getRequiredFields(): { props: Record<string, any>; type: string }[] {
    return [];
  },

  getOptionalFields(): { props: Record<string, any>; type: string }[] {
    return [];
  },
};

flowControlNodeRegistry.register(AiChatNodeStrategy);
