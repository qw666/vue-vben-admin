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

export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
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
): Promise<ApiResponse<FolderResponse[]>> {
  return requestClient.post(`${BASE_URL}/folder/tree?projectId=${projectId}`, {}, {
    headers: getHeaders(),
  });
}

export async function getProjectList(): Promise<ApiResponse<ProjectVO[]>> {
  return requestClient.post(`${BASE_URL}/project/list`, {}, {
    headers: getHeaders(),
  });
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

export async function getPluginTree(nodeCategory?: string): Promise<ApiResponse<PluginGroupTreeDTO[]>> {
  const params = nodeCategory ? `?nodeCategory=${nodeCategory}` : '';
  return requestClient.post(`${BASE_URL}/plugin/tree${params}`, {}, {
    headers: getHeaders(),
  });
}
