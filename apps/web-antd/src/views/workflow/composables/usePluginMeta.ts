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
      parseMetaSchema(meta);
      // 替换整个对象以强制触发响应式更新
      pluginMetaCache.value = { ...pluginMetaCache.value, [nodeType]: meta };
      return meta;
    }
  } catch (error) {
    console.error(`Failed to load plugin meta for '${nodeType}':`, error);
  } finally {
    isMetaLoading.value = false;
  }
  return null;
}

/**
 * 将 outputs 规范化为数组。
 * 处理后端可能返回的各种格式：JSON 字符串、双重编码、对象包裹数组。
 * 最终保证返回数组（无有效数据时返回空数组）。
 */
function normalizeOutputs(raw: any): any[] {
  if (raw === undefined || raw === null) return [];

  let value = raw;

  // 步骤1: JSON 字符串解析（可能双重编码）
  while (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      value = parsed;
    } catch {
      return [];
    }
  }

  // 步骤2: 对象包裹数组提取（{ outputs: [...] } 或 { output: [...] }）
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Array.isArray((value as any).outputs)) {
      value = (value as any).outputs;
    } else if (Array.isArray((value as any).output)) {
      value = (value as any).output;
    } else {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
}

/** 解析元数据中的 formSchema 和 outputs 字段 */
function parseMetaSchema(meta: PluginMetaDetailDTO): void {
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

  // outputs 规范化：一次性完成所有格式处理，保证 meta.outputs 始终是数组
  meta.outputs = normalizeOutputs(meta.outputs);
}

/**
 * 批量预加载多个节点类型的元数据。
 * 已缓存的会跳过，使用后端批量接口减少请求次数。
 */
async function preloadPluginMeta(nodeTypes: string[]): Promise<void> {
  const uncached = nodeTypes.filter((t) => t && !pluginMetaCache.value[t]);
  if (uncached.length === 0) {
    return;
  }

  try {
    const data = (await getPluginMetaBatch(uncached)) as Record<string, PluginMetaDetailDTO>;
    if (data) {
      const newCache = { ...pluginMetaCache.value };
      for (const nodeType of uncached) {
        const meta = data[nodeType];
        if (!meta) continue;
        parseMetaSchema(meta);
        newCache[nodeType] = meta;
      }
      // 替换整个对象以强制触发响应式更新
      pluginMetaCache.value = newCache;
    }
  } catch (error) {
    console.error('preloadPluginMeta: 批量加载失败:', error);
  }
}

export function usePluginMeta() {
  /**
   * 获取指定节点类型的输出变量声明。
   * 如果节点元数据中没有声明 outputs，则返回空数组。
   */
  function getNodeOutputs(nodeType: string): PluginMetaDetailDTO['outputs'] {
    const meta = pluginMetaCache.value[nodeType];
    return meta?.outputs || [];
  }

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
    preloadPluginMeta,
    getNodeOutputs,
  };
}
