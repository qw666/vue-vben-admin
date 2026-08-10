import type { FlowControlNodeStrategy, NodeOutputDef } from './types';
import { flowControlNodeRegistry } from './types';

export const HttpRequestNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_http_Request',
  config: {
    nodeType: 'idp_core_http_Request',
    nodeName: 'Http请求',
    icon: 'mdi:web',
    description: 'HTTP请求节点',
    group: 'tools',
    category: 'http',
    ports: {
      input: 1,
      output: [
        { field: 'output', label: 'Next', color: '#8b5cf6', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: [],
  },

  getOutputs(): NodeOutputDef[] {
    // 根据 Kestra 官方文档：https://kestra.io/plugins/plugin-fs/tasks/http/io.kestra.plugin.core.http.request
    return [
      { key: 'body', label: '响应体', type: 'object' },
      { key: 'code', label: '状态码', type: 'number' },
      { key: 'encryptedBody', label: '加密响应体', type: 'string' },
      { key: 'formData', label: '请求表单数据', type: 'object' },
      { key: 'headers', label: '响应头', type: 'object' },
      { key: 'uri', label: '请求URL', type: 'string' },
    ];
  },

  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    const contentType = savedConfig.contentType;
    const bodyType = !contentType ? 'none'
      : contentType === 'multipart/form-data' ? 'form-data'
      : contentType === 'application/x-www-form-urlencoded' ? 'url-encoded'
      : savedConfig.bodyType || 'json';

    return {
      method: savedConfig.method || 'POST',
      uri: savedConfig.uri || '',
      contentType: contentType || 'application/json',
      body: savedConfig.body || '',
      bodyType,
      headers: savedConfig.headers || {},
      params: savedConfig.params || {},
      formData: savedConfig.formData || {},
      timeout: savedConfig.timeout || 'PT10M',
      options: {
        auth: savedConfig.options?.auth || null,
        connectTimeout: savedConfig.options?.connectTimeout || 'PT30S',
        readTimeout: savedConfig.options?.readTimeout || 'PT10S',
        ssl: savedConfig.options?.ssl
          ? {
              insecureTrustAllCertificates: savedConfig.options.ssl.insecureTrustAllCertificates === true ||
                savedConfig.options.ssl.insecureTrustAllCertificates === 'true',
            }
          : { insecureTrustAllCertificates: true },
        logs: savedConfig.options?.logs || [],
        defaultCharset: savedConfig.options?.defaultCharset || 'UTF-8',
      },
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    const kestraConfig: Record<string, any> = {
      uri: config.uri,
      method: config.method,
    };

    // bodyType=none 时不保存 contentType 和 body
    if (config.bodyType !== 'none') {
      kestraConfig.contentType = config.contentType;
    }

    if (config.body && config.body.trim()) {
      kestraConfig.body = config.body;
    }

    if (config.formData && Object.keys(config.formData).length > 0) {
      kestraConfig.formData = config.formData;
    }

    if (config.headers && Object.keys(config.headers).length > 0) {
      kestraConfig.headers = config.headers;
    }

    // params: Kestra 文档中是顶层属性
    if (config.params && Object.keys(config.params).length > 0) {
      kestraConfig.params = config.params;
    }

    if (config.timeout && config.timeout !== 'PT10M') {
      kestraConfig.timeout = config.timeout;
    }

    if (config.options) {
      const options: Record<string, any> = {};

      if (config.options.auth && config.options.auth.type) {
        options.auth = config.options.auth;
      }

      if (config.options.connectTimeout) {
        options.connectTimeout = config.options.connectTimeout;
      }

      if (config.options.readTimeout) {
        options.readTimeout = config.options.readTimeout;
      }

      if (config.options.ssl) {
        const ssl: Record<string, any> = {};
        if (config.options.ssl.insecureTrustAllCertificates !== undefined && config.options.ssl.insecureTrustAllCertificates !== true) {
          ssl.insecureTrustAllCertificates = config.options.ssl.insecureTrustAllCertificates;
        }
        if (Object.keys(ssl).length > 0) {
          options.ssl = ssl;
        }
      }

      if (config.options.logs && config.options.logs.length > 0) {
        options.logs = config.options.logs;
      }

      if (config.options.defaultCharset && config.options.defaultCharset !== 'UTF-8') {
        options.defaultCharset = config.options.defaultCharset;
      }

      if (Object.keys(options).length > 0) {
        kestraConfig.options = options;
      }
    }

    return kestraConfig;
  },

  validateConfig(config: Record<string, any>): string | null {
    if (!config.uri || !config.uri.trim()) {
      return '请填写请求URL';
    }
    return null;
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    // 如果没有 contentType，说明之前 bodyType=none
    const contentType = config.contentType;
    const bodyType = !contentType ? 'none'
      : contentType === 'multipart/form-data' ? 'form-data'
      : contentType === 'application/x-www-form-urlencoded' ? 'url-encoded'
      : 'json';

    return {
      method: config.method || 'POST',
      uri: config.uri || '',
      contentType: contentType || 'application/json',
      body: config.body || '',
      bodyType,
      headers: config.headers || {},
      params: config.params || {},
      formData: config.formData || {},
      timeout: config.timeout || 'PT10M',
      options: {
        auth: config.options?.auth || null,
        connectTimeout: config.options?.connectTimeout || 'PT30S',
        readTimeout: config.options?.readTimeout || 'PT10S',
        ssl: config.options?.ssl
          ? {
              insecureTrustAllCertificates: config.options.ssl.insecureTrustAllCertificates === true ||
                config.options.ssl.insecureTrustAllCertificates === 'true',
            }
          : { insecureTrustAllCertificates: true },
        logs: config.options?.logs || [],
        defaultCharset: config.options?.defaultCharset || 'UTF-8',
      },
    };
  },

  handleConnection(): void {
  },

  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [{
      type: 'Input',
      props: {
        key: 'uri',
        label: '请求URL',
      },
    }];
  },

  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },

  /**
   * 声明专用配置组件
   * 注意：实际组件注册在 nodes/index.ts 中通过 nodeConfigComponentRegistry.register 完成
   * 这里返回 null 表示没有内置组件，配置组件由外部注册表管理
   */
  getConfigComponent(): null {
    return null;
  },
};

flowControlNodeRegistry.register(HttpRequestNodeStrategy);
