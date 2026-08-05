<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

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

const editorRef = ref<HTMLElement | null>(null);

function getPopupContainer() {
  return document.body;
}

// ===== 树形数据 =====
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

// ===== expression ↔ alias 双向映射 =====
function normalizeExpr(expr: string): string {
  return expr.replace(/\s+/g, ' ').trim();
}

interface FlatVarItem {
  key: string;
  label: string;
  expression: string;
  type?: string;
}

interface FlatSection {
  key: string;
  title: string;
  items: FlatVarItem[];
}

const flatSections = computed<FlatSection[]>(() => {
  const sections: FlatSection[] = [];
  for (const group of availableVars.value) {
    if (group.group === 'upstream') {
      for (const child of group.children || []) {
        if (child.children && child.children.length > 0) {
          sections.push({
            key: child.key,
            title: child.label,
            items: child.children.map((c) => ({
              key: c.key,
              label: c.label,
              expression: c.expression!,
              type: c.type,
            })),
          });
        }
      }
      continue;
    }
    const items: FlatVarItem[] = [];
    for (const child of group.children || []) {
      if (child.expression) {
        items.push({
          key: child.key,
          label: child.label,
          expression: child.expression,
          type: child.type,
        });
      } else if (child.children && child.children.length > 0) {
        for (const sub of child.children) {
          if (sub.expression) {
            items.push({
              key: sub.key,
              label: sub.label,
              expression: sub.expression,
              type: sub.type,
            });
          }
        }
      }
    }
    if (items.length > 0) {
      sections.push({ key: group.key, title: group.label, items });
    }
  }
  return sections;
});

const expressionToAlias = computed<Map<string, string>>(() => {
  const map = new Map<string, string>();
  for (const section of flatSections.value) {
    for (const item of section.items) {
      if (item.expression) {
        const normalized = normalizeExpr(item.expression);
        const alias = section.title && section.title !== item.label
          ? `${section.title}.${item.label}`
          : item.label;
        map.set(normalized, alias);
      }
    }
  }
  return map;
});

const EXPR_REGEX = /\{\{[^{}]+\}\}/g;

/** 存储值 → DOM 子节点数组（支持多行：\n → <br>） */
function storedToDomNodes(stored: string): Node[] {
  const nodes: Node[] = [];
  if (!stored) return nodes;

  const map = expressionToAlias.value;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  EXPR_REGEX.lastIndex = 0;

  while ((match = EXPR_REGEX.exec(stored)) !== null) {
    const start = match.index;
    // 表达式前的文本（处理换行）
    if (start > lastIndex) {
      const textBefore = stored.slice(lastIndex, start);
      appendTextNodes(nodes, textBefore);
    }
    const normalized = normalizeExpr(match[0]);
    const alias = map.get(normalized);
    if (alias) {
      const span = document.createElement('span');
      span.className = 'var-token';
      span.contentEditable = 'false';
      span.dataset.expr = normalized;
      span.textContent = alias;
      nodes.push(span);
    } else {
      appendTextNodes(nodes, match[0]);
    }
    lastIndex = start + match[0].length;
  }
  // 尾部文本
  if (lastIndex < stored.length) {
    appendTextNodes(nodes, stored.slice(lastIndex));
  }
  return nodes;
}

/** 将文本按换行拆分为文本节点 + <br> */
function appendTextNodes(nodes: Node[], text: string) {
  const parts = text.split('\n');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length > 0) {
      nodes.push(document.createTextNode(parts[i]));
    }
    if (i < parts.length - 1) {
      nodes.push(document.createElement('br'));
    }
  }
}

/** DOM → 存储值（从 contenteditable div 提取，支持多行） */
function domToStoredValue(root: HTMLElement): string {
  let result = '';
  const children = root.childNodes;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent || '';
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (el.classList?.contains('var-token')) {
        result += el.dataset.expr || '';
      } else if (el.tagName === 'BR') {
        result += '\n';
      } else if (el.tagName === 'DIV' || el.tagName === 'P') {
        // contenteditable div 在空行时会创建 <div>或<P>
        // 递归处理子节点，但最后加换行
        const inner = domToStoredValue(el);
        if (inner) result += inner;
        // 如果不是最后一个子节点，加换行
        if (i < children.length - 1) {
          result += '\n';
        }
      } else {
        result += domToStoredValue(el);
      }
    }
  }
  return result;
}

/** 将节点数组渲染到 contenteditable div */
function renderDomNodes(root: HTMLElement, nodes: Node[]) {
  root.innerHTML = '';
  for (const node of nodes) {
    root.appendChild(node);
  }
  // 确保末尾有个空行用于光标定位
  if (root.childNodes.length === 0 || root.lastChild?.nodeType !== Node.TEXT_NODE) {
    // 添加一个零宽空格方便光标在末尾定位
    root.appendChild(document.createTextNode('\u200B'));
  }
}

// ===== 本地状态 =====

const storedValue = ref(props.value);
let isInternalRender = false;
const isUnmounting = ref(false);

onBeforeUnmount(() => {
  isUnmounting.value = true;
});

/** 渲染存储值到 DOM */
function syncDomFromStored() {
  if (!editorRef.value) return;
  const nodes = storedToDomNodes(storedValue.value);
  isInternalRender = true;
  renderDomNodes(editorRef.value, nodes);
  nextTick(() => {
    isInternalRender = false;
  });
}

