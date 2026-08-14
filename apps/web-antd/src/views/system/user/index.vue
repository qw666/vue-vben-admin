<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { Table, Button, Input, Tag, Modal, Form, Select, Switch, message } from 'ant-design-vue';
import { listUsers, saveUser, updateUser, deleteUser, listDepts } from '#/api/core/system';

const loading = ref(false);
const dataSource = ref<any[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const searchName = ref('');
const searchStatus = ref<number | undefined>(undefined);

const deptList = ref<any[]>([]);

const modalOpen = ref(false);
const isEdit = ref(false);
const formRef = ref();
const formData = ref({
  id: undefined as string | undefined,
  name: '',
  password: '',
  status: 1,
  deptId: undefined as string | undefined,
  remark: '',
});

onMounted(() => {
  loadData();
  loadDepts();
});

async function loadData() {
  loading.value = true;
  try {
    const result = await listUsers({
      page: currentPage.value,
      pageSize: pageSize.value,
      name: searchName.value || undefined,
      status: searchStatus.value,
    });
    dataSource.value = result.list;
    total.value = result.total;
  } catch (e) {
    message.error('加载用户列表失败');
  } finally {
    loading.value = false;
  }
}

async function loadDepts() {
  try {
    deptList.value = await listDepts();
  } catch (e) {
    console.error('加载部门列表失败', e);
  }
}

function flattenDepts(data: any[], level = 0): any[] {
  return data.flatMap(item => [
    { value: String(item.id), label: item.name },
    ...(item.children ? flattenDepts(item.children, level + 1) : []),
  ]);
}

const deptOptions = computed(() => flattenDepts(deptList.value));

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
  formData.value = { id: undefined, name: '', password: '', status: 1, deptId: undefined, remark: '' };
  modalOpen.value = true;
}

function handleEdit(record: any) {
  isEdit.value = true;
  formData.value = {
    id: record.id,
    name: record.name,
    password: '',
    status: record.status,
    deptId: record.deptId,
    remark: record.remark,
  };
  modalOpen.value = true;
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();
    if (isEdit.value) {
      await updateUser(formData.value);
      message.success('修改成功');
    } else {
      await saveUser(formData.value);
      message.success('新增成功');
    }
    modalOpen.value = false;
    loadData();
  } catch (e) {
    message.error('保存失败');
  }
}

async function handleDelete(record: any) {
  try {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户 "${record.name}" 吗？此操作不可恢复。`,
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        await deleteUser(record.id);
        message.success('删除成功');
        loadData();
      },
    });
  } catch (e) {
    message.error('删除失败');
  }
}

function handleSearch() {
  currentPage.value = 1;
  loadData();
}

function handleReset() {
  searchName.value = '';
  searchStatus.value = undefined;
  currentPage.value = 1;
  loadData();
}

const columns = computed(() => [
  { title: '用户ID', dataIndex: 'id', key: 'id', width: 180, align: 'center' as const },
  { title: '用户名', dataIndex: 'name', key: 'name', width: 150, align: 'center' as const },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100, align: 'center' as const },
  { title: '部门', dataIndex: 'deptName', key: 'deptName', width: 120, align: 'center' as const },
  { title: '备注', dataIndex: 'remark', key: 'remark', align: 'center' as const },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 180, align: 'center' as const },
  { title: '操作', key: 'action', width: 180, fixed: 'right' as const, align: 'center' as const },
]);
</script>

<template>
  <Page header-class="py-2">
    <!-- 搜索区域 -->
    <div class="mb-4 bg-card rounded-lg shadow-sm">
      <div class="px-6 py-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="flex items-center gap-2">
            <label class="text-sm whitespace-nowrap w-20 text-right text-gray-600">用户名</label>
            <Input v-model:value="searchName" placeholder="请输入用户名" allow-clear class="flex-1" @press-enter="handleSearch">
              <template #prefix><IconifyIcon icon="mdi:magnify" :size="14" /></template>
            </Input>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm whitespace-nowrap w-20 text-right text-gray-600">状态</label>
            <Select
              v-model:value="searchStatus"
              placeholder="请选择状态"
              allow-clear
              class="flex-1"
              :options="[
                { value: 1, label: '启用' },
                { value: 0, label: '禁用' },
              ]"
            />
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
      <div class="px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <div class="text-base font-semibold text-gray-800">用户列表</div>
        <Button type="primary" @click="handleAdd">
          <IconifyIcon icon="mdi:plus" :size="14" class="mr-1" />新增用户
        </Button>
      </div>
      <div class="px-2 py-2">
        <Table
          :columns="columns"
          :data-source="dataSource"
          :loading="loading"
          :pagination="false"
          :scroll="{ x: 1100 }"
          :row-key="'id'"
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
              <div class="flex items-center justify-center gap-2">
                <a class="text-primary hover:text-primary/80" @click="handleEdit(record)">编辑</a>
                <a class="text-red-500 hover:text-red-600" @click="handleDelete(record)">删除</a>
              </div>
            </template>
            <template v-else>
              {{ record[column.dataIndex] }}
            </template>
          </template>
        </Table>
      </div>
      <!-- 分页区域 -->
      <div class="px-4 py-3 flex items-center justify-between border-t border-gray-100">
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
              :class="p === currentPage
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'text-gray-600 hover:bg-gray-100'"
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

    <Modal
      v-model:open="modalOpen"
      :title="isEdit ? '编辑用户' : '新增用户'"
      @ok="handleSubmit"
      ok-text="确定"
      cancel-text="取消"
      :width="560"
    >
      <Form ref="formRef" :model="formData" layout="vertical">
        <Form.Item label="用户名" name="name" :rules="[{ required: true, message: '请输入用户名' }]">
          <Input v-model:value="formData.name" placeholder="请输入用户名" :disabled="isEdit" />
        </Form.Item>
        <Form.Item v-if="!isEdit" label="密码" name="password" :rules="[{ required: true, message: '请输入密码' }]">
          <Input.Password v-model:value="formData.password" placeholder="请输入密码" />
        </Form.Item>
        <Form.Item label="部门" name="deptId">
          <Select v-model:value="formData.deptId" placeholder="请选择部门" allow-clear :options="deptOptions" />
        </Form.Item>
        <Form.Item label="状态" name="status">
          <Switch v-model:checked="formData.status" checked-children="启用" un-checked-children="禁用" />
        </Form.Item>
        <Form.Item label="备注" name="remark">
          <Input.TextArea v-model:value="formData.remark" placeholder="请输入备注" :rows="2" />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.data-table :deep(.ant-table) {
  border: none;
  border-radius: 0;
}

.data-table :deep(.ant-table-container) {
  border-left: none;
  border-right: none;
  border-radius: 0;
}

.data-table :deep(.ant-table-thead > tr > th) {
  background-color: #f5f7fa !important;
  color: #323639 !important;
  font-weight: 600;
  font-size: 12px;
  text-align: center;
  border-bottom: 1px solid #e5e7eb;
  border-left: none !important;
  border-right: none !important;
  border-top: none !important;
}

.data-table :deep(.ant-table-thead > tr > th:first-child) {
  border-left: none;
}

.data-table :deep(.ant-table-thead > tr > th:last-child) {
  border-right: none;
}

.data-table :deep(.ant-table-tbody > tr > td) {
  color: #323639;
  font-size: 12px;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
  border-left: none !important;
  border-right: none !important;
}

.data-table :deep(.ant-table-tbody > tr:last-child > td) {
  border-bottom: none;
}

.data-table :deep(.ant-table-tbody > tr:hover > td) {
  background-color: #f8fafc;
}
</style>
