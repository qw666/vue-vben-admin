import { requestClient } from '../request';

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

export interface ProjectVO {
  id: number;
  projectName: string;
  namespace: string;
  description: string;
  createBy: string;
  createTime: string;
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

function getHeaders() {
  return {
    tenantId: 'tenant001',
    loginUser: 'admin',
  };
}

export async function addFolder(data: FolderAddRequest): Promise<ApiResponse> {
  return requestClient.post(`${BASE_URL}/folder/add`, data, {
    headers: getHeaders(),
  });
}

export async function updateFolder(
  data: FolderUpdateRequest,
): Promise<ApiResponse> {
  return requestClient.post(`${BASE_URL}/folder/update`, data, {
    headers: getHeaders(),
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
      headers: getHeaders(),
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
      headers: getHeaders(),
    },
  );
}

export async function getProjectList(): Promise<ProjectVO[]> {
  return requestClient.post(
    `${BASE_URL}/project/list`,
    {},
    {
      headers: getHeaders(),
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
      headers: getHeaders(),
    },
  );
}

export async function addFlow(data: FlowSaveDTO): Promise<ApiResponse> {
  return requestClient.post(`${BASE_URL}/flow/add`, data, {
    headers: getHeaders(),
  });
}

export async function updateFlow(
  id: number,
  data: FlowSaveDTO,
): Promise<ApiResponse> {
  return requestClient.post(`${BASE_URL}/flow/update?id=${id}`, data, {
    headers: getHeaders(),
  });
}

export async function deleteFlow(id: number): Promise<ApiResponse> {
  return requestClient.post(
    `${BASE_URL}/flow/delete?id=${id}`,
    {},
    {
      headers: getHeaders(),
    },
  );
}

export async function getFlowDetail(id: number): Promise<FlowSaveDTO> {
  return requestClient.post(
    `${BASE_URL}/flow/detail?id=${id}`,
    {},
    {
      headers: getHeaders(),
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
      headers: getHeaders(),
    },
  );
}

export async function getPluginMetaBatch(
  nodeTypes: string[],
): Promise<Record<string, PluginMetaDetailDTO>> {
  return requestClient.post(`${BASE_URL}/plugin/batch/meta`, nodeTypes, {
    headers: getHeaders(),
  });
}

export async function requestToggleTrigger(
  flowId: number,
  triggerId: string,
  enabled: boolean,
): Promise<boolean> {
  try {
    const result = await requestClient.post(
      `${BASE_URL}/flow/trigger/toggle`,
      {
        flowId,
        triggerId,
        enabled,
      },
      {
        headers: getHeaders(),
      },
    );
    return result && result.code === 200;
  } catch (error) {
    console.error('Failed to toggle trigger:', error);
    return false;
  }
}

export async function validateFlow(
  data: FlowSaveDTO,
): Promise<FlowValidateResultVO> {
  return requestClient.post(`${BASE_URL}/flow/validate`, data, {
    headers: getHeaders(),
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
    headers: getHeaders(),
  });
}

export interface FlowSelectVO {
  flowId: string;
  description: string;
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
    headers: getHeaders(),
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
      headers: getHeaders(),
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
      headers: getHeaders(),
    },
  );
}
