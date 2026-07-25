import type { FlowControlNodeStrategy } from './types';
import { flowControlNodeRegistry } from './types';

export const HttpRequestNodeStrategy: FlowControlNodeStrategy = {
  nodeType: 'idp_core_http_Request',
  config: {
    nodeType: 'idp_core_http_Request',
    nodeName: 'Http请求',
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
    const contentType = savedConfig.contentType || 'application/json';
    const bodyType = contentType === 'multipart/form-data' ? 'form-data'
      : contentType === 'application/x-www-form-urlencoded' ? 'url-encoded'
      : 'json';

    return {
      method: savedConfig.method || 'POST',
      uri: savedConfig.uri || '',
      contentType,
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

      if (config.options.defaultCharset && config.options.defaultCharset !== 'utf8') {
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
        ssl: config.options?.ssl
          ? {
              insecureTrustAllCertificates: config.options.ssl.insecureTrustAllCertificates === true ||
                config.options.ssl.insecureTrustAllCertificates === 'true',
            }
          : { insecureTrustAllCertificates: true },
        logs: config.options?.logs || [],
        defaultCharset: config.options?.defaultCharset || 'utf8',
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
};

flowControlNodeRegistry.register(HttpRequestNodeStrategy);
