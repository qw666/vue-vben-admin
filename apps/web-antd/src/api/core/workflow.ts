import { requestClient } from '../request';
import { useAccessStore, useUserStore } from '@vben/stores';

const BASE_URL = '/flow/plat';

export interface FolderAddRequest {
  projectId: number;
  parentId?: number;
  folderName: string;
  sort?: number;
}

export interface FolderUpdateRequest {
  id: number;
  projectId: number;
  parentId?: number;
  folderName: string;
  sort?: number;
}

export interface FolderResponse {
  id: number;
  parentId: number;
  folderName: string;
  sort: number;
  children?: FolderResponse[];
}

export interface FlowVO {
  id: number;
  projectId: number;
  folderId: number;
  description: string;
  namespace: string;
  flowId: string;
  createBy: string;
  createTime: string;
  disabled?: boolean;
  deleted?: boolean;
  inputs?: FlowInput[];
  triggers?: FlowTrigger[];
  hasActiveTrigger?: boolean;
}

export interface FlowPageRequest {
  projectId: number;
  folderId?: number;
  description?: string;
  startTime?: string;
  endTime?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface FlowPageResponse {
  records: FlowVO[];
  total: number;
  current: number;
  size: number;
}

export interface FlowTask {
  id: string;
  type: string;
  [key: string]: any;
}

export interface FlowOutput {
  id: string;
  type: string;
  value: string;
  description?: string;
}

export interface FlowModel {
  tasks: FlowTask[];
  outputs?: FlowOutput[];
  inputs?: FlowInput[];
  triggers?: FlowTrigger[];
  disabled?: boolean;
}

export interface FlowInput {
  id: string;
  type: string;
  defaults?: any;
  displayName?: string;
  required?: boolean;
  itemType?: string;
}

export interface FlowTrigger {
  id: string;
  type: string;
  [key: string]: any;
}

export interface FlowLayout {
  nodes: Record<string, { x: number; y: number }>;
}

export interface FlowSaveDTO {
  projectId: number;
  folderId?: number;
  description: string;
  flowId: string;
  flowModel: FlowModel;
  flowLayout?: string;
}

export interface FlowValidateResultVO {
  index?: number;
  flow?: string;
  /** 致命错误，不为空代表流程无法保存运行 */
  constraints?: string;
  warnings?: string[];
  infos?: string[];
}

export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

export interface PluginSimpleDTO {
  type: string;
  nodeName: string;
  nodeCategory: string;
  icon: string;
}

export interface PluginGroupTreeDTO {
  groupKey: string;
  groupName: string;
  sort: number;
  pluginList: PluginSimpleDTO[];
}

export interface PluginMetaDetailDTO {
  type: string;
  nodeName: string;
  nodeDesc: string;
  nodeCategory: string;
  icon: string;
  description: string;
  formSchema: string;
  parsedSchema?: any;
  formProperties?: Record<string, any>;
  formRequired?: string[];
  formDefs?: Record<string, any>;
  /**
   * 节点的输出变量声明。
   * 格式: [{ key: 'rows', label: '查询结果行', type: 'array', condition?: 'fetchType == "FETCH"' }]
   * - key: 输出变量的键名，用于表达式 {{ outputs.nodeId.key }}
   * - label: 显示名称
   * - type: 数据类型 (string/number/object/array/any)
   * - condition: 可选，条件表达式，用于声明条件性输出
   */
  outputs?: PluginOutputDef[];
}

/**
 * 节点输出变量定义
 */
export interface PluginOutputDef {
  key: string;
  label: string;
  type?: string;
  condition?: string;
}

export async function addFolder(data: FolderAddRequest): Promise<ApiResponse> {
  return requestClient.post(`${BASE_URL}/folder/add`, data, {
    
  });
}

export async function updateFolder(
  data: FolderUpdateRequest,
): Promise<ApiResponse> {
  return requestClient.post(`${BASE_URL}/folder/update`, data, {
    
  });
}

export async function deleteFolder(
  id: number,
  projectId: number,
): Promise<ApiResponse> {
  return requestClient.post(
    `${BASE_URL}/folder/delete?id=${id}&projectId=${projectId}`,
    {},
    {
      
    },
  );
}

export async function getFolderTree(
  projectId: number,
): Promise<FolderResponse[]> {
  return requestClient.post(
    `${BASE_URL}/folder/tree?projectId=${projectId}`,
    {},
    {
      
    },
  );
}

export async function getFlowPage(
  data: FlowPageRequest,
): Promise<FlowPageResponse> {
  return requestClient.post(
    `${BASE_URL}/flow/page`,
    data,
    {
      
    },
  );
}

export async function addFlow(data: FlowSaveDTO): Promise<ApiResponse<number>> {
  return requestClient.post(`${BASE_URL}/flow/add`, data, {
    
  });
}

export async function updateFlow(
  id: number,
  data: FlowSaveDTO,
): Promise<ApiResponse> {
  return requestClient.post(`${BASE_URL}/flow/update?id=${id}`, data, {
    
  });
}

export async function deleteFlow(id: number): Promise<ApiResponse> {
  return requestClient.post(
    `${BASE_URL}/flow/delete?id=${id}`,
    {},
    {
      
    },
  );
}

export async function getFlowDetail(id: number): Promise<FlowSaveDTO> {
  return requestClient.post(
    `${BASE_URL}/flow/detail?id=${id}`,
    {},
    {
      
    },
  );
}

export async function getPluginTree(
  nodeCategory?: string,
): Promise<PluginGroupTreeDTO[]> {
  const params = nodeCategory ? `?nodeCategory=${nodeCategory}` : '';
  return requestClient.post(
    `${BASE_URL}/plugin/tree${params}`,
    {},
    {
      
    },
  );
}

export async function getPluginMetaBatch(
  nodeTypes: string[],
): Promise<Record<string, PluginMetaDetailDTO>> {
  return requestClient.post(`${BASE_URL}/plugin/batch/meta`, nodeTypes, {
    
  });
}

export async function requestToggleTrigger(
  flowId: number,
  triggerId: string,
  enabled: boolean,
): Promise<ApiResponse> {
  return requestClient.post(`${BASE_URL}/flow/trigger/toggle`, {
    flowId,
    triggerId,
    enabled,
  });
}

export async function validateFlow(
  data: FlowSaveDTO,
): Promise<FlowValidateResultVO> {
  return requestClient.post(`${BASE_URL}/flow/validate`, data, {
    
  });
}

export interface ExecutionTriggerRequest {
  flowId: string;
  projectId: number;
  inputs?: Record<string, any>;
}

export interface ExecutionBriefDTO {
  executionId?: string | number;
  flowId?: string;
  flowName?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  [key: string]: any;
}

export async function runFlow(data: ExecutionTriggerRequest): Promise<ApiResponse> {
  return requestClient.post(`${BASE_URL}/execution/trigger`, data, {
    
  });
}

export interface FlowSelectVO {
  flowId: string;
  description: string;
  projectId?: number;
  inputs?: Array<Record<string, any>>;
  [key: string]: any;
}

export async function getFlowSelectList(
  projectId: number,
  keyword?: string,
): Promise<FlowSelectVO[]> {
  const params: Record<string, any> = { projectId };
  if (keyword) params.keyword = keyword;
  return requestClient.get(`${BASE_URL}/flow/select`, {
    params,
    
  });
}

/**
 * 批量启用流程
 */
export async function batchEnableFlow(
  projectId: number,
  flowIdList: string[],
): Promise<ApiResponse> {
  return requestClient.post(
    `${BASE_URL}/flow/batch/enable?projectId=${projectId}`,
    flowIdList,
    {
      
    },
  );
}

/**
 * 批量停用流程
 */
export async function batchDisableFlow(
  projectId: number,
  flowIdList: string[],
): Promise<ApiResponse> {
  return requestClient.post(
    `${BASE_URL}/flow/batch/disable?projectId=${projectId}`,
    flowIdList,
    {
      
    },
  );
}

export interface FlowExportQuery {
  projectId: number;
  idList: number[];
}

export type FlowImportMode = 'SKIP' | 'OVERWRITE';

export interface FlowImportResultDTO {
  successCount: number;
  skipCount: number;
  failMsgList: string[];
}

async function requestRaw(url: string, options: RequestInit = {}): Promise<Response> {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const token = accessStore.accessToken;
  const headers: Record<string, string> = {};
  if (userStore.userInfo?.tenantId) headers['tenantId'] = userStore.userInfo.tenantId;
  if (userStore.userInfo?.userId) headers['loginUser'] = userStore.userInfo.userId;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.headers) Object.assign(headers, options.headers);

  const response = await fetch(`${import.meta.env.VITE_GLOB_API_URL}${url}`, {
    ...options,
    headers,
  });
  if (!response.ok) throw new Error(`请求失败: HTTP ${response.status}`);
  return response;
}

export async function exportFlows(
  data: FlowExportQuery,
): Promise<Blob> {
  const response = await requestRaw(`${BASE_URL}/flow/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(data),
  });
  return response.blob();
}

export async function importFlows(
  file: File,
  projectId: number,
  folderId: number,
  importMode: FlowImportMode,
): Promise<FlowImportResultDTO> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectId', String(projectId));
  formData.append('folderId', String(folderId));
  formData.append('importMode', importMode);

  const response = await requestRaw(`${BASE_URL}/flow/import`, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  return result.data || result;
}
