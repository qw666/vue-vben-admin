<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import { deleteMenu, listMenus, saveMenu, updateMenu } from '#/api/core/system';

import IconPicker from '../components/IconPicker.vue';

const treeData = ref<any[]>([]);
const loading = ref(false);
const searchName = ref('');
const searchType = ref<string | undefined>(undefined);

const modalOpen = ref(false);
const isEdit = ref(false);
const iconPickerOpen = ref(false);
const formRef = ref();

// 标记用户是否手动修改过 component
let isComponentManual = false;

const formData = ref({
  id: undefined as number | undefined,
  pid: 0,
  name: '',
  metaTitle: '',
  path: '',
  component: '',
  type: 'menu' as string,
  status: 1,
  authCode: '',
  sort: 0,
  icon: '',
  isKeepAlive: false,
  isHide: false,
});

// 监听 path 和 type 变化，自动推断 component（仅在用户未手动修改时）
watch(
  () => [formData.value.path, formData.value.type],
  ([path, type]) => {
    if (!isComponentManual) {
      formData.value.component = inferComponent(path as string, type as string);
    }
  },
);

// 根据 path 和 type 推断 component
// 统一规则：component = 去掉父路径 + /index
// - catalog: BasicLayout
// - 一级菜单: /home -> /home/index
// - 二级菜单: /system/user -> /user/index
function inferComponent(path: string, type: string): string {
  if (!path) return '';
  if (type === 'catalog') {
    return 'BasicLayout';
  }
  if (type === 'menu') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const segments = normalizedPath.split('/').filter(Boolean);
    // 去掉第一段父路径，剩余部分 + /index
    const childParts = segments.length > 1 ? segments.slice(1) : segments;
    return `/${childParts.join('/')}/index`;
  }
  return '';
}

onMounted(() => {
  loadData();
});

async function loadData() {
  loading.value = true;
  try {
    const menus = await listMenus();
    treeData.value = menus;
  } catch {
    message.error('加载菜单列表失败');
  } finally {
    loading.value = false;
  }
}

function flattenMenuData(data: any[]): any[] {
  return data.map((item) => ({
    ...item,
    key: item.id,
    children: item.children ? flattenMenuData(item.children) : [],
  }));
}

const filteredTreeData = computed(() => {
  let data = treeData.value;
  if (searchName.value || searchType.value) {
    const filterTree = (nodes: any[]): any[] => {
      return nodes
        .map((node) => {
          const children = filterTree(node.children || []);
          const meta = node.meta || {};
          const title = meta.title || node.name;
          const nameMatch =
            !searchName.value ||
            (title &&
              title.toLowerCase().includes(searchName.value.toLowerCase()));
          const typeMatch = !searchType.value || node.type === searchType.value;
          if (nameMatch && typeMatch) {
            return { ...node, children };
          }
          if (children.length > 0) {
            return { ...node, children };
          }
          return null;
        })
        .filter(Boolean);
    };
    data = filterTree(data);
  }
  return flattenMenuData(data);
});

function getMenuTypeTag(type: string) {
  const map: Record<string, { color: string; text: string }> = {
    catalog: { color: 'blue', text: '目录' },
    menu: { color: 'green', text: '菜单' },
    button: { color: 'default', text: '按钮' },
  };
  const item = map[type] || { color: 'default', text: type };
  return { color: item.color, text: item.text };
}

function getMenuIcon(icon: string) {
  return icon || 'mdi:circle';
}

function handleAdd(parentId?: number) {
  isEdit.value = false;
  isComponentManual = false;
  formData.value = {
    id: undefined,
    pid: parentId || 0,
    name: '',
    metaTitle: '',
    path: '',
    component: '',
    type: parentId ? 'menu' : 'catalog',
    status: 1,
    authCode: '',
    sort: 0,
    icon: '',
    isKeepAlive: false,
    isHide: false,
  };
  modalOpen.value = true;
}

function handleEdit(record: any) {
  isEdit.value = true;
  isComponentManual = false;
  const meta = record.meta || {};
  formData.value = {
    id: record.id,
    pid: record.pid,
    name: record.name,
    metaTitle: meta.title || record.name,
    path: record.path,
    component: record.component,
    type: record.type,
    status: record.status,
    authCode: record.authCode,
    sort: record.sort,
    icon: meta.icon || '',
    isKeepAlive: meta.isKeepAlive || false,
    isHide: meta.isHide || false,
  };
  modalOpen.value = true;
}

