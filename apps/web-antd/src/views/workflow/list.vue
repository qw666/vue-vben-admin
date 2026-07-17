<script lang="ts" setup>
import { onMounted, watch, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Select, Spin } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import { useWorkflowStore } from '#/store/workflow';

import FolderTree from './components/FolderTree.vue';
import WorkflowList from './components/WorkflowList.vue';

const store = useWorkflowStore();

const isLoading = ref(true);
let projectChangeTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  try {
    await store.loadProjects();
    await store.loadFolders();
    await store.loadWorkflows();
  } finally {
    isLoading.value = false;
  }
});

watch(() => store.projectId, (newId) => {
  if (projectChangeTimer) {
    clearTimeout(projectChangeTimer);
  }
  projectChangeTimer = setTimeout(async () => {
    if (newId) {
      await store.loadFolders().catch(() => {});
      await store.loadWorkflows().catch(() => {});
    }
  }, 300);
});

watch(() => store.selectedFolderId, async (newId) => {
  await store.loadWorkflows(newId || undefined).catch(() => {});
});
</script>

<template>
  <Page content-class="flex h-full">
    <template #title>
      <div class="flex items-center gap-4">
        <span>流程编排</span>
        <Select
          v-model:value="store.projectId"
          class="w-48"
          size="small"
          placeholder="选择项目"
          :loading="isLoading"
        >
          <Select.Option
            v-for="project in store.projects"
            :key="project.id"
            :value="project.id"
          >
            {{ project.projectName }}
          </Select.Option>
        </Select>
      </div>
    </template>
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <Spin size="large" tip="加载中...">
        <IconifyIcon icon="mdi:loader" :size="32" class="text-blue-500" />
      </Spin>
    </div>
    <div v-else class="flex flex-1 overflow-hidden">
      <div class="w-64 flex-shrink-0">
        <FolderTree />
      </div>
      <div class="flex-1 flex flex-col overflow-hidden">
        <WorkflowList />
      </div>
    </div>
  </Page>
</template>
