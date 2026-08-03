<script lang="ts" setup>
import type { VarNode } from '#/types/workflow';

import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Empty, Input, Popover, Tooltip, Tree } from 'ant-design-vue';

import { useVarSources } from '../../composables/useVarSources';

const props = withDefaults(
  defineProps<{
    value?: string;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
  }>(),
  {
    value: '',
    placeholder: '请输入内容，可插入 {{ }} 变量',
    rows: 6,
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: 'update:value', value: string): void;
}>();

const { availableVars } = useVarSources();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

// ===== 树形数据（与 VarPicker 同构）=====
interface TreeNode {
  key: string;
  title: string;
  expression?: string;
  selectable: boolean;
  isLeaf: boolean;
  children?: TreeNode[];
}

const treeData = computed<TreeNode[]>(() => {
  return availableVars.value.map((group) => {
    if (group.group === 'upstream') {
      return {
        key: group.key,
        title: group.label,
        selectable: false,
        isLeaf: false,
        children: (group.children || []).map((node) => ({
          key: node.key,
          title: node.label,
          selectable: false,
          isLeaf: false,
          children: (node.children || []).map((leaf) => ({
            key: leaf.key,
            title: leaf.label + (leaf.type && leaf.type !== 'any' ? `  [${leaf.type}]` : ''),
            expression: leaf.expression,
            selectable: true,
            isLeaf: true,
          })),
        })),
      };
    }
    return {
      key: group.key,
      title: group.label,
      selectable: false,
      isLeaf: false,
      children: (group.children || []).map((leaf) => ({
        key: leaf.key,
        title: leaf.label + (leaf.type && leaf.type !== 'any' ? `  [${leaf.type}]` : ''),
        expression: leaf.expression,
        selectable: true,
        isLeaf: true,
      })),
    };
  });
});

const expandedKeys = ref<string[]>([]);
const searchValue = ref('');
const popoverOpen = ref(false);

const filteredTreeData = computed<TreeNode[]>(() => {
  if (!searchValue.value.trim()) return treeData.value;
  const keyword = searchValue.value.toLowerCase();
  return treeData.value
    .map((group) => {
      const isThreeLevel = (group.children || []).some(
        (c) => Array.isArray(c.children) && c.children.length > 0,
      );
      if (isThreeLevel) {
        const filteredChildren = (group.children || [])
          .map((node) => {
            const filteredLeaves = (node.children || []).filter((leaf) =>
              leaf.title.toLowerCase().includes(keyword) ||
              leaf.expression?.toLowerCase().includes(keyword) ||
              node.title.toLowerCase().includes(keyword),
            );
            if (filteredLeaves.length === 0) return null;
            return { ...node, children: filteredLeaves };
          })
          .filter((n): n is TreeNode => n !== null);
        if (filteredChildren.length === 0) return null;
        return { ...group, children: filteredChildren };
      }
      const filteredChildren = (group.children || []).filter(
        (leaf) =>
          leaf.title.toLowerCase().includes(keyword) ||
          leaf.expression?.toLowerCase().includes(keyword),
      );
      if (filteredChildren.length === 0) return null;
      return { ...group, children: filteredChildren };
    })
    .filter((g): g is TreeNode => g !== null);
});

// ===== 在光标处插入变量表达式 =====
function insertExpression(expression: string) {
  const textarea = textareaRef.value;
  if (!textarea) {
    emit('update:value', props.value + expression);
    popoverOpen.value = false;
    return;
  }
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = props.value.slice(0, start);
  const after = props.value.slice(end);
  const newValue = before + expression + after;
  emit('update:value', newValue);
  popoverOpen.value = false;
  searchValue.value = '';
  // 恢复光标位置到插入表达式之后
  setTimeout(() => {
    textarea.focus();
    const pos = start + expression.length;
    textarea.setSelectionRange(pos, pos);
  }, 0);
}

function handleTreeSelect(_keys: (string | number)[], info: any) {
  const node = info?.node;
  if (node?.selectable && node?.expression) {
    insertExpression(node.expression);
  }
}

function handleInput(e: any) {
  emit('update:value', e?.target?.value ?? '');
}
</script>

<template>
  <div class="var-inserter" v-bind="$attrs">
    <div class="inserter-toolbar">
      <span class="inserter-hint">支持插入 <code v-pre>{{ }}</code> 变量</span>
      <Popover
        v-model:open="popoverOpen"
        trigger="click"
        placement="bottomRight"
        overlay-class-name="var-inserter-popover"
        :get-popup-container="(trigger: any) => trigger.parentNode || document.body"
      >
        <template #content>
          <div class="var-dropdown" @click.stop>
            <div class="var-search">
              <Input
                v-model:value="searchValue"
                placeholder="搜索变量名或节点名..."
                size="small"
                allow-clear
              >
                <template #prefix>
                  <IconifyIcon icon="mdi:magnify" :size="14" />
                </template>
              </Input>
            </div>
            <div class="var-tree-wrap">
              <Tree
                v-model:expandedKeys="expandedKeys"
                :tree-data="filteredTreeData as any"
                :block-node="true"
                :selectable="true"
                @select="handleTreeSelect"
              />
              <Empty
                v-if="filteredTreeData.length === 0"
                :image-style="{ height: '48px' }"
                description="暂无可选变量"
                class="var-empty"
              />
            </div>
          </div>
        </template>
        <Tooltip title="插入变量">
          <button type="button" class="insert-btn">
            <IconifyIcon icon="mdi:variable" :size="14" />
            <span>插入变量</span>
          </button>
        </Tooltip>
      </Popover>
    </div>
    <textarea
      ref="textareaRef"
      :value="value"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      class="inserter-textarea"
      spellcheck="false"
      @input="handleInput"
    ></textarea>
  </div>
</template>

<style scoped>
.var-inserter {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 6px;
}

.inserter-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.inserter-hint {
  font-size: 12px;
  color: #9ca3af;
}

.insert-btn {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px 8px;
  font-size: 12px;
  color: #4096ff;
  cursor: pointer;
  user-select: none;
  background: #f0f7ff;
  border: 1px solid #d6e4ff;
  border-radius: 4px;
  transition: all 0.2s;
}

.insert-btn:hover {
  background: #dbe9ff;
}

.inserter-textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 10px;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #1f2937;
  resize: vertical;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  outline: none;
}

.inserter-textarea:focus {
  border-color: #4096ff;
}
</style>

<style>
.var-inserter-popover .ant-popover-inner {
  padding: 0 !important;
}

.var-inserter-popover .ant-popover-inner-content {
  padding: 0 !important;
}
</style>
