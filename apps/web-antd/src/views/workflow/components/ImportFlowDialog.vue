<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  Modal,
  Radio,
  Select,
  Upload,
  message,
} from 'ant-design-vue';

import { IconifyIcon } from '@vben/icons';

import type {
  FlowImportMode,
  FlowImportResultDTO,
} from '#/api/core/workflow';
import { importFlows } from '#/api/core/workflow';

import { useWorkflowStore } from '#/store/workflow';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'success', result: FlowImportResultDTO): void;
}>();

const store = useWorkflowStore();

const fileList = ref<any[]>([]);
const importMode = ref<FlowImportMode>('SKIP');
const importing = ref(false);
const importResult = ref<FlowImportResultDTO | null>(null);

const selectedFile = computed(() => fileList.value[0]?.originFileObj || null);

const folders = computed(() => store.folders);

function getFolderLabel(folder: any): string {
  return folder.name || folder.folderName || '';
}

async function handleImport() {
  if (!selectedFile.value) {
    message.warning('请先选择 JSON 文件');
    return;
  }
  if (!store.selectedFolderId) {
    message.warning('请先选择目标文件夹');
    return;
  }

  importing.value = true;
  importResult.value = null;

  try {
    const result = await importFlows(
      selectedFile.value,
      store.projectId,
      store.selectedFolderId,
      importMode.value,
    );
    importResult.value = result;
    if (result.failMsgList && result.failMsgList.length > 0) {
      message.warning(`导入完成，${result.failMsgList.length} 个失败`);
    } else {
      message.success('导入成功');
    }
    emit('success', result);
  } catch (error: any) {
    message.error(`导入失败: ${error?.message || '未知错误'}`);
  } finally {
    importing.value = false;
  }
}

function handleClose() {
  emit('update:visible', false);
  resetState();
}

function resetState() {
  fileList.value = [];
  importMode.value = 'SKIP';
  importResult.value = null;
}

function beforeUpload(_file: File) {
  return false;
}

function handleFileChange(info: any) {
  fileList.value = info.fileList.slice(-1);
}

function handleDragOver() {}

const isSuccess = computed(() => importResult.value !== null);
</script>

<template>
  <Modal
    :open="props.visible"
    title="导入流程"
    :width="560"
    ok-text="确定导入"
    cancel-text="取消"
    :confirm-loading="importing"
    :ok-button-props="{ disabled: !selectedFile, type: 'primary' }"
    @ok="handleImport"
    @cancel="handleClose"
  >
    <div v-if="!isSuccess" class="flex flex-col gap-4 py-2">
      <div>
        <div class="text-sm text-gray-600 mb-2">选择 JSON 文件</div>
        <Upload.Dragger
          :file-list="fileList"
          :before-upload="beforeUpload"
          :max-count="1"
          accept=".json"
          @change="handleFileChange"
          @dragOver="handleDragOver"
        >
          <p class="ant-upload-drag-icon">
            <IconifyIcon icon="mdi:inbox" :size="48" class="text-blue-400" />
          </p>
          <p class="ant-upload-text">点击或拖拽 JSON 文件到此区域</p>
          <p class="ant-upload-hint">
            仅支持 .json 格式文件
          </p>
        </Upload.Dragger>
      </div>

      <div>
        <div class="text-sm text-gray-600 mb-2">导入模式</div>
        <Radio.Group v-model:value="importMode">
          <Radio value="SKIP">跳过已存在</Radio>
          <Radio value="OVERWRITE">覆盖已存在</Radio>
        </Radio.Group>
      </div>

      <div>
        <div class="text-sm text-gray-600 mb-2">
          目标文件夹
          <span class="text-red-500">*</span>
        </div>
        <Select
          :value="store.selectedFolderId ?? undefined"
          placeholder="请选择目标文件夹"
          :style="{ width: '100%' }"
          disabled
          show-search
          :max-tag-text-length="20"
        >
          <Select.Option
            v-for="folder in folders"
            :key="folder.id"
            :value="folder.id"
          >
            {{ getFolderLabel(folder) }}
          </Select.Option>
        </Select>
        <div class="text-xs text-gray-400 mt-1">
          在左侧目录树中选择目标文件夹
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col gap-4 py-2">
      <div class="text-center py-4">
        <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <IconifyIcon icon="mdi:check" :size="32" class="text-green-500" />
        </div>
        <h3 class="text-lg font-medium text-gray-800 mb-2">导入完成</h3>
      </div>

      <div class="flex justify-center gap-6 py-2">
        <div class="text-center">
          <div class="text-2xl font-bold text-green-500">
            {{ importResult?.successCount || 0 }}
          </div>
          <div class="text-xs text-gray-500 mt-1">成功</div>
        </div>
        <div class="w-px bg-gray-200" />
        <div class="text-center">
          <div class="text-2xl font-bold text-yellow-500">
            {{ importResult?.skipCount || 0 }}
          </div>
          <div class="text-xs text-gray-500 mt-1">跳过</div>
        </div>
        <div class="w-px bg-gray-200" />
        <div class="text-center">
          <div class="text-2xl font-bold text-red-500">
            {{ importResult?.failMsgList?.length || 0 }}
          </div>
          <div class="text-xs text-gray-500 mt-1">失败</div>
        </div>
      </div>

      <div
        v-if="importResult?.failMsgList?.length"
        class="bg-red-50 border border-red-200 rounded p-3 max-h-32 overflow-y-auto"
      >
        <div class="text-sm font-medium text-red-700 mb-2">失败详情:</div>
        <div
          v-for="(msg, idx) in importResult.failMsgList"
          :key="idx"
          class="text-xs text-red-600 py-0.5"
        >
          {{ msg }}
        </div>
      </div>
    </div>
  </Modal>
</template>
