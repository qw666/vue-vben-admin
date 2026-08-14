<script setup lang="ts">
import { ref, computed } from 'vue';
import { IconifyIcon } from '@vben/icons';
import { Modal, Input, Button } from 'ant-design-vue';

interface Props {
  modelValue?: string;
  visible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  visible: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:visible': [value: boolean];
  'change': [value: string];
}>();

const selectedIcon = ref(props.modelValue);
const searchText = ref('');

// All icons verified to exist in mdi-icons.json (offline mode)
const iconCategories: { name: string; icons: string[] }[] = [
  {
    name: '常用',
    icons: [
      'mdi:home', 'mdi:home-outline', 'mdi:search', 'mdi:magnify',
      'mdi:plus', 'mdi:close', 'mdi:check', 'mdi:check-circle',
      'mdi:alert', 'mdi:alert-circle', 'mdi:alert-outline',
      'mdi:information', 'mdi:information-outline', 'mdi:help-circle',
      'mdi:trash-can', 'mdi:pencil', 'mdi:content-save',
      'mdi:download', 'mdi:upload',
      'mdi:refresh', 'mdi:refresh-circle',
      'mdi:eye', 'mdi:eye-off', 'mdi:cursor-pointer',
      'mdi:circle', 'mdi:circle-outline', 'mdi:minus', 'mdi:target',
    ],
  },
  {
    name: '导航',
    icons: [
      'mdi:menu', 'mdi:arrow-left', 'mdi:arrow-down',
      'mdi:chevron-left', 'mdi:chevron-right', 'mdi:chevron-down', 'mdi:chevron-up',
      'mdi:chevron-double-left', 'mdi:chevron-double-right',
      'mdi:arrow-right-bottom', 'mdi:cursor-pointer', 'mdi:cursor-move',
      'mdi:page-previous-outline',
    ],
  },
  {
    name: '文件',
    icons: [
      'mdi:folder', 'mdi:folder-outline', 'mdi:folder-open',
      'mdi:file-document', 'mdi:file-document-outline',
      'mdi:file-edit', 'mdi:file-edit-outline',
      'mdi:file-marker-outline',
      'mdi:archive', 'mdi:content-save', 'mdi:clipboard-edit',
      'mdi:library', 'mdi:inbox', 'mdi:inbox-arrow-down',
    ],
  },
  {
    name: '数据',
    icons: [
      'mdi:table', 'mdi:table-column', 'mdi:view-dashboard', 'mdi:view-grid',
      'mdi:compare', 'mdi:split-vertical',
      'mdi:format-list-bulleted', 'mdi:format-list-bulleted-square',
      'mdi:code-braces', 'mdi:hexagon', 'mdi:chart-bar', 'mdi:chart-line',
    ],
  },
  {
    name: '操作',
    icons: [
      'mdi:play', 'mdi:play-circle',
      'mdi:pause', 'mdi:pause-circle',
      'mdi:stop-circle',
      'mdi:repeat', 'mdi:redo', 'mdi:undo', 'mdi:sync', 'mdi:autorenew',
      'mdi:checkbox-marked-circle', 'mdi:check-circle',
      'mdi:source-branch', 'mdi:link-variant',
    ],
  },
  {
    name: '媒体',
    icons: [
      'mdi:play', 'mdi:play-circle',
      'mdi:pause', 'mdi:pause-circle',
      'mdi:stop-circle',
      'mdi:microphone', 'mdi:microphone-outline',
      'mdi:music', 'mdi:headphones',
      'mdi:camera', 'mdi:camera-outline',
      'mdi:video',
    ],
  },
  {
    name: '业务',
    icons: [
      'mdi:cart', 'mdi:package', 'mdi:truck',
      'mdi:cloud', 'mdi:cloud-outline',
      'mdi:calculator', 'mdi:coffee', 'mdi:coffee-outline',
      'mdi:car', 'mdi:car-outline', 'mdi:bus', 'mdi:train',
      'mdi:briefcase', 'mdi:briefcase-outline',
      'mdi:credit-card', 'mdi:card-text-outline',
      'mdi:chart-bar', 'mdi:chart-line',
    ],
  },
  {
    name: '安全',
    icons: [
      'mdi:shield', 'mdi:shield-outline', 'mdi:shield-alert', 'mdi:shield-check',
      'mdi:lock', 'mdi:lock-outline',
      'mdi:lock-open', 'mdi:lock-open-outline',
      'mdi:key', 'mdi:key-outline',
      'mdi:cloud-key-outline',
      'mdi:fingerprint',
      'mdi:server-security',
    ],
  },
  {
    name: '通信',
    icons: [
      'mdi:email', 'mdi:email-outline',
      'mdi:message',
      'mdi:chat', 'mdi:chat-outline',
      'mdi:phone', 'mdi:phone-outline',
      'mdi:forum', 'mdi:forum-outline',
      'mdi:account-group', 'mdi:account-multiple',
      'mdi:account-alert', 'mdi:account-check',
    ],
  },
  {
    name: '社交',
    icons: [
      'mdi:account', 'mdi:account-group', 'mdi:account-multiple',
      'mdi:heart', 'mdi:heart-outline',
      'mdi:star', 'mdi:star-outline',
      'mdi:comment', 'mdi:comment-outline',
      'mdi:share', 'mdi:share-outline',
      'mdi:history', 'mdi:timeline',
      'mdi:face-recognition',
    ],
  },
  {
    name: '工具',
    icons: [
      'mdi:wrench', 'mdi:wrench-outline',
      'mdi:bug',
      'mdi:git',
      'mdi:github',
      'mdi:translate',
      'mdi:content-copy', 'mdi:content-paste',
      'mdi:cursor-default-click', 'mdi:cursor-pointer', 'mdi:cursor-move',
      'mdi:palette',
      'mdi:text-box', 'mdi:text-box-search',
      'mdi:variable', 'mdi:cube-outline',
      'mdi:engine', 'mdi:settings-outline',
      'mdi:login-variant',
    ],
  },
  {
    name: '其他',
    icons: [
      'mdi:workflow', 'mdi:web', 'mdi:webhook',
      'mdi:flash', 'mdi:rotate-3d-variant',
      'mdi:clock-outline', 'mdi:lightbulb-on',
      'mdi:sleep', 'mdi:library',
      'mdi:form-select', 'mdi:text-box', 'mdi:api',
      'mdi:button-cursor',
      'mdi:shuffle', 'mdi:export',
      'mdi:calendar', 'mdi:calendar-outline',
      'mdi:timer',
      'mdi:bell', 'mdi:bell-outline',
      'mdi:robot', 'mdi:robot-outline',
      'mdi:image', 'mdi:image-outline',
      'mdi:database', 'mdi:database-outline',
      'mdi:server', 'mdi:server-off',
      'mdi:power', 'mdi:power-off',
      'mdi:battery',
      'mdi:signal', 'mdi:wifi', 'mdi:wifi-off',
      'mdi:bluetooth', 'mdi:bluetooth-off',
      'mdi:weather-sunny', 'mdi:weather-cloudy',
      'mdi:umbrella',
      'mdi:map-outline', 'mdi:map-marker-outline',
      'mdi:earth',
      'mdi:tag-outline',
      'mdi:cog',
      'mdi:chevron-left-box-outline',
      'mdi:arrow-down-bold',
    ],
  },
];

