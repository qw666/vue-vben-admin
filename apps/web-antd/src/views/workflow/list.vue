<script lang="ts" setup>
import { onMounted, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Select } from 'ant-design-vue';

import { useWorkflowStore } from '#/store/workflow';

import FolderTree from './components/FolderTree.vue';
import WorkflowList from './components/WorkflowList.vue';

const store = useWorkflowStore();

onMounted(async () => {
  await store.loadProjects().catch(() => {});
  await store.loadFolders().catch(() => {});
  await store.loadWorkflows().catch(() => {});
});

watch(() => store.projectId, async (newId) => {
  if (newId) {
    await store.loadFolders().catch(() => {});
    await store.loadWorkflows().catch(() => {});
  }
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
          class="w-40"
          size="small"
          placeholder="选择项目"
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
