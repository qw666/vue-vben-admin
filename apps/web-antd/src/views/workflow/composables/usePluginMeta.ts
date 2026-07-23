import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { getPluginTree, getPluginMetaBatch, type PluginGroupTreeDTO, type PluginMetaDetailDTO } from '#/api';

const pluginGroupsCache = ref<Record<string, PluginGroupTreeDTO[]>>({});
const pluginMetaCache = ref<Record<string, PluginMetaDetailDTO>>({});
const isPluginLoading = ref(false);
const isMetaLoading = ref(false);
const activeTab = ref<'task' | 'template'>('task');

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

function resolveRef(ref: string, defs: Record<string, any>): any {
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

function switchTab(tab: 'task' | 'template') {
  activeTab.value = tab;
  if (tab === 'task' && (!pluginGroupsCache.value[tab] || pluginGroupsCache.value[tab].length === 0)) {
    loadPlugins(tab);
  }
}

async function loadPluginMeta(nodeType: string): Promise<PluginMetaDetailDTO | null> {
  const cached = pluginMetaCache.value[nodeType];
  if (cached) {
    return cached;
  }

  isMetaLoading.value = true;
  try {
    const response = await getPluginMetaBatch([nodeType]);
    const data = response as Record<string, PluginMetaDetailDTO>;
    if (data && data[nodeType]) {
      const meta = data[nodeType];
      if (meta.formSchema) {
        let schema: any = meta.formSchema;
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
          meta.formDefs = { ...schema.$defs, ...schema.definitions };
        } else if (typeof schema === 'object' && schema.properties) {
          meta.parsedSchema = schema;
          meta.formProperties = schema.properties;
          meta.formRequired = schema.required || [];
          meta.formDefs = { ...schema.$defs, ...schema.definitions };
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