const currentCategory = ref('常用');

const filteredIcons = computed(() => {
  if (!searchText.value) {
    const category = iconCategories.find(c => c.name === currentCategory.value);
    return category?.icons || [];
  }
  const search = searchText.value.toLowerCase();
  return iconCategories.flatMap(c => c.icons).filter(icon => icon.toLowerCase().includes(search));
});

function selectIcon(icon: string) {
  selectedIcon.value = icon;
  emit('update:modelValue', icon);
  emit('change', icon);
}

function handleConfirm() {
  emit('update:modelValue', selectedIcon.value);
  emit('change', selectedIcon.value);
  emit('update:visible', false);
}

function handleCancel() {
  emit('update:visible', false);
}

function handleClear() {
  selectedIcon.value = '';
  emit('update:modelValue', '');
  emit('change', '');
}
</script>

<template>
  <Modal
    :open="visible"
    title="选择图标"
    :on-ok="handleConfirm"
    :on-cancel="handleCancel"
    :footer="null"
    :width="600"
    destroy-on-close
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <Input v-model:value="searchText" placeholder="搜索图标名称" allow-clear style="flex: 1">
          <template #prefix><IconifyIcon icon="mdi:magnify" :size="14" /></template>
        </Input>
        <div v-if="selectedIcon" class="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded">
          <IconifyIcon :icon="selectedIcon" :size="20" class="text-gray-700" />
          <span class="text-sm text-gray-600 font-mono">{{ selectedIcon }}</span>
          <IconifyIcon icon="mdi:close" :size="14" class="cursor-pointer text-gray-400 hover:text-red-500" @click="handleClear" />
        </div>
      </div>

      <div v-if="!searchText" class="flex gap-2 flex-wrap">
        <Button
          v-for="cat in iconCategories"
          :key="cat.name"
          :type="currentCategory === cat.name ? 'primary' : 'default'"
          size="small"
          @click="currentCategory = cat.name"
        >
          {{ cat.name }}
        </Button>
      </div>

      <div class="grid grid-cols-8 gap-2 max-h-[300px] overflow-auto p-2 border border-gray-200 rounded">
        <div
          v-for="icon in filteredIcons"
          :key="icon"
          class="flex flex-col items-center justify-center p-2 rounded cursor-pointer transition-all hover:bg-blue-50 hover:border-blue-200 border border-transparent"
          :class="{ 'bg-blue-100 border-blue-300': selectedIcon === icon }"
          @click="selectIcon(icon)"
        >
          <IconifyIcon :icon="icon" :size="24" class="text-gray-700" />
          <span class="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{{ icon }}</span>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <Button @click="handleCancel">取消</Button>
        <Button type="primary" @click="handleConfirm">确定</Button>
      </div>
    </div>
  </Modal>
</template>
