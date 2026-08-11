<script lang="ts" setup>
import type { Key } from 'ant-design-vue/es/_util/type';

import type { WorkflowFolder } from '#/types/workflow';

import { computed, h, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Tooltip,
  Tree,
} from 'ant-design-vue';

import { useWorkflowStore } from '#/store/workflow';

const store = useWorkflowStore();

const expandedKeys = ref<string[]>([]);
const selectedKeys = ref<string[]>([]);
const editingKey = ref<null | number>(null);
const editingName = ref('');
const loading = ref(false);
const hoveredKey = ref<null | string>(null);

const showModal = ref(false);
const folderName = ref('');
const selectedParentId = ref<number | undefined>(undefined);

const showEditModal = ref(false);
const editingFolderId = ref<null | number>(null);
const editingFolderName = ref('');
const editingParentId = ref<number | undefined>(undefined);

const searchKeyword = ref('');

interface FolderTreeNode {
  key: string;
  title: ReturnType<typeof h>;
  icon: () => ReturnType<typeof h>;
  children?: FolderTreeNode[];
  data: WorkflowFolder;
}

// 折叠/展开图标 - 向下chevron样式
const switcherIcon = (props: any) => {
  const expanded = props.expanded;
  const hasChildren = props.dataRef.children && props.dataRef.children.length > 0;
  if (!hasChildren) return h('span', { style: { width: 16, display: 'inline-block' } });
  return h(IconifyIcon, {
    icon: expanded ? 'mdi:chevron-down' : 'mdi:chevron-right',
    size: 14,
    class: 'text-gray-400 transition-transform duration-200',
  });
};

const treeData = computed<FolderTreeNode[]>(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  return foldersToTree(store.folders, keyword);
});

function expandFirstThreeLevels(folders: WorkflowFolder[], level: number = 0): string[] {
  const keys: string[] = [];
  if (level >= 3) return keys;
  for (const folder of folders) {
    if (level < 3) {
      keys.push(String(folder.id));
    }
    if (folder.children && folder.children.length > 0) {
      keys.push(...expandFirstThreeLevels(folder.children, level + 1));
    }
  }
  return keys;
}

function foldersToTree(folders: WorkflowFolder[], keyword = ''): FolderTreeNode[] {
  const result: FolderTreeNode[] = [];
  for (const folder of folders) {
    const children = folder.children?.length
      ? foldersToTree(folder.children, keyword)
      : [];

    const nameMatch = !keyword || folder.name.toLowerCase().includes(keyword);
    const hasMatchingChild = children.length > 0;

    if (nameMatch || hasMatchingChild) {
      result.push({
        key: String(folder.id),
        title: renderTitle(folder),
        icon: () =>
          h(IconifyIcon, {
            icon: 'mdi:folder',
            size: 16,
            class: 'text-yellow-500',
          }),
        children: children.length ? children : undefined,
        data: folder,
      });
    }
  }
  return result;
}

