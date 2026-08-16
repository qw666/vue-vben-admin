<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Spin } from 'ant-design-vue';

import { useWorkflowStore } from '#/store/workflow';

import FolderTree from '../components/FolderTree.vue';
import WorkflowList from '../components/WorkflowList.vue';

const store = useWorkflowStore();

const isLoading = ref(true);
let projectChangeTimer: null | ReturnType<typeof setTimeout> = null;

onMounted(async () => {
  try {
    await store.loadProjects();
    await Promise.all([store.loadFolders(), store.loadWorkflows()]);
  } finally {
    isLoading.value = false;
  }
});

watch(
  () => store.projectId,
  (newId) => {
    if (projectChangeTimer) {
      clearTimeout(projectChangeTimer);
    }
    projectChangeTimer = setTimeout(async () => {
      if (newId) {
        await store.loadFolders().catch(() => {});
        await store.loadWorkflows().catch(() => {});
      }
    }, 300);
  },
);

watch(
  () => store.selectedFolderId,
  async (newId) => {
    await store.loadWorkflows(newId || undefined).catch(() => {});
  },
);
</script>

<template>
  <Page content-class="flex h-full">
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <Spin size="large" tip="加载中...">
        <IconifyIcon
          icon="mdi:loading"
          :size="32"
          class="text-blue-500 animate-spin"
        />
      </Spin>
    </div>
    <div v-else class="flex flex-1 overflow-hidden gap-4">
      <div class="w-64 flex-shrink-0">
        <FolderTree />
      </div>
      <div class="flex-1 flex flex-col overflow-hidden gap-4">
        <WorkflowList />
      </div>
    </div>
  </Page>
</template>
