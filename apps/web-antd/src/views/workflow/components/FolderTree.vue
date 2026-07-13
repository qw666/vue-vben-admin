<script lang="ts" setup>
import { ref, computed, onMounted, h, watch } from 'vue';

import { Tree, Button, message, Popconfirm, Tooltip, Input, Modal, Form, Select } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import { useWorkflowStore } from '#/store/workflow';

const store = useWorkflowStore();

const expandedKeys = ref<number[]>([]);
const selectedKeys = ref<string[]>([]);
const editingKey = ref<number | null>(null);
const editingName = ref('');
const loading = ref(false);
const hoveredKey = ref<string | null>(null);

const showModal = ref(false);
const folderName = ref('');
const selectedProjectId = ref<number>(1);
const selectedParentId = ref<number | null>(null);

const treeData = computed(() => {
  return foldersToTree(store.folders);
});

function foldersToTree(folders: any[]): any[] {
  return folders.map((folder) => ({
    key: String(folder.id),
    title: renderTitle(folder),
    icon: () => h(IconifyIcon, { icon: 'mdi:folder', size: 16, class: 'text-yellow-500' }),
    children: folder.children?.length ? foldersToTree(folder.children) : undefined,
    data: folder,
  }));
}

function renderTitle(folder: any) {
  if (editingKey.value === folder.id) {
    return h(Input, {
      value: editingName.value,
      onChange: (e: any) => (editingName.value = e.target.value),
      onBlur: handleEditBlur(folder),
      onKeydown: (e: any) => {
        if (e.key === 'Enter') {
          handleEditBlur(folder)();
        } else if (e.key === 'Escape') {
          editingKey.value = null;
        }
      },
    });
  }

  return h('div', {
    class: 'flex items-center justify-between w-full',
    onMouseenter: () => { hoveredKey.value = String(folder.id); },
    onMouseleave: () => { hoveredKey.value = null; },
  }, [
    h('span', { class: 'flex-1 overflow-hidden text-ellipsis whitespace-nowrap' }, folder.name),
    h('div', {
      class: `flex items-center gap-1 transition-opacity duration-200 ${hoveredKey.value === String(folder.id) ? 'opacity-100' : 'opacity-0'}`,
    }, [
      h(Tooltip, { title: '新建子文件夹' }, () =>
        h(Button, {
          type: 'text',
          size: 'small',
          onClick: (e: any) => {
            e.stopPropagation();
            onCreateFolder(folder.id);
          }
        }, () => h(IconifyIcon, { icon: 'mdi:plus', size: 14 }))
      ),
      h(Tooltip, { title: '重命名' }, () =>
        h(Button, {
          type: 'text',
          size: 'small',
          onClick: (e: any) => {
            e.stopPropagation();
            onRenameFolder(folder.id);
          }
        }, () => h(IconifyIcon, { icon: 'mdi:pencil', size: 14 }))
      ),
      h(Tooltip, { title: '删除' }, () =>
        h(Popconfirm, {
          title: '确定删除这个文件夹吗？',
          okText: '确定',
          cancelText: '取消',
          onConfirm: (e: any) => {
            e?.stopPropagation();
            onDeleteFolder(folder.id);
          }
        }, () =>
          h(Button, {
            type: 'text',
            size: 'small',
            danger: true,
            onClick: (e: any) => e.stopPropagation(),
          }, () => h(IconifyIcon, { icon: 'mdi:trash-can', size: 14 }))
        )
      ),
    ]),
  ]);
}