function renderTitle(folder: WorkflowFolder) {
  if (editingKey.value === folder.id) {
    return h(Input, {
      value: editingName.value,
      onChange: (e: any) => (editingName.value = e.target.value),
      onBlur: handleEditBlur(folder),
      onKeydown: (e: any) => {
        if (e.key === 'Enter') {
          handleEditBlur(folder)(e);
        } else if (e.key === 'Escape') {
          editingKey.value = null;
        }
      },
    });
  }

  return h(
    'div',
    {
      class: 'flex items-center justify-between w-full',
      onMouseenter: () => {
        hoveredKey.value = String(folder.id);
      },
      onMouseleave: () => {
        hoveredKey.value = null;
      },
    },
    [
      h(
        'span',
        { class: 'flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[15px]' },
        folder.name,
      ),
      h(
        'div',
        {
          class: `flex items-center gap-1 transition-opacity duration-200 ${hoveredKey.value === String(folder.id) ? 'opacity-100' : 'opacity-0'}`,
        },
        [
          h(Tooltip, { title: '新建子文件夹' }, () =>
            h(
              Button,
              {
                type: 'text',
                size: 'small',
                onClick: (e: any) => {
                  e.stopPropagation();
                  onCreateFolder(folder.id);
                },
              },
              () => h(IconifyIcon, { icon: 'mdi:plus', size: 14 }),
            ),
          ),
          h(Tooltip, { title: '重命名' }, () =>
            h(
              Button,
              {
                type: 'text',
                size: 'small',
                onClick: (e: any) => {
                  e.stopPropagation();
                  onRenameFolder(folder.id);
                },
              },
              () => h(IconifyIcon, { icon: 'mdi:pencil', size: 14 }),
            ),
          ),
          h(Tooltip, { title: '删除' }, () =>
            h(
              Popconfirm,
              {
                title: '确定删除这个文件夹吗？',
                okText: '确定',
                cancelText: '取消',
                onConfirm: (e: any) => {
                  e?.stopPropagation();
                  onDeleteFolder(folder.id);
                },
              },
              () =>
                h(
                  Button,
                  {
                    type: 'text',
                    size: 'small',
                    danger: true,
                    onClick: (e: any) => e.stopPropagation(),
                  },
                  () => h(IconifyIcon, { icon: 'mdi:trash-can', size: 14 }),
                ),
            ),
          ),
        ],
      ),
    ],
  );
}

function handleEditBlur(folder: WorkflowFolder) {
  return async (_e: FocusEvent) => {
    if (editingName.value.trim()) {
      loading.value = true;
      const success = await store.updateFolderById(
        folder.id,
        editingName.value.trim(),
      );
      loading.value = false;
      if (success) {
        message.success('文件夹已重命名');
      } else {
        message.error('重命名失败');
      }
    }
    editingKey.value = null;
  };
}

function onExpand(keys: Key[]) {
  expandedKeys.value = keys as string[];
}

function onSelect(keys: Key[]) {
  selectedKeys.value = keys as string[];
  const folderId = keys[0] ? Number.parseInt(keys[0] as string) : null;
  store.setSelectedFolderId(folderId);
}

async function handleRefresh() {
  selectedKeys.value = [];
  store.setSelectedFolderId(null);
  await store.loadFolders();
  await store.loadWorkflows();
}

function onCreateFolder(parentId?: number) {
  const tempSelectId =
    selectedKeys.value.length > 0 ? Number(selectedKeys.value[0]) : null;

  folderName.value = '';

  selectedParentId.value = parentId ?? tempSelectId ?? undefined;

  showModal.value = true;
}

function handleCancelCreate() {
  showModal.value = false;
  folderName.value = '';
}

function handleCancelEdit() {
  showEditModal.value = false;
  editingFolderId.value = null;
  editingFolderName.value = '';
  editingParentId.value = undefined;
}

function handleCreateFolder() {
  const name = folderName.value.trim();
  if (!name) {
    message.warning('请输入文件夹名称');
    return;
  }
  loading.value = true;
  const parentId = selectedParentId.value || undefined;
  store
    .createFolder(name, parentId, store.projectId)
    .then((newFolder) => {
      loading.value = false;
      if (newFolder) {
        message.success('文件夹已创建');
      } else {
        message.error('创建失败');
      }
      folderName.value = '';
      showModal.value = false;
    })
    .catch(() => {
      loading.value = false;
      message.error('创建失败');
      folderName.value = '';
      showModal.value = false;
    });
}

function onRenameFolder(folderId?: number) {
  const id =
    folderId ??
    (selectedKeys.value[0] ? Number.parseInt(selectedKeys.value[0]) : null);
  if (id !== null) {
    const folder = store.findFolderById(id);
    if (folder) {
      editingFolderId.value = folder.id;
      editingFolderName.value = folder.name;
      editingParentId.value =
        folder.parentId === 0 ? undefined : folder.parentId;
      showEditModal.value = true;
    }
  }
}

