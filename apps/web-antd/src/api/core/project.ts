import { requestClient } from '../request';

const BASE_URL = '/flow/plat';

export interface ProjectListItem {
  id: number;
  projectName: string;
  namespace?: string;
  description?: string;
  createBy?: string;
  createTime?: string;
  userCount?: number;
}

export interface ProjectListQuery {
  page: number;
  pageSize: number;
  projectName?: string;
  id?: number;
}

export interface ProjectSaveParams {
  id?: number;
  projectName: string;
  description?: string;
}

export interface ProjectUserListItem {
  id: string;
  name: string;
  status: number;
  createTime: string;
  remark?: string;
}

export async function listProjects(params: ProjectListQuery) {
  return requestClient.get<{ total: number; list: ProjectListItem[] }>(
    `${BASE_URL}/project/page`,
    { params },
  );
}

export async function saveProject(data: ProjectSaveParams) {
  return requestClient.post<void>(`${BASE_URL}/project/add`, data);
}

export async function updateProject(id: number, data: ProjectSaveParams) {
  return requestClient.post<void>(`${BASE_URL}/project/update?id=${id}`, data);
}

export async function deleteProject(id: number) {
  return requestClient.post<void>(`${BASE_URL}/project/delete?id=${id}`, {});
}

export async function getProject(id: number) {
  return requestClient.post<ProjectListItem>(`${BASE_URL}/project/get?id=${id}`, {});
}

export async function listMyProjects() {
  return requestClient.get<ProjectListItem[]>(`${BASE_URL}/project/my-list`);
}

// ============ 项目-用户关联 ============

export async function listProjectUsers(projectId: string | number) {
  return requestClient.get<{ total: number; list: ProjectUserListItem[] }>(
    `${BASE_URL}/project/${projectId}/users`,
  );
}

export async function listAvailableProjectUsers(projectId: string | number) {
  return requestClient.get<{ total: number; list: ProjectUserListItem[] }>(
    `${BASE_URL}/project/${projectId}/available-users`,
  );
}

export async function addUsersToProject(projectId: string | number, userIds: number[]) {
  return requestClient.post<void>(`${BASE_URL}/project/${projectId}/users`, userIds);
}

export async function removeUserFromProject(projectId: string | number, userId: string | number) {
  return requestClient.delete<void>(`${BASE_URL}/project/${projectId}/users/${userId}`);
}
