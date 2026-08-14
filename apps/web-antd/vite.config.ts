import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          // 流程编排相关接口（保持原路径）
          '/api/flow/plat': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/flow\/plat/, '/flow/plat'),
            target: 'http://localhost:8189',
            ws: true,
            configure: (proxy, options) => {
              proxy.on('proxyRes', (proxyRes, req, res) => {
                const contentType = proxyRes.headers['content-type'];
                if (contentType && contentType.includes('text/event-stream')) {
                  res.setHeader('Cache-Control', 'no-cache');
                  res.setHeader('Connection', 'keep-alive');
                  res.setHeader('Content-Type', 'text/event-stream');
                }
              });
            },
          },
          // 管理后台接口（新增 manager 前缀）
          '/api/flow/plat/manager': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/flow\/plat\/manager/, '/flow/plat/manager'),
            target: 'http://localhost:8189',
            ws: true,
          },
          '/api': {
            changeOrigin: true,
            target: 'http://localhost:5320',
            ws: true,
          },
        },
      },
    },
  };
});