// 标记用户手动修改过 component
function handleComponentChange() {
  isComponentManual = true;
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();

    // 新增时自动生成 name（基于 path），确保后端 @NotBlank 校验通过
    let name = formData.value.name;
    if (!isEdit.value && !name) {
      name = generateNameByPath(formData.value.path);
      if (!name) {
        message.error('请先填写路由路径');
        return;
      }
    }

    const payload: any = {
      id: formData.value.id,
      pid: formData.value.pid,
      name,
      path: formData.value.path,
      component: formData.value.component,
      type: formData.value.type,
      status: formData.value.status,
      authCode: formData.value.authCode,
      sort: formData.value.sort,
      metaJson: JSON.stringify({
        title: formData.value.metaTitle,
        icon: formData.value.icon,
        isKeepAlive: formData.value.isKeepAlive,
        isHide: formData.value.isHide,
      }),
    };

    if (isEdit.value) {
      await updateMenu(payload);
      message.success('修改成功');
    } else {
      await saveMenu(payload);
      message.success('新增成功');
    }
    modalOpen.value = false;
    loadData();
  } catch {
    message.error('保存失败');
  }
}

// 根据 path 生成英文 name
function generateNameByPath(path: string): string {
  if (!path) return '';
  // 移除开头的 /，分割路径
  const parts = path.replace(/^\//, '').split('/').filter(Boolean);
  // 转换为大驼峰
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

async function handleDelete(record: any) {
  try {
    const meta = record.meta || {};
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除菜单 "${meta.title || record.name}" 吗？删除后其下属子菜单也会被移除。`,
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        await deleteMenu(record.id);
        message.success('删除成功');
        loadData();
      },
    });
  } catch {
    message.error('删除失败');
  }
}

function handleSearch() {
  // filteredTreeData is computed automatically
}

function handleReset() {
  searchName.value = '';
  searchType.value = undefined;
}

const columns = computed(() => [
  {
    title: '菜单名称',
    dataIndex: 'metaTitle',
    key: 'metaTitle',
    width: 280,
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 80,
    align: 'center' as const,
  },
  {
    title: '图标',
    dataIndex: 'meta',
    key: 'icon',
    width: 60,
    align: 'center' as const,
  },
  {
    title: '路由路径',
    dataIndex: 'path',
    key: 'path',
    width: 180,
    align: 'center' as const,
  },
  {
    title: '组件路径',
    dataIndex: 'component',
    key: 'component',
    width: 200,
    align: 'center' as const,
  },
  {
    title: '权限码',
    dataIndex: 'authCode',
    key: 'authCode',
    width: 160,
    align: 'center' as const,
  },
  {
    title: '排序',
    dataIndex: 'sort',
    key: 'sort',
    width: 70,
    align: 'center' as const,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    align: 'center' as const,
  },
  {
    title: '操作',
    key: 'action',
    width: 200,
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
              >菜单名称</label>
            <Input
              v-model:value="searchName"
              placeholder="请输入菜单名称"
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
            <label
              class="text-sm whitespace-nowrap w-20 text-right text-gray-600"
              >菜单类型</label>
            <Select
              v-model:value="searchType"
              placeholder="请选择类型"
              allow-clear
              class="flex-1"
              :options="[
                { value: 'catalog', label: '目录' },
                { value: 'menu', label: '菜单' },
                { value: 'button', label: '按钮' },
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
      <div
        class="px-6 py-4 flex items-center justify-between border-b border-gray-100"
      >
        <div class="text-base font-semibold text-gray-800">菜单列表</div>
        <Button type="primary" @click="handleAdd()">
          <IconifyIcon icon="mdi:plus" :size="14" class="mr-1" />新增菜单
        </Button>
      </div>
      <div class="px-2 py-2">
        <Table
          :columns="columns"
          :data-source="filteredTreeData"
          :loading="loading"
          row-key="key"
          :pagination="false"
          :scroll="{ x: 1400 }"
          :expandable="{
            defaultExpandAllRows: true,
            expandIconPosition: 'start',
          }"
          size="middle"
          class="data-table menu-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'metaTitle'">
              <div class="flex items-center gap-2">
                <Tag :color="getMenuTypeTag(record.type).color">
                  {{ getMenuTypeTag(record.type).text }}
                </Tag>
                <span class="font-medium">{{
                  record.meta?.title || record.name
                }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'type'">
              <Tag :color="getMenuTypeTag(record.type).color">
                {{ getMenuTypeTag(record.type).text }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'icon'">
              <IconifyIcon
                :icon="getMenuIcon(record.meta?.icon)"
                :size="18"
                class="text-gray-600"
              />
            </template>
            <template v-else-if="column.key === 'status'">
              <Tag :color="record.status === 1 ? 'green' : 'red'">
                {{ record.status === 1 ? '启用' : '禁用' }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <div class="flex items-center justify-center gap-2">
                <a
                  class="text-primary hover:text-primary/80"
                  @click="handleAdd(record.id)"
                  >新增</a>
                <a
                  class="text-gray-600 hover:text-gray-800"
                  @click="handleEdit(record)"
                  >编辑</a>
                <a
                  class="text-red-500 hover:text-red-600"
                  @click="handleDelete(record)"
                  >删除</a>
              </div>
            </template>
            <template v-else-if="column.key === 'sort'">
              {{ record.sort ?? 0 }}
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
      :title="isEdit ? '编辑菜单' : '新增菜单'"
      @ok="handleSubmit"
      ok-text="确定"
      cancel-text="取消"
      :width="640"
    >
      <Form ref="formRef" :model="formData" layout="vertical">
        <Form.Item label="上级菜单" name="pid">
          <Select
            v-model:value="formData.pid"
            placeholder="顶级菜单"
            :options="[{ value: 0, label: '顶级菜单' }]"
          />
        </Form.Item>
        <div class="grid grid-cols-2 gap-4">
          <Form.Item
            label="菜单名称"
            name="metaTitle"
            :rules="[{ required: true, message: '请输入菜单名称' }]"
          >
            <Input
              v-model:value="formData.metaTitle"
              placeholder="请输入菜单名称"
            />
          </Form.Item>
          <Form.Item label="路由标识" name="name" v-if="isEdit">
            <Input
              v-model:value="formData.name"
              disabled
              placeholder="系统自动生成"
            />
          </Form.Item>
          <Form.Item label="菜单类型" name="type" v-else>
            <Select
              v-model:value="formData.type"
              :options="[
                { value: 'catalog', label: '目录' },
                { value: 'menu', label: '菜单' },
                { value: 'button', label: '按钮' },
              ]"
            />
          </Form.Item>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <Form.Item label="路由路径" name="path">
            <Input v-model:value="formData.path" placeholder="/example/path" />
          </Form.Item>
          <Form.Item
            label="组件路径"
            name="component"
            v-if="formData.type !== 'button'"
          >
            <Input
              v-model:value="formData.component"
              placeholder="/example/index"
              @change="handleComponentChange"
            />
          </Form.Item>
          <Form.Item label="权限码" name="authCode" v-else>
            <Input
              v-model:value="formData.authCode"
              placeholder="system:user:add"
            />
          </Form.Item>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <Form.Item label="图标" name="icon">
            <div class="flex items-center gap-2">
              <div
                class="flex items-center justify-center w-10 h-10 border border-gray-300 rounded cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                @click="iconPickerOpen = true"
              >
                <IconifyIcon
                  :icon="formData.icon || 'mdi:plus'"
                  :size="20"
                  class="text-gray-500"
                />
              </div>
              <Input
                v-model:value="formData.icon"
                placeholder="点击左侧按钮选择图标"
                readonly
                @click="iconPickerOpen = true"
              >
                <template #suffix>
                  <IconifyIcon
                    v-if="formData.icon"
                    icon="mdi:close"
                    :size="14"
                    class="cursor-pointer text-gray-400 hover:text-red-500"
                    @click="formData.icon = ''"
                  />
                </template>
              </Input>
            </div>
          </Form.Item>
          <Form.Item label="排序" name="sort">
            <InputNumber
              v-model:value="formData.sort"
              :min="0"
              style="width: 100%"
            />
          </Form.Item>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <Form.Item label="状态" name="status">
            <Switch
              v-model:checked="formData.status"
              checked-children="启用"
              un-checked-children="禁用"
            />
          </Form.Item>
          <Form.Item label="缓存" name="isKeepAlive">
            <Switch v-model:checked="formData.isKeepAlive" />
          </Form.Item>
        </div>
        <Form.Item label="隐藏" name="isHide">
          <Switch v-model:checked="formData.isHide" />
        </Form.Item>
      </Form>
    </Modal>

    <IconPicker
      v-model:model-value="formData.icon"
      v-model:visible="iconPickerOpen"
      @change="(val: string) => (formData.icon = val)"
    />
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
</style>