function handleEditFolder() {
  const name = editingFolderName.value.trim();
  if (!name) {
    message.warning('请输入文件夹名称');
    return;
  }
  if (editingFolderId.value === null) {
    return;
  }
  loading.value = true;
  const parentId =
    editingParentId.value === undefined ? 0 : editingParentId.value;
  store
    .updateFolderById(editingFolderId.value, name, store.projectId, parentId)
    .then((success) => {
      loading.value = false;
      if (success) {
        message.success('文件夹已更新');
      } else {
        message.error('更新失败');
      }
      editingFolderId.value = null;
      editingFolderName.value = '';
      editingParentId.value = undefined;
      showEditModal.value = false;
    })
    .catch(() => {
      loading.value = false;
      message.error('更新失败');
      editingFolderId.value = null;
      editingFolderName.value = '';
      editingParentId.value = undefined;
      showEditModal.value = false;
    });
}

async function onDeleteFolder(folderId?: number) {
  const id =
    folderId ??
    (selectedKeys.value[0] ? Number.parseInt(selectedKeys.value[0]) : null);
  if (id !== null) {
    loading.value = true;
    const success = await store.deleteFolderById(id);
    loading.value = false;
    if (success) {
      selectedKeys.value = [];
      message.success('删除成功');
    } else {
      message.error('删除失败');
    }
  }
}

watch(
  selectedKeys,
  (newKeys) => {
    if (!showModal.value) return;
    if (newKeys.length === 0) {
      selectedParentId.value = undefined;
      return;
    }
    const num = Number(newKeys[0]);
    if (!Number.isNaN(num)) {
      selectedParentId.value = num;
    }
  },
  { flush: 'post' },
);

watch(showModal, (isOpen) => {
  if (!isOpen) {
    selectedParentId.value = undefined;
  }
});

watch(
  () => store.projectId,
  () => {
    if (!showModal.value) {
      selectedKeys.value = [];
    }
  },
);

watch(
  () => store.folders,
  (newFolders) => {
    if (newFolders && newFolders.length > 0) {
      expandedKeys.value = expandFirstThreeLevels(newFolders);
    }
  },
  { immediate: true },
);

// 搜索时自动展开匹配的节点
watch(searchKeyword, (keyword) => {
  if (keyword.trim()) {
    expandedKeys.value = getAllMatchingKeys(store.folders, keyword.trim().toLowerCase());
  } else {
    expandedKeys.value = expandFirstThreeLevels(store.folders);
  }
});

function getAllMatchingKeys(folders: WorkflowFolder[], keyword: string, keys: string[] = []): string[] {
  for (const folder of folders) {
    const nameMatch = folder.name.toLowerCase().includes(keyword);
    if (nameMatch) {
      keys.push(String(folder.id));
    }
    if (folder.children?.length) {
      getAllMatchingKeys(folder.children, keyword, keys);
      const hasMatch = folder.children.some(
        (c: any) =>
          c.name.toLowerCase().includes(keyword) ||
          c.children?.some((cc: any) => cc.name.toLowerCase().includes(keyword)),
      );
      if (hasMatch) {
        keys.push(String(folder.id));
      }
    }
  }
  return [...new Set(keys)];
}
</script>

