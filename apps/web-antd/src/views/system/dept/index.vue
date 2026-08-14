<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { Table, Button, Input, Tag, Modal, Form, Switch, Select, message } from 'ant-design-vue';
import { listDepts, saveDept, updateDept, deleteDept } from '#/api/core/system';

const loading = ref(false);
const rawTreeData = ref<any[]>([]);
const searchName = ref('');

const modalOpen = ref(false);
const isEdit = ref(false);
const formRef = ref();
const formData = ref({ id: undefined as number | undefined, pid: 0, name: '', status: 1, remark: '' });

onMounted(() => {
  loadData();
});

async function loadData() {
  loading.value = true;
  try {
    rawTreeData.value = await listDepts();
  } catch (e) {
    message.error('加载部门列表失败');
  } finally {
    loading.value = false;
  }
}

const tableData = computed(() => {
  const keyword = searchName.value.trim().toLowerCase();
  if (!keyword) {
    return rawTreeData.value;
  }
  const filterTree = (nodes: any[]): any[] => {
    return nodes
      .map(node => {
        const children = filterTree(node.children || []);
        const nameMatch = node.name?.toLowerCase().includes(keyword);
        if (nameMatch || children.length) {
          return { ...node, children };
        }
        return null;
      })
      .filter(Boolean);
  };
  return filterTree(rawTreeData.value);
});

function handleAdd(parentId?: number) {
  isEdit.value = false;
  formData.value = { id: undefined, pid: parentId || 0, name: '', status: 1, remark: '' };
  modalOpen.value = true;
}

function handleEdit(record: any) {
  isEdit.value = true;
  formData.value = { id: record.id, pid: record.pid, name: record.name, status: record.status, remark: record.remark };
  modalOpen.value = true;
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();
    if (isEdit.value) {
      await updateDept(formData.value);
      message.success('修改成功');
    } else {
      await saveDept(formData.value);
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
      content: `确定要删除部门 "${record.name}" 吗？删除后子部门将移至上级部门。`,
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        await deleteDept(record.id);
        message.success('删除成功');
        loadData();
      },
    });
  } catch (e) {
    message.error('删除失败');
  }
}

function handleSearch() {
  searchName.value = searchName.value;
}

function handleReset() {
  searchName.value = '';
}

const columns = computed(() => [
  { title: '部门名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100, align: 'center' as const },
  { title: '备注', dataIndex: 'remark', key: 'remark', align: 'center' as const },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 170, align: 'center' as const },
  { title: '操作', key: 'action', width: 280, align: 'center' as const },
]);
</script>

<template>
  <Page header-class="py-2">
    <!-- 搜索区域 -->
    <div class="mb-4 bg-card rounded-lg shadow-sm">
      <div class="px-6 py-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="flex items-center gap-2">
            <label class="text-sm whitespace-nowrap w-20 text-right text-gray-600">部门名称</label>
            <Input v-model:value="searchName" placeholder="请输入部门名称" allow-clear class="flex-1" @press-enter="handleSearch">
              <template #prefix><IconifyIcon icon="mdi:magnify" :size="14" /></template>
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
      <div class="px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <div class="text-base font-semibold text-gray-800">部门列表</div>
        <Button type="primary" @click="handleAdd()">
          <IconifyIcon icon="mdi:plus" :size="14" class="mr-1" />新增部门
        </Button>
      </div>
      <div class="px-2 py-2">
        <Table
          :columns="columns"
          :data-source="tableData"
          :loading="loading"
          :pagination="false"
          :row-key="'id'"
          :scroll="{ x: 900 }"
          :expandable="{ defaultExpandAllRows: true, expandIconPosition: 'start' }"
          size="middle"
          class="data-table dept-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="flex items-center gap-1">
                <IconifyIcon icon="mdi:folder" :size="14" class="text-blue-500" />
                <span class="text-sm font-medium text-gray-800">{{ record.name }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'status'">
              <Tag :color="record.status === 1 ? 'green' : 'red'">
                {{ record.status === 1 ? '启用' : '禁用' }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <div class="flex items-center justify-center gap-2">
                <a class="text-primary hover:text-primary/80" @click="handleAdd(record.id)">添加子部门</a>
                <a class="text-indigo-500 hover:text-indigo-600" @click="handleEdit(record)">编辑</a>
                <a class="text-red-500 hover:text-red-600" @click="handleDelete(record)">删除</a>
              </div>
            </template>
            <template v-else>
              {{ record[column.dataIndex] }}
            </template>
          </template>
        </Table>
      </div>
    </div>

    <Modal
      v-model:open="modalOpen"
      :title="isEdit ? '编辑部门' : '新增部门'"
      @ok="handleSubmit"
      ok-text="确定"
      cancel-text="取消"
    >
      <Form ref="formRef" :model="formData" layout="vertical">
        <Form.Item label="部门名称" name="name" :rules="[{ required: true, message: '请输入部门名称' }]">
          <Input v-model:value="formData.name" placeholder="请输入部门名称" />
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

.data-table :deep(.ant-table-tbody > tr > td:first-child) {
  text-align: left;
}
</style>
