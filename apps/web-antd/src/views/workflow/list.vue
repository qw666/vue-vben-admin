<script lang="ts" setup>
import { onMounted, watch } from 'vue';

import { Page } from '@vben/common-ui';

import { useWorkflowStore } from '#/store/workflow';

import FolderTree from './components/FolderTree.vue';
import WorkflowList from './components/WorkflowList.vue';

const store = useWorkflowStore();

onMounted(async () => {
  store.initMockData();
  await store.loadProjects().catch(() => {});
  await store.loadFolders().catch(() => {});
});

watch(() => store.projectId, async (newId) => {
  if (newId) {
    await store.loadFolders().catch(() => {});
  }
});
</script>

<template>
  <Page content-class="flex h-full" title="工作流列表">
    <div class="flex flex-1 overflow-hidden">
      <div class="w-64 flex-shrink-0">
        <FolderTree />
      </div>
      <div class="flex-1 flex flex-col overflow-hidden">
        <WorkflowList />
      </div>
    </div>
  </Page>
</template>