<template>
  <div
    class="flex flex-col h-full bg-card border border-border text-foreground rounded-lg overflow-hidden"
  >
    <div class="px-3 pt-3 pb-0">
      <Input
        v-model:value="searchKeyword"
        placeholder="搜索分组"
        allow-clear
      >
        <template #prefix>
          <IconifyIcon icon="mdi:magnify" :size="14" class="text-gray-400" />
        </template>
      </Input>
      <div class="flex items-center justify-between mt-3 mb-3">
        <h2 class="text-base font-semibold text-foreground">分组</h2>
        <div class="flex items-center gap-1">
          <Tooltip title="刷新">
            <Button
              type="text"
              size="small"
              @click="handleRefresh"
            >
              <IconifyIcon icon="mdi:refresh" :size="16" />
            </Button>
          </Tooltip>
          <Tooltip title="新建文件夹">
            <Button
              type="text"
              size="small"
              @click="onCreateFolder()"
            >
              <IconifyIcon icon="mdi:plus" :size="16" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto px-2 pb-2">
      <Tree
        v-if="treeData.length > 0"
        :expanded-keys="expandedKeys"
        :selected-keys="selectedKeys"
        :tree-data="treeData"
        :switcher-icon="switcherIcon"
        block-node
        @expand="onExpand"
        @select="onSelect"
      />
      <div v-else class="text-center py-8 text-gray-400 text-sm">
        {{ searchKeyword ? '未找到匹配的分组' : '暂无分组' }}
      </div>
    </div>

    <Modal
      v-model:open="showModal"
      title="新建分组"
      ok-text="确定"
      cancel-text="取消"
      :confirm-loading="loading"
      @ok="handleCreateFolder"
      @cancel="handleCancelCreate"
    >
      <Form :model="{ folderName, selectedParentId }" layout="vertical">
        <Form.Item label="项目">
          <Input
            :value="
              store.projects.find((p) => p.id === store.projectId)
                ?.projectName || '-'
            "
            disabled
            class="bg-gray-50"
          />
        </Form.Item>
        <Form.Item label="父分组">
          <Select
            v-model:value="selectedParentId"
            placeholder="根文件夹"
            style="width: 100%"
            allow-clear
          >
            <Select.Option :value="undefined" key="root">
              根文件夹
            </Select.Option>
            <template
              v-for="folder in store.folders"
              :key="`folder-${folder.id}`"
            >
              <Select.Option :value="folder.id">
                {{ folder.name }}
              </Select.Option>
              <template
                v-for="child in folder.children"
                :key="`child-${child.id}`"
              >
                <Select.Option :value="child.id">
                  ├── {{ child.name }}
                </Select.Option>
              </template>
            </template>
          </Select>
        </Form.Item>
        <Form.Item label="文件夹名称">
          <Input
            v-model:value="folderName"
            placeholder="请输入文件夹名称"
            @keyup.enter="handleCreateFolder"
          />
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="showEditModal"
      title="编辑分组"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="loading"
      @ok="handleEditFolder"
      @cancel="handleCancelEdit"
    >
      <Form :model="{ editingFolderName, editingParentId }" layout="vertical">
        <Form.Item label="项目">
          <Input
            :value="
              store.projects.find((p) => p.id === store.projectId)
                ?.projectName || '-'
            "
            disabled
            class="bg-gray-50"
          />
        </Form.Item>
        <Form.Item label="父分组">
          <Select
            v-model:value="editingParentId"
            placeholder="根文件夹"
            style="width: 100%"
            allow-clear
          >
            <Select.Option :value="undefined" key="root">
              根文件夹
            </Select.Option>
            <template
              v-for="folder in store.folders"
              :key="`folder-${folder.id}`"
            >
              <Select.Option :value="folder.id">
                {{ folder.name }}
              </Select.Option>
              <template
                v-for="child in folder.children"
                :key="`child-${child.id}`"
              >
                <Select.Option :value="child.id">
                  ├── {{ child.name }}
                </Select.Option>
              </template>
            </template>
          </Select>
        </Form.Item>
        <Form.Item label="文件夹名称">
          <Input
            v-model:value="editingFolderName"
            placeholder="请输入文件夹名称"
            @keyup.enter="handleEditFolder"
          />
        </Form.Item>
      </Form>
    </Modal>
  </div>
</template>

<style scoped>
:deep(.ant-tree .ant-tree-node-content-wrapper) {
  font-size: 15px;
}
</style>
