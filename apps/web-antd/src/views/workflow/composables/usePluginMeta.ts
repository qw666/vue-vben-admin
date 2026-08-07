import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { getPluginTree, getPluginMetaBatch, type PluginGroupTreeDTO, type PluginMetaDetailDTO } from '#/api';

/**
 * 延迟获取 flowControlNodeRegistry，避免循环依赖。
 * nodes 模块通过 index.ts 统一导入，而 usePluginMeta 在早期加载，
 * 直接导入 nodes/types 会导致模块初始化顺序问题。
 */
let _registry: any = null;
async function getRegistryAsync() {
  if (!_registry) {
    const mod = await import('../nodes/types');
    _registry = mod.flowControlNodeRegistry;
  }
  return _registry;
}

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
    // 如果已缓存但未注册到 registry，异步补充注册
    if (cached.formProperties) {
      getRegistryAsync().then(registry => {
        if (!registry.hasStrategy(nodeType)) {
          registry.registerSchemaMeta({
            nodeType,
            nodeName: cached.nodeName || nodeType,
            icon: cached.icon || 'mdi:cube-outline',
            description: cached.description || '',
            formProperties: cached.formProperties as any,
            formRequired: cached.formRequired || [],
            formDefs: cached.formDefs || {},
            outputs: cached.outputs?.map((o: any) => ({
              key: o.key,
              label: o.label,
              type: o.type,
              condition: o.condition,
            })),
          });
        }
      });
    }
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

      // 异步注册到 flowControlNodeRegistry
      if (meta.formProperties) {
        getRegistryAsync().then(registry => {
          if (!registry.hasStrategy(nodeType)) {
            registry.registerSchemaMeta({
              nodeType,
              nodeName: meta.nodeName || nodeType,
              icon: meta.icon || 'mdi:cube-outline',
              description: meta.description || '',
              formProperties: meta.formProperties as any,
              formRequired: meta.formRequired || [],
              formDefs: meta.formDefs || {},
              outputs: meta.outputs?.map((o: any) => ({
                key: o.key,
                label: o.label,
                type: o.type,
                condition: o.condition,
              })),
            });
          }
        });
      }

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
 * 加载完成后异步注册到 flowControlNodeRegistry，确保策略统一。
 */
async function preloadPluginMeta(nodeTypes: string[]): Promise<void> {
  const uncached = nodeTypes.filter((t) => t && !pluginMetaCache.value[t]);
  if (uncached.length === 0) {
    // 所有节点都已缓存，确保它们都注册到 registry
    const registry = await getRegistryAsync();
    for (const nodeType of nodeTypes) {
      const cached = pluginMetaCache.value[nodeType];
      if (cached?.formProperties && !registry.hasStrategy(nodeType)) {
        registry.registerSchemaMeta({
          nodeType,
          nodeName: cached.nodeName || nodeType,
          icon: cached.icon || 'mdi:cube-outline',
          description: cached.description || '',
          formProperties: cached.formProperties as any,
          formRequired: cached.formRequired || [],
          formDefs: cached.formDefs || {},
          outputs: cached.outputs?.map((o: any) => ({
            key: o.key,
            label: o.label,
            type: o.type,
            condition: o.condition,
          })),
        });
      }
    }
    return;
  }

  try {
    const data = (await getPluginMetaBatch(uncached)) as Record<string, PluginMetaDetailDTO>;
    if (data) {
      const newCache = { ...pluginMetaCache.value };
      const registry = await getRegistryAsync();
      for (const nodeType of uncached) {
        const meta = data[nodeType];
        if (!meta) continue;
        parseMetaSchema(meta);
        newCache[nodeType] = meta;

        // 同步注册到 flowControlNodeRegistry
        if (meta.formProperties && !registry.hasStrategy(nodeType)) {
          registry.registerSchemaMeta({
            nodeType,
            nodeName: meta.nodeName || nodeType,
            icon: meta.icon || 'mdi:cube-outline',
            description: meta.description || '',
            formProperties: meta.formProperties as any,
            formRequired: meta.formRequired || [],
            formDefs: meta.formDefs || {},
            outputs: meta.outputs?.map((o: any) => ({
              key: o.key,
              label: o.label,
              type: o.type,
              condition: o.condition,
            })),
          });
        }
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
