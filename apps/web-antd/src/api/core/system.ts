import { requestClient } from '#/api/request';

// ============ 用户管理 ============
export interface UserListItem {
  id: string;
  name: string;
  status: number;
  createTime: string;
  remark: string;
}

export interface UserListQuery {
  page: number;
  pageSize: number;
  name?: string;
  id?: string;
  deptId?: string;
  status?: number;
}

export interface UserSaveParams {
  id?: string;
  name: string;
  password?: string;
  status?: number;
  deptId?: string;
  remark?: string;
}

export async function listUsers(params: UserListQuery) {
  return requestClient.get<{ total: number; list: UserListItem[] }>('/flow/plat/manager/system/user/list', { params });
}

export async function saveUser(data: UserSaveParams) {
  return requestClient.post<void>('/flow/plat/manager/system/user/save', data);
}

export async function updateUser(data: UserSaveParams) {
  return requestClient.put<void>('/flow/plat/manager/system/user/update', data);
}

export async function deleteUser(id: string) {
  return requestClient.delete<void>(`/flow/plat/manager/system/user/${id}`);
}

// ============ 角色管理 ============
export interface RoleListItem {
  id: string;
  name: string;
  status: number;
  createTime: string;
  remark: string;
  menuIds: number[];
}

export interface RoleListQuery {
  page: number;
  pageSize: number;
  name?: string;
  id?: string;
  status?: number;
}

export interface RoleSaveParams {
  id?: string;
  name: string;
  status?: number;
  remark?: string;
  menuIds?: number[];
}

export async function listRoles(params: RoleListQuery) {
  return requestClient.get<{ total: number; list: RoleListItem[] }>('/flow/plat/manager/system/role/list', { params });
}

export async function saveRole(data: RoleSaveParams) {
  return requestClient.post<void>('/flow/plat/manager/system/role/save', data);
}

export async function updateRole(data: RoleSaveParams) {
  return requestClient.put<void>('/flow/plat/manager/system/role/update', data);
}

export async function deleteRole(id: string) {
  return requestClient.delete<void>(`/flow/plat/manager/system/role/${id}`);
}

export async function getRoleUserCount(roleId: string) {
  return requestClient.get<number>(`/flow/plat/manager/system/role/${roleId}/user-count`);
}

export async function listUsersByRole(roleId: string) {
  return requestClient.get<{ total: number; list: UserListItem[] }>(`/flow/plat/manager/system/role/${roleId}/users`);
}

export async function listAvailableUsers(roleId: string) {
  return requestClient.get<{ total: number; list: UserListItem[] }>(`/flow/plat/manager/system/role/${roleId}/available-users`);
}

export async function addUsersToRole(roleId: string, userIds: number[]) {
  return requestClient.post<void>(`/flow/plat/manager/system/role/${roleId}/users`, userIds);
}

export async function removeUserFromRole(roleId: string, userId: string) {
  return requestClient.delete<void>(`/flow/plat/manager/system/role/${roleId}/users/${userId}`);
}

// ============ 部门管理 ============
export interface DeptItem {
  id: number;
  pid: number;
  name: string;
  status: number;
  remark: string;
  children?: DeptItem[];
}

export async function listDepts() {
  return requestClient.get<DeptItem[]>('/flow/plat/manager/system/dept/list');
}

export async function saveDept(data: { id?: number; pid?: number; name: string; status?: number; remark?: string }) {
  return requestClient.post<void>('/flow/plat/manager/system/dept', data);
}

export async function updateDept(data: { id?: number; pid?: number; name: string; status?: number; remark?: string }) {
  return requestClient.put<void>('/flow/plat/manager/system/dept', data);
}

export async function deleteDept(id: number) {
  return requestClient.delete<void>(`/flow/plat/manager/system/dept/${id}`);
}

export async function isDeptNameExists(name: string, id?: number) {
  return requestClient.get<boolean>('/flow/plat/manager/system/dept/name-exists', { params: { name, id } });
}

// ============ 菜单管理 ============
export interface MenuListItem {
  id: number;
  pid: number;
  name: string;
  path: string;
  component: string;
  type: string;
  status: number;
  authCode: string;
  sort: number;
  meta: Record<string, unknown> | null;
  children?: MenuListItem[];
}

export async function listMenus() {
  return requestClient.get<MenuListItem[]>('/flow/plat/manager/menu/list');
}

export async function saveMenu(data: { id?: number; pid?: number; name: string; path?: string; component?: string; type?: string; status?: number; authCode?: string; sort?: number; metaJson?: string }) {
  return requestClient.post<void>('/flow/plat/manager/menu/save', data);
}

export async function updateMenu(data: { id?: number; pid?: number; name: string; path?: string; component?: string; type?: string; status?: number; authCode?: string; sort?: number; metaJson?: string }) {
  return requestClient.put<void>('/flow/plat/manager/menu/update', data);
}

export async function deleteMenu(id: number) {
  return requestClient.delete<void>(`/flow/plat/manager/menu/${id}`);
}

export async function isMenuNameExists(name: string, id?: number) {
  return requestClient.get<boolean>('/flow/plat/manager/menu/name-exists', { params: { name, id } });
}

export async function isMenuPathExists(path: string, id?: number) {
  return requestClient.get<boolean>('/flow/plat/manager/menu/path-exists', { params: { path, id } });
}