/** 从 DOM 写回存储值 */
function writeStoredFromDom() {
  if (!editorRef.value || isInternalRender) return;
  let stored = domToStoredValue(editorRef.value);
  // 清理可能的末尾零宽空格
  stored = stored.replace(/\u200B/g, '');
  storedValue.value = stored;
  emit('update:value', stored);
}

watch(
  () => props.value,
  (val) => {
    if (val !== storedValue.value) {
      storedValue.value = val;
      syncDomFromStored();
    }
  },
);

onMounted(() => {
  nextTick(() => {
    if (storedValue.value) {
      syncDomFromStored();
    }
  });
});

// ===== 动态高度 =====
const editorMinHeight = computed(() => {
  const lineHeight = 18; // 12px * 1.5
  const padding = 16; // 8px * 2
  return `${props.rows * lineHeight + padding}px`;
});

// ===== 事件处理 =====

function handleInput() {
  if (isInternalRender) return;
  writeStoredFromDom();
}

function handlePaste(e: ClipboardEvent) {
  e.preventDefault();
  const text = e.clipboardData?.getData('text/plain') || '';
  if (!text) return;

  // 直接插入纯文本（保持原有行为，不做变量转换）
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editorRef.value) return;

  const range = sel.getRangeAt(0);
  range.deleteContents();

  // 按行分割，处理多行粘贴
  const lines = text.split('\n');
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 0) {
      fragment.appendChild(document.createTextNode(lines[i]));
    }
    if (i < lines.length - 1) {
      fragment.appendChild(document.createElement('br'));
    }
  }
  range.insertNode(fragment);

  // 移动光标到末尾
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);

  writeStoredFromDom();
}

function handleFocus() {
  // 聚焦时确保光标在正确位置
}

// ===== 变量插入 =====

function insertTokenAtCursor(expression: string) {
  if (!editorRef.value) return;

  const normalized = normalizeExpr(expression);
  const alias = expressionToAlias.value.get(normalized);

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    // 如果没有选区，在末尾插入
    editorRef.value.focus();
    const range = document.createRange();
    range.selectNodeContents(editorRef.value);
    range.collapse(false);
    sel?.addRange(range);
  }

  const range = sel!.getRangeAt(0);
  range.deleteContents();

  if (alias) {
    // 创建 token span
    const span = document.createElement('span');
    span.className = 'var-token';
    span.contentEditable = 'false';
    span.dataset.expr = normalized;
    span.textContent = alias;
    range.insertNode(span);

    // 在 token 后添加一个零宽空格，方便光标定位
    const space = document.createTextNode('\u200B');
    span.after(space);

    // 光标移到 space 之后
    const afterRange = document.createRange();
    afterRange.setStartAfter(space);
    afterRange.collapse(true);
    sel!.removeAllRanges();
    sel!.addRange(afterRange);
  } else {
    // 未知表达式，直接插入文本
    const textNode = document.createTextNode(expression);
    range.insertNode(textNode);
    // 光标移到文本之后
    const afterRange = document.createRange();
    afterRange.setStartAfter(textNode);
    afterRange.collapse(true);
    sel!.removeAllRanges();
    sel!.addRange(afterRange);
  }

  writeStoredFromDom();
  popoverOpen.value = false;
  searchValue.value = '';
}

function handleTreeSelect(_keys: (string | number)[], info: any) {
  const node = info?.node;
  if (node?.selectable && node?.expression) {
    insertTokenAtCursor(node.expression);
  }
}

function togglePanel() {
  popoverOpen.value = !popoverOpen.value;
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
        :get-popup-container="getPopupContainer"
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
    <div
      ref="editorRef"
      class="inserter-editor"
      :contenteditable="!disabled"
      :data-placeholder="placeholder"
      :style="{ minHeight: editorMinHeight }"
      @input="handleInput"
      @focus="handleFocus"
      @paste="handlePaste"
    ></div>
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

.inserter-editor {
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
  white-space: pre-wrap;
  word-break: break-all;
  overflow-y: auto;
}

.inserter-editor:focus {
  border-color: #4096ff;
}

.inserter-editor:empty::before {
  content: attr(data-placeholder);
  color: #bfbfbf;
  pointer-events: none;
}
</style>

<style>
.var-inserter-popover .ant-popover-inner {
  padding: 0 !important;
  border-radius: 8px;
  box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05);
}

.var-inserter-popover .ant-popover-inner-content {
  padding: 0 !important;
}

.var-inserter-popover .var-dropdown {
  width: 320px;
  max-height: 420px;
  overflow: hidden;
}

.var-inserter-popover .var-search {
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.var-inserter-popover .var-tree-wrap {
  max-height: 360px;
  overflow-y: auto;
  padding: 4px 0;
}

.var-inserter-popover .var-empty {
  padding: 32px 16px;
}

/* ===== VarToken 样式（必须在非 scoped 块） ===== */
.var-token {
  display: inline;
  padding: 0 4px;
  margin: 0 1px;
  background: #e6f4ff;
  border-radius: 4px;
  color: #1677ff;
  font-size: 0.85em;
  font-weight: 500;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  vertical-align: baseline;
  white-space: nowrap;
  user-select: all;
  transition: background 0.15s ease;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.var-token:hover {
  background: #bae0ff;
}
</style>
