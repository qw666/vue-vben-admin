<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
  Tree,
} from 'ant-design-vue';

import {
  addUsersToRole,
  deleteRole,
  getRoleUserCount,
  listAvailableUsers,
  listMenus,
  listRoles,
  listUsersByRole,
  removeUserFromRole,
  saveRole,
  updateRole,
} from '#/api/core/system';

const loading = ref(false);
const dataSource = ref<any[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const searchName = ref('');

const modalOpen = ref(false);
const isEdit = ref(false);
const modalMode = ref<'add' | 'edit' | 'perm'>('add');
const formRef = ref();
const formData = ref({
  id: undefined as string | undefined,
  name: '',
  status: 1,
  remark: '',
  menuIds: [] as string[],
});

const menuTree = ref<any[]>([]);
const menuSearchText = ref('');
const expandedKeys = ref<string[]>([]);
const checkedKeys = ref<string[]>([]);
const halfCheckedKeys = ref<string[]>([]);

const userCountMap = ref<Record<string, number>>({});

const userModalOpen = ref(false);
const userModalLoading = ref(false);
const userModalTitle = ref('');
const userList = ref<any[]>([]);
const userListTotal = ref(0);
const currentRoleId = ref('');
const currentRoleName = ref('');

const addUserModalOpen = ref(false);
const addUserModalLoading = ref(false);
const availableUserList = ref<any[]>([]);
const selectedUserIds = ref<number[]>([]);
const addUserSearchText = ref('');

onMounted(() => {
  loadData();
  loadMenus();
});

async function loadData() {
  loading.value = true;
  try {
    const result = await listRoles({
      page: currentPage.value,
      pageSize: pageSize.value,
      name: searchName.value || undefined,
    });
    dataSource.value = result.list;
    total.value = result.total;
    loadUserCounts(result.list);
  } catch {
    message.error('加载角色列表失败');
  } finally {
    loading.value = false;
  }
}

async function loadUserCounts(roles: any[]) {
  const counts: Record<string, number> = {};
  await Promise.all(
    roles.map(async (role) => {
      try {
        counts[role.id] = await getRoleUserCount(role.id);
      } catch {
        counts[role.id] = 0;
      }
    }),
  );
  userCountMap.value = counts;
}

async function loadMenus() {
  try {
    const menus = await listMenus();
    menuTree.value = convertMenuTree(menus);
  } catch (error) {
    console.error('加载菜单失败', error);
  }
}

function convertMenuTree(data: any[]): any[] {
  return data
    .filter((item) => item && item.id != null)
    .map((item) => ({
      key: String(item.id),
      title: item.meta?.title || item.name,
      id: item.id,
      icon: getMenuIcon(item.type),
      type: item.type,
      children: item.children?.length ? convertMenuTree(item.children) : [],
    }));
}

function getMenuIcon(type: string) {
  const icons: Record<string, string> = {
    catalog: 'mdi:folder',
    menu: 'mdi:file-document',
    button: 'mdi:cursor-pointer',
  };
  return icons[type] || 'mdi:circle';
}

function getAllKeys(tree: any[]): string[] {
  const keys: string[] = [];
  const traverse = (nodes: any[]) => {
    nodes.forEach((node) => {
      keys.push(node.key);
      if (node.children?.length) {
        traverse(node.children);
      }
    });
  };
  traverse(tree);
  return keys;
}

function handleExpandAll() {
  expandedKeys.value = getAllKeys(menuTree.value);
}

function handleCollapseAll() {
  expandedKeys.value = [];
}

function handleCheckAll() {
  checkedKeys.value = getAllKeys(menuTree.value);
  halfCheckedKeys.value = [];
  formData.value.menuIds = [...checkedKeys.value];
}

function handleClearAll() {
  checkedKeys.value = [];
  halfCheckedKeys.value = [];
  formData.value.menuIds = [];
}

function handleCheck(keys: any, info: any) {
  checkedKeys.value = keys.checked || keys;
  halfCheckedKeys.value = keys.halfChecked || [];
  formData.value.menuIds = [...checkedKeys.value];
}

const filteredMenuTree = computed(() => {
  if (!menuSearchText.value) {
    return menuTree.value;
  }
  const searchText = menuSearchText.value.toLowerCase();
  const filterTree = (nodes: any[]): any[] => {
    return nodes
      .map((node) => {
        const children = filterTree(node.children || []);
        const titleMatch = node.title?.toLowerCase().includes(searchText);
        if (titleMatch || children.length > 0) {
          return { ...node, children };
        }
        return null;
      })
      .filter(Boolean);
  };
  return filterTree(menuTree.value);
});

watch(
  checkedKeys,
  (val) => {
    formData.value.menuIds = [...val];
  },
  { deep: true },
);

function handlePageChange(page: number) {
  currentPage.value = page;
  loadData();
}

function handlePageSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
  loadData();
}

