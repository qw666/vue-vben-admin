import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';

export const HttpRequestNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'io.kestra.plugin.core.http.Request',
  config: {
    nodeType: 'io.kestra.plugin.core.http.Request',
    nodeName: 'HTTP Request',
    icon: 'mdi:web',
    description: 'HTTP请求节点',
    ports: {
      input: 1,
      output: [
        { field: 'output', label: 'Next', color: '#8b5cf6', connectionType: 'single', connectionMode: 'sequential' },
      ],
    },
    taskFields: [],
  },

  initConfig(savedConfig: Record<string, any>): Record<string, any> {
    return {
      method: savedConfig.method || 'POST',
      uri: savedConfig.uri || '',
      contentType: savedConfig.contentType || 'application/json',
      body: savedConfig.body || '',
      bodyType: savedConfig.bodyType || 'json',
      headers: savedConfig.headers || {},
      params: savedConfig.params || {},
      formData: savedConfig.formData || {},
      timeout: savedConfig.timeout || 'PT10M',
      options: {
        auth: savedConfig.options?.auth || null,
        connectTimeout: savedConfig.options?.connectTimeout || 'PT30S',
        readTimeout: savedConfig.options?.readTimeout || 'PT10S',
        connectionPoolIdleTimeout: savedConfig.options?.connectionPoolIdleTimeout || 'PT10S',
        readIdleTimeout: savedConfig.options?.readIdleTimeout || 'PT300S',
        ssl: savedConfig.options?.ssl || { insecureTrustAllCertificates: true },
        logs: savedConfig.options?.logs || [],
        defaultCharset: savedConfig.options?.defaultCharset || 'utf8',
      },
    };
  },

  serializeConfig(config: Record<string, any>): Record<string, any> {
    const kestraConfig: Record<string, any> = {
      uri: config.uri,
      method: config.method,
      contentType: config.contentType,
    };

    if (config.body && config.body.trim()) {
      kestraConfig.body = config.body;
    }

    if (config.formData && Object.keys(config.formData).length > 0) {
      kestraConfig.formData = config.formData;
    }

    if (config.headers && Object.keys(config.headers).length > 0) {
      kestraConfig.headers = config.headers;
    }

    if (config.timeout) {
      kestraConfig.timeout = config.timeout;
    }

    if (config.options) {
      const options: Record<string, any> = {};

      if (config.options.auth) {
        options.auth = config.options.auth;
      }

      if (config.options.connectTimeout) {
        options.connectTimeout = config.options.connectTimeout;
      }

      if (config.options.readTimeout) {
        options.readTimeout = config.options.readTimeout;
      }

      if (config.options.connectionPoolIdleTimeout) {
        options.connectionPoolIdleTimeout = config.options.connectionPoolIdleTimeout;
      }

      if (config.options.readIdleTimeout) {
        options.readIdleTimeout = config.options.readIdleTimeout;
      }

      if (config.options.ssl) {
        options.ssl = config.options.ssl;
      }

      if (config.options.logs && config.options.logs.length > 0) {
        options.logs = config.options.logs;
      }

      if (config.options.defaultCharset) {
        options.defaultCharset = config.options.defaultCharset;
      }

      if (Object.keys(options).length > 0) {
        kestraConfig.options = options;
      }
    }

    return kestraConfig;
  },

  deserializeConfig(config: Record<string, any>): Record<string, any> {
    const bodyType = config.contentType === 'multipart/form-data' ? 'form-data'
      : config.contentType === 'application/x-www-form-urlencoded' ? 'url-encoded'
      : 'json';

    return {
      method: config.method || 'POST',
      uri: config.uri || '',
      contentType: config.contentType || 'application/json',
      body: config.body || '',
      bodyType,
      headers: config.headers || {},
      params: {},
      formData: config.formData || {},
      timeout: config.timeout || 'PT10M',
      options: {
        auth: config.options?.auth || null,
        connectTimeout: config.options?.connectTimeout || 'PT30S',
        readTimeout: config.options?.readTimeout || 'PT10S',
        connectionPoolIdleTimeout: config.options?.connectionPoolIdleTimeout || 'PT10S',
        readIdleTimeout: config.options?.readIdleTimeout || 'PT300S',
        ssl: config.options?.ssl || { insecureTrustAllCertificates: true },
        logs: config.options?.logs || [],
        defaultCharset: config.options?.defaultCharset || 'utf8',
      },
    };
  },

  handleConnection(): void {
  },

  getRequiredFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },

  getOptionalFields(): { type: string; props: Record<string, any> }[] {
    return [];
  },
};

flowControlNodeRegistry.register(HttpRequestNodeStrategy);