async function handleEditBlur(folder: any) {
  return async () => {
    if (editingName.value.trim()) {
      loading.value = true;
      const success = await store.updateFolderById(folder.id, editingName.value.trim());
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

function onExpand(expandedKeysValue: number[]) {
  expandedKeys.value = expandedKeysValue;
}

function onSelect(selectedKeysValue: string[]) {
  selectedKeys.value = selectedKeysValue;
  const folderId = selectedKeysValue[0] ? parseInt(selectedKeysValue[0]) : null;
  store.setSelectedFolderId(folderId);
}

function onCreateFolder(parentId?: number) {
  const tempSelectId = selectedKeys.value.length ? Number(selectedKeys.value[0]) : null;

  folderName.value = '';
  selectedProjectId.value = store.projectId;

  if (parentId !== undefined) {
    selectedParentId.value = parentId;
  } else {
    selectedParentId.value = tempSelectId;
  }

  // 【最关键修复】彻底删除 loadProjects / loadFolders
  // 避免 projectId 变更导致弹窗关闭、选中清空

  showModal.value = true;
}

async function handleCreateFolder() {
  if (!folderName.value.trim()) {
    message.warning('请输入文件夹名称');
    return;
  }
  loading.value = true;
  const parentId = selectedParentId.value || undefined;
  const newFolder = await store.createFolder(folderName.value.trim(), parentId, store.projectId);
  loading.value = false;
  if (newFolder) {
    expandedKeys.value = [...expandedKeys.value, newFolder.id];
    selectedKeys.value = [String(newFolder.id)];
    message.success('文件夹已创建');
    // 创建后自动刷新一次树
    store.loadFolders();
  } else {
    message.error('创建失败');
  }
  showModal.value = false;
}

function onRenameFolder(folderId?: number) {
  const id = folderId ?? (selectedKeys.value[0] ? parseInt(selectedKeys.value[0]) : null);
  if (id !== null) {
    const folder = store.findFolderById(id);
    if (folder) {
      editingKey.value = folder.id;
      editingName.value = folder.name;
    }
  }
}

async function onDeleteFolder(folderId?: number) {
  const id = folderId ?? (selectedKeys.value[0] ? parseInt(selectedKeys.value[0]) : null);
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

// 弹窗打开期间实时同步选中
watch(selectedKeys, (newKeys) => {
  if (!showModal.value) return;
  if (!newKeys.length) {
    selectedParentId.value = null;
    return;
  }
  const num = Number(newKeys[0]);
  if (!Number.isNaN(num)) {
    selectedParentId.value = num;
  }
}, { flush: 'post' });

// 关闭弹窗清空
watch(showModal, (isOpen) => {
  if (!isOpen) {
    selectedParentId.value = null;
    folderName.value = '';
  }
});

// ==========【终极修复】重写 projectId 监听 ==========
// 弹窗打开时，禁止关闭弹窗、禁止清空选中
watch(() => store.projectId, () => {
  if (!showModal.value) {
    selectedKeys.value = [];
  }
});

onMounted(() => {
  store.loadFolders();
  store.loadProjects();
});
</script>

<template>
  <div class="flex flex-col h-full bg-card border-r border-border text-foreground">
    <div class="p-4 border-b border-border flex-1 overflow-y-auto">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-foreground">分组</h2>
        <Button type="text" size="small" @click="onCreateFolder()">
          <IconifyIcon icon="mdi:plus" :size="16" />
        </Button>
      </div>
      <Tree
        :expanded-keys="expandedKeys"
        :selected-keys="selectedKeys"
        :tree-data="treeData"
        block-node
        default-expand-all
        @expand="onExpand"
        @select="onSelect"
      />
    </div>

    <Modal
      v-model:open="showModal"
      title="新建文件夹"
      ok-text="确定"
      cancel-text="取消"
      :loading="loading"
      @ok="handleCreateFolder"
    >
      <Form :model="{ folderName, selectedProjectId, selectedParentId }" layout="vertical">
        <Form.Item label="项目">
          <Select
            v-model="selectedProjectId"
            placeholder="请选择项目"
            style="width: 100%"
          >
            <Select.Option
              v-for="project in store.projects"
              :key="project.id"
              :value="project.id"
            >
              {{ project.projectName }}
            </Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="父分组">
          <Select
            v-model="selectedParentId"
            placeholder="根文件夹"
            style="width: 100%"
            allow-clear
          >
            <Select.Option :value="null" key="root">根文件夹</Select.Option>
            <template v-for="folder in store.folders" :key="'folder-' + folder.id">
              <Select.Option :value="folder.id">{{ folder.name }}</Select.Option>
              <template v-for="child in folder.children" :key="'child-' + child.id">
                <Select.Option :value="child.id">├── {{ child.name }}</Select.Option>
              </template>
            </template>
          </Select>
        </Form.Item>
        <Form.Item label="文件夹名称">
          <Input
            v-model="folderName"
            placeholder="请输入文件夹名称"
            @keyup.enter="handleCreateFolder"
          />
        </Form.Item>
      </Form>
    </Modal>
  </div>
</template>
