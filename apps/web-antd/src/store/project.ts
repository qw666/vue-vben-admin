import type { ProjectVO } from '#/api';

import { ref } from 'vue';

import { defineStore } from 'pinia';

import { listMyProjects } from '#/api';

const STORAGE_KEY = 'app-project-selected-id';

function getStoredSelectedId(): number | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val ? Number(val) : null;
  } catch {
    return null;
  }
}

export const useProjectStore = defineStore('project', () => {
  const projects = ref<ProjectVO[]>([]);
  const selectedId = ref<number | null>(getStoredSelectedId());

  async function loadProjects() {
    try {
      const data = await listMyProjects();
      projects.value = data;

      if (selectedId.value !== null) {
        const exists = data.some((p) => p.id === selectedId.value);
        if (!exists && data.length > 0) {
          selectedId.value = data[0]?.id ?? null;
          if (selectedId.value !== null) {
            localStorage.setItem(STORAGE_KEY, String(selectedId.value));
          }
        }
      } else if (data.length > 0) {
        selectedId.value = data[0]?.id ?? null;
        if (selectedId.value !== null) {
          localStorage.setItem(STORAGE_KEY, String(selectedId.value));
        }
      }
    } catch (e) {
      console.error('Failed to load projects:', e);
      projects.value = [];
    }
  }

  function selectProject(id: number) {
    selectedId.value = id;
    localStorage.setItem(STORAGE_KEY, String(id));
  }

  return { projects, selectedId, loadProjects, selectProject };
});
