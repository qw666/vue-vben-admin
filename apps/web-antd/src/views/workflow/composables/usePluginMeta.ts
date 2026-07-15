import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { getPluginTree, getPluginMetaBatch } from '#/api';

const pluginGroupsCache = ref<Record<string, any[]>>({
  task: [
    {
      groupKey: 'flow_control',
      groupName: '流程控制',
      pluginList: [
        { type: 'start', nodeName: '开始', icon: 'mdi:play-circle', description: '流程开始节点' },
        { type: 'end', nodeName: '结束', icon: 'mdi:stop-circle', description: '流程结束节点' },
        { type: 'condition', nodeName: '条件判断', icon: 'mdi:decision', description: '条件分支判断' },
        { type: 'loop', nodeName: '循环', icon: 'mdi:repeat', description: '循环执行' },
      ]
    },
    {
      groupKey: 'http',
      groupName: 'HTTP操作',
      pluginList: [
        { type: 'http_get', nodeName: 'HTTP GET', icon: 'mdi:download', description: '发送GET请求' },
        { type: 'http_post', nodeName: 'HTTP POST', icon: 'mdi:upload', description: '发送POST请求' },
      ]
    },
    {
      groupKey: 'output',
      groupName: '输出操作',
      pluginList: [
        { type: 'log', nodeName: '日志输出', icon: 'mdi:file-document', description: '输出日志' },
        { type: 'email', nodeName: '发送邮件', icon: 'mdi:email', description: '发送邮件通知' },
      ]
    }
  ],
  trigger: [
    {
      groupKey: 'trigger',
      groupName: '触发器',
      pluginList: [
        { type: 'webhook', nodeName: 'Webhook触发器', icon: 'mdi:webhook', description: 'Webhook回调触发' },
        { type: 'kafka', nodeName: 'Kafka触发器', icon: 'mdi:database', description: 'Kafka消息触发' },
        { type: 'timer', nodeName: '定时触发器', icon: 'mdi:clock', description: '定时调度触发' },
      ]
    }
  ]
});

const pluginMetaCache = ref<Record<string, any>>({});
const isPluginLoading = ref(false);
const isMetaLoading = ref(false);
const activeTab = ref<'task' | 'trigger'>('task');

const pluginGroups = computed(() => pluginGroupsCache.value[activeTab.value] || []);

function isTaskRef(itemsSchema: any): boolean {
  return itemsSchema && itemsSchema.$ref && 
    (itemsSchema.$ref === '#/$defs/idp_core_models_tasks_Task' || 
     itemsSchema.$ref.includes('idp_core_models_tasks_Task'));
}

const defaultDefs: Record<string, any> = {
  idp_core_models_tasks_Task: {
    type: 'object',
    title: '通用任务节点',
    properties: {
      type: { type: 'string', title: '任务类型', $required: true },
      name: { type: 'string', title: '任务名称', $required: false },
      description: { type: 'string', title: '任务描述', $required: false },
    },
  },
};

function resolveRef(ref: string, defs: any): any {
  if (!ref) return null;
  const refName = ref.replace('#/$defs/', '').replace('#/definitions/', '');
  const resolved = defs && defs[refName] ? defs[refName] : defaultDefs[refName];
  if (resolved && !resolved.properties && defaultDefs[refName]) {
    return defaultDefs[refName];
  }
  return resolved || null;
}

async function loadPlugins(category: string = 'task') {
  isPluginLoading.value = true;
  try {
    const response = await getPluginTree(category);
    if (response && Array.isArray(response)) {
      pluginGroupsCache.value[category] = response;
    }
  } catch (error) {
    console.error('Failed to load plugins:', error);
    message.error('加载节点列表失败');
  } finally {
    isPluginLoading.value = false;
  }
}

function switchTab(tab: 'task' | 'trigger') {
  activeTab.value = tab;
  if (!pluginGroupsCache.value[tab] || pluginGroupsCache.value[tab].length === 0) {
    loadPlugins(tab);
  }
}

async function loadPluginMeta(nodeType: string) {
  if (pluginMetaCache.value[nodeType]) {
    return pluginMetaCache.value[nodeType];
  }
  isMetaLoading.value = true;
  try {
    const response = await getPluginMetaBatch([nodeType]);
    const data = response as any;
    if (data && data[nodeType]) {
      const meta = data[nodeType];
      if (meta.formSchema) {
        let schema = meta.formSchema;
        try {
          schema = JSON.parse(meta.formSchema);
        } catch {
        }
        if (typeof schema === 'string') {
          try {
            schema = JSON.parse(schema);
          } catch {
          }
        }
        if (typeof schema === 'object' && schema.properties && schema.properties.properties) {
          meta.parsedSchema = schema;
          meta.formProperties = schema.properties.properties;
          meta.formRequired = schema.properties.required || schema.required || [];
          meta.formDefs = { ...schema.$defs, ...schema.definitions } || {};
        } else if (typeof schema === 'object' && schema.properties) {
          meta.parsedSchema = schema;
          meta.formProperties = schema.properties;
          meta.formRequired = schema.required || [];
          meta.formDefs = { ...schema.$defs, ...schema.definitions } || {};
        } else {
          meta.parsedSchema = null;
          meta.formProperties = {};
          meta.formRequired = [];
          meta.formDefs = {};
        }
      }
      pluginMetaCache.value[nodeType] = meta;
      return meta;
    }
  } catch (error) {
    console.error('Failed to load plugin meta:', error);
    message.error('加载节点元数据失败');
  } finally {
    isMetaLoading.value = false;
  }
  return null;
}

export function usePluginMeta() {
  return {
    pluginGroupsCache,
    pluginMetaCache,
    isPluginLoading,
    isMetaLoading,
    activeTab,
    pluginGroups,
    isTaskRef,
    defaultDefs,
    resolveRef,
    loadPlugins,
    switchTab,
    loadPluginMeta,
  };
}