const totalPages = computed(() => {
  return Math.ceil(total.value / pageSize.value);
});

const pageList = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const pages: (number | string)[] = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (current > 4) {
      pages.push('...');
    }
    const start = Math.max(2, current - 2);
    const end = Math.min(total - 1, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < total - 3) {
      pages.push('...');
    }
    pages.push(total);
  }

  return pages;
});

function handleAdd() {
  isEdit.value = false;
  modalMode.value = 'add';
  formData.value = {
    id: undefined,
    name: '',
    status: 1,
    remark: '',
    menuIds: [],
  };
  checkedKeys.value = [];
  halfCheckedKeys.value = [];
  expandedKeys.value = [];
  menuSearchText.value = '';
  modalOpen.value = true;
}

function handleEdit(record: any) {
  isEdit.value = true;
  modalMode.value = 'edit';
  formData.value = {
    id: record.id,
    name: record.name,
    status: record.status,
    remark: record.remark,
    menuIds: [],
  };
  checkedKeys.value = [];
  halfCheckedKeys.value = [];
  modalOpen.value = true;
}

function handleAssignPerm(record: any) {
  isEdit.value = true;
  modalMode.value = 'perm';
  const menuIds = (record.menuIds || []).map(String);
  formData.value = {
    id: record.id,
    name: record.name,
    status: record.status,
    remark: record.remark,
    menuIds,
  };
  checkedKeys.value = [...menuIds];
  halfCheckedKeys.value = [];
  expandedKeys.value = [...menuIds];
  menuSearchText.value = '';
  modalOpen.value = true;
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();
    const submitData = {
      ...formData.value,
      menuIds:
        modalMode.value === 'perm'
          ? formData.value.menuIds.map(Number)
          : undefined,
    };
    if (isEdit.value) {
      await updateRole(submitData);
      message.success('修改成功');
    } else {
      await saveRole(submitData);
      message.success('新增成功');
    }
    modalOpen.value = false;
    loadData();
  } catch {
    message.error('保存失败');
  }
}

