<script lang="ts" setup>
import { computed, h, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, message, Popconfirm, Tooltip, Tree } from 'antdv-next';

import { useWorkflowStore } from '#/store/workflow';

const store = useWorkflowStore();

const expandedKeys = ref<string[]>([]);
const selectedKeys = ref<string[]>([]);
const editingKey = ref<null | string>(null);
const editingName = ref('');

const treeData = computed(() => {
  return foldersToTree(store.folders);
});

function foldersToTree(folders: any[]): any[] {
  return folders.map((folder) => ({
    key: folder.id,
    title: renderTitle(folder),
    icon: () =>
      h(IconifyIcon, {
        icon: 'mdi:folder',
        style: { fontSize: '16px', color: '#eab308' },
      }),
    children: folder.children?.length
      ? foldersToTree(folder.children)
      : undefined,
    data: folder,
  }));
}

function renderTitle(folder: any) {
  if (editingKey.value === folder.id) {
    return h(Input, {
      value: editingName.value,
      onChange: (e: any) => {
        editingName.value = e.target.value ?? '';
      },
      onBlur: handleEditBlur(folder),
      onKeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          handleEditBlur(folder)();
        } else if (e.key === 'Escape') {
          editingKey.value = null;
        }
      },
    });
  }
  return folder.name;
}

function handleEditBlur(folder: any) {
  return () => {
    if (editingName.value.trim()) {
      store.updateFolder(folder.id, { name: editingName.value.trim() });
      message.success('文件夹已重命名');
    }
    editingKey.value = null;
  };
}

function onExpand(expandedKeysValue: any[]) {
  expandedKeys.value = expandedKeysValue as string[];
}

function onSelect(selectedKeysValue: any[]) {
  selectedKeys.value = selectedKeysValue as string[];
  store.setSelectedFolderId(selectedKeysValue[0] || undefined);
}

function onCreateFolder() {
  const parentId = selectedKeys.value[0] || undefined;
  const newFolder = store.createFolder('新建文件夹', parentId);
  expandedKeys.value = [...expandedKeys.value, newFolder.id];
  selectedKeys.value = [newFolder.id];
  editingKey.value = newFolder.id;
  editingName.value = '新建文件夹';
  message.success('文件夹已创建');
}

function onRenameFolder() {
  if (selectedKeys.value[0]) {
    const folder = store.findFolderById(selectedKeys.value[0]);
    if (folder) {
      editingKey.value = folder.id;
      editingName.value = folder.name;
    }
  }
}

onMounted(() => {
  store.initMockData();
});
</script>

<template>
  <div class="flex flex-col h-full bg-white border-r border-gray-200">
    <div class="p-4 border-b border-gray-200">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-gray-800">文件夹</h2>
        <Button type="text" size="small" @click="onCreateFolder">
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
    <div class="p-4 border-t border-gray-200 flex items-center gap-2">
      <Tooltip title="新建文件夹">
        <Button type="text" size="small" @click="onCreateFolder">
          <IconifyIcon icon="mdi:folder-plus" :size="16" />
        </Button>
      </Tooltip>
      <Tooltip title="重命名">
        <Button
          type="text"
          size="small"
          :disabled="!selectedKeys.length"
          @click="onRenameFolder"
        >
          <IconifyIcon icon="mdi:pencil" :size="16" />
        </Button>
      </Tooltip>
      <Popconfirm
        title="确定删除这个文件夹吗？"
        ok-text="确定"
        cancel-text="取消"
      >
        <Tooltip title="删除">
          <Button
            type="text"
            size="small"
            danger
            :disabled="!selectedKeys.length"
          >
            <IconifyIcon icon="mdi:trash-can" :size="16" />
          </Button>
        </Tooltip>
      </Popconfirm>
    </div>
  </div>
</template>