async function handleDelete(record: any) {
  try {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除角色 "${record.name}" 吗？删除后该角色关联的用户将失去权限。`,
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        await deleteRole(record.id);
        message.success('删除成功');
        loadData();
      },
    });
  } catch {
    message.error('删除失败');
  }
}

async function handleViewUsers(record: any) {
  currentRoleId.value = record.id;
  currentRoleName.value = record.name;
  userModalTitle.value = `角色 "${record.name}" 关联用户`;
  userModalOpen.value = true;
  userModalLoading.value = true;
  try {
    const result = await listUsersByRole(record.id);
    userList.value = result.list;
    userListTotal.value = result.total;
  } catch {
    userList.value = [];
    userListTotal.value = 0;
    message.error('加载用户列表失败');
  } finally {
    userModalLoading.value = false;
  }
}

async function handleOpenAddUsers() {
  addUserModalOpen.value = true;
  addUserModalLoading.value = true;
  selectedUserIds.value = [];
  addUserSearchText.value = '';
  try {
    const result = await listAvailableUsers(currentRoleId.value);
    availableUserList.value = result.list;
  } catch {
    availableUserList.value = [];
    message.error('加载可分配用户失败');
  } finally {
    addUserModalLoading.value = false;
  }
}

const filteredAvailableUsers = computed(() => {
  if (!addUserSearchText.value) return availableUserList.value;
  const kw = addUserSearchText.value.toLowerCase();
  return availableUserList.value.filter((u) =>
    u.name?.toLowerCase().includes(kw),
  );
});

const isAllFilteredSelected = computed(() => {
  const filteredIds = filteredAvailableUsers.value.map((u) => Number(u.id));
  if (filteredIds.length === 0) return false;
  return filteredIds.every((id) => selectedUserIds.value.includes(id));
});

function handleToggleSelectUser(userId: number) {
  const idx = selectedUserIds.value.indexOf(userId);
  if (idx !== -1) {
    selectedUserIds.value.splice(idx, 1);
  } else {
    selectedUserIds.value.push(userId);
  }
}

function handleSelectAllAvailable() {
  const allIds = filteredAvailableUsers.value.map((u) => Number(u.id));
  const allSelected = allIds.every((id) => selectedUserIds.value.includes(id));
  if (allSelected) {
    selectedUserIds.value = selectedUserIds.value.filter(
      (id) => !allIds.includes(id),
    );
  } else {
    const newIds = [...new Set([...selectedUserIds.value, ...allIds])];
    selectedUserIds.value = newIds;
  }
}

async function handleAddUsersSubmit() {
  if (selectedUserIds.value.length === 0) {
    message.warning('请至少选择一个用户');
    return;
  }
  try {
    await addUsersToRole(currentRoleId.value, selectedUserIds.value);
    message.success(`成功添加 ${selectedUserIds.value.length} 位用户`);
    addUserModalOpen.value = false;
    selectedUserIds.value = [];
    handleViewUsers({ id: currentRoleId.value, name: currentRoleName.value });
    loadData();
  } catch {
    message.error('添加用户失败');
  }
}

async function handleRemoveUser(userRecord: any) {
  try {
    Modal.confirm({
      title: '确认移除',
      content: `确定要将用户 "${userRecord.name}" 从角色 "${currentRoleName.value}" 中移除吗？`,
      okText: '确定移除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        await removeUserFromRole(currentRoleId.value, userRecord.id);
        message.success('移除成功');
        userList.value = userList.value.filter((u) => u.id !== userRecord.id);
        userListTotal.value--;
        loadData();
      },
    });
  } catch {
    message.error('移除失败');
  }
}

function handleSearch() {
  currentPage.value = 1;
  loadData();
}

function handleReset() {
  searchName.value = '';
  currentPage.value = 1;
  loadData();
}

const columns = computed(() => [
  {
    title: '角色名称',
    dataIndex: 'name',
    key: 'name',
    width: 160,
    align: 'center' as const,
  },
  { title: '用户数', key: 'userCount', width: 100, align: 'center' as const },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    align: 'center' as const,
  },
  {
    title: '备注',
    dataIndex: 'remark',
    key: 'remark',
    align: 'center' as const,
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
    key: 'createTime',
    width: 170,
    align: 'center' as const,
  },
  {
    title: '操作',
    key: 'action',
    width: 260,
    fixed: 'right' as const,
    align: 'center' as const,
  },
]);
</script>

<template>
  <Page header-class="py-2">
    <!-- 搜索区域 -->
    <div class="mb-4 bg-card rounded-lg shadow-sm">
      <div class="px-6 py-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="flex items-center gap-2">
            <label
              class="text-sm whitespace-nowrap w-20 text-right text-gray-600"
              >角色名称</label>
            <Input
              v-model:value="searchName"
              placeholder="请输入角色名称"
              allow-clear
              class="flex-1"
              @press-enter="handleSearch"
            >
              <template #prefix>
<IconifyIcon icon="mdi:magnify" :size="14" />
</template>
            </Input>
          </div>
          <div class="flex items-center gap-2">
            <Button type="primary" @click="handleSearch">
              <IconifyIcon icon="mdi:magnify" :size="14" class="mr-1" />搜索
            </Button>
            <Button @click="handleReset">
              <IconifyIcon icon="mdi:refresh" :size="14" class="mr-1" />重置
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="bg-card rounded-lg shadow-sm">
      <div
        class="px-6 py-4 flex items-center justify-between border-b border-gray-100"
      >
        <div class="text-base font-semibold text-gray-800">角色列表</div>
        <Button type="primary" @click="handleAdd">
          <IconifyIcon icon="mdi:plus" :size="14" class="mr-1" />新增角色
        </Button>
      </div>
      <div class="px-2 py-2">
        <Table
          :columns="columns"
          :data-source="dataSource"
          :loading="loading"
          :pagination="false"
          row-key="id"
          :scroll="{ x: 900 }"
          size="middle"
          class="data-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <Tag :color="record.status === 1 ? 'green' : 'red'">
                {{ record.status === 1 ? '启用' : '禁用' }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'userCount'">
              <span class="font-medium text-blue-600">{{
                userCountMap[record.id] ?? '-'
              }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <div class="flex items-center justify-center gap-2">
                <a
                  class="text-primary hover:text-primary/80"
                  @click="handleEdit(record)"
                  >编辑</a>
                <a
                  class="text-blue-500 hover:text-blue-600"
                  @click="handleViewUsers(record)"
                  >用户</a>
                <a
                  class="text-indigo-500 hover:text-indigo-600"
                  @click="handleAssignPerm(record)"
                  >授权</a>
                <a
                  class="text-red-500 hover:text-red-600"
                  @click="handleDelete(record)"
                  >删除</a>
              </div>
            </template>
            <template v-else>
              {{ record[column.dataIndex] }}
            </template>
          </template>
        </Table>
      </div>
      <!-- 分页区域 -->
      <div
        class="px-4 py-3 flex items-center justify-between border-t border-gray-100"
      >
        <div class="flex items-center gap-3 text-sm text-gray-500">
          <span>共 {{ total }} 条记录</span>
          <Select
            v-model:value="pageSize"
            style="width: 110px"
            size="small"
            @change="handlePageSizeChange"
          >
            <Select.Option :value="10">10条/页</Select.Option>
            <Select.Option :value="20">20条/页</Select.Option>
            <Select.Option :value="50">50条/页</Select.Option>
          </Select>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentPage === 1"
            @click="handlePageChange(1)"
          >
            <IconifyIcon icon="mdi:chevron-double-left" :size="18" />
          </button>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentPage === 1"
            @click="handlePageChange(currentPage - 1)"
          >
            <IconifyIcon icon="mdi:chevron-left" :size="18" />
          </button>
          <template v-for="p in pageList" :key="p">
            <button
              v-if="p === '...'"
              class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400"
            >
              ...
            </button>
            <button
              v-else
              class="w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-all"
              :class="
                p === currentPage
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'text-gray-600 hover:bg-gray-100'
              "
              @click="handlePageChange(p as number)"
            >
              {{ p }}
            </button>
          </template>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentPage === totalPages"
            @click="handlePageChange(currentPage + 1)"
          >
            <IconifyIcon icon="mdi:chevron-right" :size="18" />
          </button>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentPage === totalPages"
            @click="handlePageChange(totalPages)"
          >
            <IconifyIcon icon="mdi:chevron-double-right" :size="18" />
          </button>
        </div>
      </div>
    </div>

    <!-- 新增/编辑 角色弹窗 -->
    <Modal
      v-model:open="modalOpen"
      :title="
        modalMode === 'perm' ? '分配权限' : isEdit ? '编辑角色' : '新增角色'
      "
      @ok="handleSubmit"
      ok-text="确定"
      cancel-text="取消"
      :width="modalMode === 'perm' ? 640 : 480"
    >
      <Form ref="formRef" :model="formData" layout="vertical">
        <template v-if="modalMode !== 'perm'">
          <Form.Item
            label="角色名称"
            name="name"
            :rules="[{ required: true, message: '请输入角色名称' }]"
          >
            <Input v-model:value="formData.name" placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Switch
              v-model:checked="formData.status"
              checked-children="启用"
              un-checked-children="禁用"
            />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea
              v-model:value="formData.remark"
              placeholder="请输入备注"
              :rows="2"
            />
          </Form.Item>
        </template>
        <template v-if="modalMode === 'perm'">
          <div class="text-sm text-gray-500 mb-2">
            为角色 "{{ formData.name }}" 分配菜单权限
          </div>
          <div
            class="flex flex-col gap-2 border border-gray-200 rounded-md p-3"
          >
            <div class="flex items-center justify-between">
              <Input
                v-model:value="menuSearchText"
                placeholder="搜索菜单"
                allow-clear
                size="small"
                style="width: 200px"
              >
                <template #prefix>
<IconifyIcon icon="mdi:magnify" :size="12" />
</template>
              </Input>
              <div class="flex items-center gap-2">
                <Button size="small" @click="handleExpandAll">展开全部</Button>
                <Button size="small" @click="handleCollapseAll">
折叠全部
</Button>
                <Button size="small" type="primary" @click="handleCheckAll">
全选
</Button>
                <Button size="small" danger @click="handleClearAll">
清空
</Button>
              </div>
            </div>
            <div
              class="max-h-[400px] overflow-auto border-t border-gray-100 pt-2"
            >
              <Tree
                :tree-data="filteredMenuTree"
                :checked-keys="checkedKeys"
                :half-checked-keys="halfCheckedKeys"
                :expanded-keys="expandedKeys"
                checkable
                block-node
                :default-expand-all="true"
                @check="handleCheck"
                @expand="(keys: string[]) => (expandedKeys = keys)"
              >
                <template #title="{ dataRef }">
                  <span class="flex items-center gap-1">
                    <IconifyIcon
                      :icon="dataRef.icon"
                      :size="14"
                      class="text-gray-500"
                    />
                    <span>{{ dataRef.title }}</span>
                    <Tag
                      v-if="dataRef.type === 'button'"
                      color="default"
                      size="small"
                      class="ml-1"
                      >按钮</Tag>
                  </span>
                </template>
              </Tree>
            </div>
            <div class="text-xs text-gray-500 mt-1">
              已选 {{ checkedKeys.length }} 项权限
            </div>
          </div>
        </template>
      </Form>
    </Modal>

    <!-- 角色关联用户弹窗 -->
    <Modal
      v-model:open="userModalOpen"
      :title="userModalTitle"
      :footer="null"
      :width="560"
    >
      <div class="flex items-center justify-between mb-3">
        <div class="text-sm text-gray-500">共 {{ userListTotal }} 位用户</div>
        <Button type="primary" size="small" @click="handleOpenAddUsers">
          <IconifyIcon icon="mdi:plus" :size="12" class="mr-1" />添加用户
        </Button>
      </div>
      <div class="role-user-table-wrapper">
        <Table
          :columns="[
            {
              title: '用户名',
              dataIndex: 'name',
              key: 'name',
              align: 'center' as const,
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              align: 'center' as const,
              width: 80,
            },
            {
              title: '创建时间',
              dataIndex: 'createTime',
              key: 'createTime',
              align: 'center' as const,
              width: 160,
            },
            {
              title: '操作',
              key: 'action',
              align: 'center' as const,
              width: 80,
            },
          ]"
          :data-source="userList"
          :loading="userModalLoading"
          :pagination="false"
          row-key="id"
          size="middle"
          class="data-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <Tag :color="record.status === 1 ? 'green' : 'red'">
                {{ record.status === 1 ? '启用' : '禁用' }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <Button
                size="small"
                type="link"
                danger
                @click="handleRemoveUser(record)"
              >
                移除
              </Button>
            </template>
            <template v-else>
              {{ record[column.dataIndex] }}
            </template>
          </template>
        </Table>
      </div>
    </Modal>

    <!-- 添加用户到角色弹窗 -->
    <Modal
      v-model:open="addUserModalOpen"
      title="添加用户到角色"
      :footer="null"
      :width="500"
    >
      <div class="flex items-center justify-between mb-3">
        <Input
          v-model:value="addUserSearchText"
          placeholder="搜索用户"
          allow-clear
          size="small"
          style="width: 200px"
        >
          <template #prefix>
<IconifyIcon icon="mdi:magnify" :size="12" />
</template>
        </Input>
        <div class="flex items-center gap-2">
          <Button size="small" @click="handleSelectAllAvailable">
            {{ isAllFilteredSelected ? '取消全选' : '全选' }}
          </Button>
          <span class="text-xs text-gray-500">已选 {{ selectedUserIds.length }} 人</span>
        </div>
      </div>
      <div class="border border-gray-200 rounded-md">
        <div class="max-h-[360px] overflow-auto">
          <div
            v-for="user in filteredAvailableUsers"
            :key="user.id"
            class="flex items-center justify-between px-4 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer last:border-b-0"
            :class="{ 'bg-blue-50': selectedUserIds.includes(Number(user.id)) }"
            @click="handleToggleSelectUser(Number(user.id))"
          >
            <div class="flex items-center gap-2">
              <div
                class="w-4 h-4 border rounded flex items-center justify-center transition-all"
                :class="
                  selectedUserIds.includes(Number(user.id))
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300'
                "
              >
                <IconifyIcon
                  v-if="selectedUserIds.includes(Number(user.id))"
                  icon="mdi:check"
                  :size="12"
                  class="text-white"
                />
              </div>
              <IconifyIcon
                icon="mdi:account-circle"
                :size="16"
                class="text-gray-400"
              />
              <span class="text-sm">{{ user.name }}</span>
              <Tag :color="user.status === 1 ? 'green' : 'red'" size="small">
{{
                user.status === 1 ? '启用' : '禁用'
              }}
</Tag>
            </div>
            <span class="text-xs text-gray-400">{{ user.createTime }}</span>
          </div>
          <div
            v-if="filteredAvailableUsers.length === 0 && !addUserModalLoading"
            class="py-8 text-center text-gray-400 text-sm"
          >
            暂无可分配的用户
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <Button @click="addUserModalOpen = false">取消</Button>
        <Button type="primary" @click="handleAddUsersSubmit">确定添加</Button>
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.data-table :deep(.ant-table) {
  border: none;
  border-radius: 0;
}

.data-table :deep(.ant-table-container) {
  border-right: none;
  border-left: none;
  border-radius: 0;
}

.data-table :deep(.ant-table-thead > tr > th) {
  font-size: 12px;
  font-weight: 600;
  color: #323639 !important;
  text-align: center;
  background-color: #f5f7fa !important;
  border-top: none !important;
  border-right: none !important;
  border-bottom: 1px solid #e5e7eb;
  border-left: none !important;
}

.data-table :deep(.ant-table-thead > tr > th:first-child) {
  border-left: none;
}

.data-table :deep(.ant-table-thead > tr > th:last-child) {
  border-right: none;
}

.data-table :deep(.ant-table-tbody > tr > td) {
  font-size: 12px;
  color: #323639;
  text-align: center;
  border-right: none !important;
  border-bottom: 1px solid #f0f0f0;
  border-left: none !important;
}

.data-table :deep(.ant-table-tbody > tr:last-child > td) {
  border-bottom: none;
}

.data-table :deep(.ant-table-tbody > tr:hover > td) {
  background-color: #f8fafc;
}

.role-user-table-wrapper :deep(.ant-table) {
  border-radius: 4px;
}

.role-user-table-wrapper :deep(.ant-btn-link) {
  height: auto;
  padding: 0;
}
</style>
