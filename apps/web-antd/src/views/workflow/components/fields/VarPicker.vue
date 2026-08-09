<script lang="ts" setup>

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Empty, Popover } from 'ant-design-vue';

import { useVarSources } from '../../composables/useVarSources';

function getPopupContainer(trigger: any) {
  return trigger?.parentNode || document.body;
}

/**
 * VarPicker - 变量选择器
 * 使用 contenteditable 实现，变量 token 渲染为 <span contenteditable="false">
 * 浏览器自动将 token 作为原子单元处理：光标不能进入、删除时整体删除。
 *
 * 显示层：变量显示为别名 token（如 节点名.变量名）
 * 存储层：始终存储真实 Kestra 表达式 {{ outputs.nodeId.field }}
 */
const props = withDefaults(
  defineProps<{
    value?: string;
    placeholder?: string;
    size?: 'small' | 'middle';
    disabled?: boolean;
    field?: any;
    nodeConfigForm?: Record<string, any>;
  }>(),
  {
    value: '',
    placeholder: '输入 / 选择变量',
    size: 'middle',
    disabled: false,
    field: null,
    nodeConfigForm: undefined,
  },
);

const emit = defineEmits<{
  (e: 'update:value', value: string): void;
  (e: 'change', value: string): void;
}>();

// ===== 数据源 =====

const fieldKey = computed(() => props.field?.props?.key || props.field?.key || '');

const { availableVars } = useVarSources();

const currentValue = computed<string>(() => {
  if (props.field && props.nodeConfigForm) {
    return props.nodeConfigForm[fieldKey.value] ?? '';
  }
  return props.value || '';
});

// ===== 扁平化数据 =====

interface FlatVarItem {
  key: string;
  label: string;
  expression: string;
  type?: string;
  icon?: string;
  disabled?: boolean;
}

interface FlatSection {
  key: string;
  title: string;
  icon: string;
  order?: number;
  items: FlatVarItem[];
  children?: FlatSection[];
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
            icon: child.icon || 'mdi:cube-outline',
            order: 0,
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
      sections.push({
        key: group.key,
        title: group.label,
        icon: group.icon || 'mdi:information-outline',
        order: (group as any).order ?? 100,
        items,
      });
    }
  }

  return sections.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
});

// ===== expression ↔ alias 双向映射 =====

function normalizeExpr(expr: string): string {
  return expr.replace(/\s+/g, ' ').trim();
}

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

const aliasToExpression = computed<Map<string, string>>(() => {
  const map = new Map<string, string>();
  for (const section of flatSections.value) {
    for (const item of section.items) {
      if (item.expression) {
        const normalized = normalizeExpr(item.expression);
        const alias = section.title && section.title !== item.label
          ? `${section.title}.${item.label}`
          : item.label;
        map.set(alias, normalized);
      }
    }
  }
  return map;
});

const EXPR_REGEX = /\{\{[^{}]+\}\}/g;

/** 存储值 → DOM 子节点数组（文本节点 + token span 节点） */
function storedToDomNodes(stored: string): Node[] {
  const nodes: Node[] = [];
  if (!stored) return nodes;

  const map = expressionToAlias.value;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  EXPR_REGEX.lastIndex = 0;

  while ((match = EXPR_REGEX.exec(stored)) !== null) {
    const start = match.index;
    // 表达式前的文本
    if (start > lastIndex) {
      nodes.push(document.createTextNode(stored.slice(lastIndex, start)));
    }
    const normalized = normalizeExpr(match[0]);
    const alias = map.get(normalized);
    if (alias) {
      // 已知变量 → token span
      const span = document.createElement('span');
      span.className = 'var-token';
      span.contentEditable = 'false';
      span.dataset.expr = normalized;
      span.textContent = alias;
      nodes.push(span);
    } else {
      // 未知表达式 → 原样文本
      nodes.push(document.createTextNode(match[0]));
    }
    lastIndex = start + match[0].length;
  }
  // 尾部文本
  if (lastIndex < stored.length) {
    nodes.push(document.createTextNode(stored.slice(lastIndex)));
  }
  return nodes;
}

/** DOM → 存储值（从 contenteditable div 提取） */
function domToStoredValue(root: HTMLElement): string {
  let result = '';
  for (const child of root.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent || '';
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (el.classList?.contains('var-token')) {
        result += el.dataset.expr || '';
      } else if (el.tagName === 'BR') {
        // 忽略空行
      } else {
        // 其他元素递归
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
}

// ===== 本地状态 =====

const popoverOpen = ref(false);
const searchValue = ref('');
const slashQuery = ref('');
const editorRef = ref<HTMLElement | null>(null);

/** 存储值 ref — 数据模型层始终存储真实表达式 */
const storedValue = ref(currentValue.value);

/** 标记是否由外部 watch 触发渲染，避免 input 事件循环 */
let isInternalRender = false;

/** 标记是否正在用户输入中，用于跳过 watch 的 DOM 同步 */
let isUserInputting = false;

const isUnmounting = ref(false);

onBeforeUnmount(() => {
  isUnmounting.value = true;
});

/** 将存储值渲染到 DOM */
function syncDomFromStored() {
  if (!editorRef.value) return;
  const nodes = storedToDomNodes(storedValue.value);
  isInternalRender = true;
  renderDomNodes(editorRef.value, nodes);
  // 清除可能遗留的 <br>
  if (editorRef.value.childNodes.length === 0) {
    editorRef.value.innerHTML = '';
  }
  nextTick(() => {
    isInternalRender = false;
  });
}

/** 将 DOM 内容写回存储值 */
function writeStoredFromDom() {
  if (!editorRef.value) return;
  const stored = domToStoredValue(editorRef.value);
  storedValue.value = stored;
  if (props.field && props.nodeConfigForm) {
    props.nodeConfigForm[fieldKey.value] = stored;
  }
  emit('update:value', stored);
  emit('change', stored);
}

watch(currentValue, (val) => {
  // 如果正在用户输入，跳过 DOM 同步，避免干扰用户输入
  if (isUserInputting) {
    // 只更新 storedValue，不重建 DOM
    storedValue.value = val;
    return;
  }
  if (val !== storedValue.value) {
    storedValue.value = val;
    syncDomFromStored();
  }
});

watch(fieldKey, () => {
  isUserInputting = false;
  popoverOpen.value = false;
  slashQuery.value = '';
  searchValue.value = '';
  storedValue.value = currentValue.value;
  nextTick(() => {
    syncDomFromStored();
  });
});

onMounted(() => {
  // 组件挂载后首次同步 DOM（确保 editorRef 已就绪）
  nextTick(() => {
    syncDomFromStored();
  });

  // 添加全局点击监听，点击外部关闭面板
  document.addEventListener('click', handleDocumentClick);
});

onBeforeUnmount(() => {
  isUnmounting.value = true;
  document.removeEventListener('click', handleDocumentClick);
});

/** 关闭面板 */
function closePanel() {
  popoverOpen.value = false;
  slashQuery.value = '';
}

/** 处理文档点击事件，点击外部关闭面板 */
function handleDocumentClick(e: MouseEvent) {
  if (!popoverOpen.value) return;
  const target = e.target as HTMLElement;
  // 检查点击是否在 VarPicker 内部
  if (editorRef.value && editorRef.value.contains(target)) return;
  // 检查点击是否在面板内部
  const popoverEl = document.querySelector('.var-picker-popover');
  if (popoverEl && popoverEl.contains(target)) return;
  closePanel();
}

watch(storedValue, () => {
  // 仅在非用户输入触发时重新渲染 DOM
  // 用户输入时 writeStoredFromDom 已经更新了 storedValue，不需要再渲染
});

// ===== 事件处理 =====

function handleInput() {
  if (isInternalRender) return;
  
  // 标记正在用户输入中
  isUserInputting = true;
  
  writeStoredFromDom();
  
  // 用户输入完成后，在微任务中清除标记
  nextTick(() => {
    isUserInputting = false;
  });

  // 检测 / 触发变量面板
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    closePanel();
    return;
  }
  const range = sel.getRangeAt(0);
  const textBefore = getTextBeforeCursor();
  const lastSlashIdx = textBefore.lastIndexOf('/');

  if (lastSlashIdx === -1) {
    closePanel();
    return;
  }

  const query = textBefore.slice(lastSlashIdx + 1);
  if (!query.includes(' ')) {
    slashQuery.value = query;
    popoverOpen.value = true;
    return;
  }

  closePanel();
}

/** 获取光标位置之前的纯文本（用于检测 / 命令） */
function getTextBeforeCursor(): string {
  if (!editorRef.value) return '';
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';

  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(editorRef.value);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString();
}

function handleKeydown(e: KeyboardEvent) {
  // 变量面板打开时的快捷键
  if (popoverOpen.value) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = inputModeSearchResults.value
        .flatMap((s) => [...s.items, ...(s.children?.flatMap((c) => c.items) || [])])
        .find((i) => i.expression);
      if (first) pickVar(first);
      return;
    }
  }

  // contenteditable 已自动处理 Backspace/Delete 对 token 的整体删除
  // 只需要阻止 / 的默认行为（打开面板但不写入字符）
  if (e.key === '/' && !popoverOpen.value) {
    // 允许 / 字符输入，handleInput 会检测并打开面板
  }
}

function handleFocus() {
  if (blurTimer) {
    clearTimeout(blurTimer);
    blurTimer = null;
  }
}

let blurTimer: ReturnType<typeof setTimeout> | null = null;

function handleBlur() {
  // 失焦时确保存储值同步
  if (!isInternalRender) {
    writeStoredFromDom();
  }
  blurTimer = setTimeout(() => {
    popoverOpen.value = false;
    // 注意：失焦时不清空 slashQuery，避免用户返回后需要重新输入搜索词
  }, 150);
}

function handlePaste(e: ClipboardEvent) {
  // 粘贴纯文本，避免带入 HTML 格式
  e.preventDefault();
  const text = e.clipboardData?.getData('text/plain') || '';
  document.execCommand('insertText', false, text);
  // 粘贴后同步存储值
  nextTick(() => {
    writeStoredFromDom();
  });
}

// ===== 变量插入 =====

function placeCaretAtEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function placeCaretAfterNode(node: Node) {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function insertNodeAtCursor(node: Node) {
  if (!editorRef.value) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editorRef.value.contains(sel.anchorNode)) {
    // 光标不在编辑器内，追加到末尾
    editorRef.value.appendChild(node);
    placeCaretAfterNode(node);
    return;
  }

  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  placeCaretAfterNode(node);
}

function pickVar(item: FlatVarItem) {
  if (!item.expression || item.disabled) return;
  if (blurTimer) {
    clearTimeout(blurTimer);
    blurTimer = null;
  }

  const normalized = normalizeExpr(item.expression);
  const alias = expressionToAlias.value.get(normalized);

  if (alias) {
    // 已知变量 → 插入 token span
    const span = document.createElement('span');
    span.className = 'var-token';
    span.contentEditable = 'false';
    span.dataset.expr = normalized;
    span.textContent = alias;

    // 先删除光标前的 / 命令文本
    deleteSlashQuery();

    insertNodeAtCursor(span);
  } else {
    // 未知变量 → 插入原始表达式文本
    const text = document.createTextNode(normalized);
    deleteSlashQuery();
    insertNodeAtCursor(text);
  }

  // 同步存储值（在 nextTick 中执行，确保 DOM 操作完成）
  // 设置 isUserInputting 防止 watch(storedValue) 触发不必要的 DOM 重渲染
  isUserInputting = true;
  nextTick(() => {
    writeStoredFromDom();
    isUserInputting = false;
  });

  closePanel();
}

/** 删除光标前的 / 搜索命令文本 */
function deleteSlashQuery() {
  if (!editorRef.value) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const textBefore = getTextBeforeCursor();
  const slashIdx = textBefore.lastIndexOf('/');
  if (slashIdx < 0) return;

  const currentStored = domToStoredValue(editorRef.value);
  const storedSlashIdx = currentStored.lastIndexOf('/');
  if (storedSlashIdx < 0) return;

  // 从存储值中删除 / 到对应位置的内容
  // slashQuery 是用户输入的搜索词（不包含 /），所以删除长度 = 1（/）+ 搜索词长度
  const deleteLength = 1 + slashQuery.value.length;
  const newStored = currentStored.slice(0, storedSlashIdx) + currentStored.slice(storedSlashIdx + deleteLength);
  storedValue.value = newStored;
  syncDomFromStored();

  // 光标定位到删除位置
  nextTick(() => {
    if (editorRef.value) {
      const pos = storedSlashIdx;
      setCaretByOffset(editorRef.value, pos);
    }
  });
}

/** 根据文本偏移量设置光标位置 */
function setCaretByOffset(root: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const len = node.nodeValue?.length || 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    remaining -= len;
  }
  // 超出范围，放到末尾
  placeCaretAtEnd(root);
}

function togglePanel() {
  if (!editorRef.value) return;
  if (popoverOpen.value) {
    closePanel();
  } else {
    popoverOpen.value = true;
    slashQuery.value = '';
    editorRef.value.focus();
    placeCaretAtEnd(editorRef.value);
  }
}

// ===== 搜索 =====

const filteredSections = computed<FlatSection[]>(() => {
  if (!searchValue.value.trim()) return flatSections.value;
  const keyword = searchValue.value.toLowerCase();

  return flatSections.value
    .map((section) => {
      const filteredItems = section.items.filter(
        (item) =>
          item.label.toLowerCase().includes(keyword) ||
          item.expression.toLowerCase().includes(keyword),
      );

      const filteredChildren = section.children
        ? section.children
            .map((child) => {
              const childItems = child.items.filter(
                (item) =>
                  item.label.toLowerCase().includes(keyword) ||
                  item.expression.toLowerCase().includes(keyword),
              );
              const childMatch = child.title.toLowerCase().includes(keyword);
              if (childItems.length > 0 || childMatch) {
                return {
                  ...child,
                  items: childMatch ? child.items : childItems,
                };
              }
              return null;
            })
            .filter((c): c is FlatSection => c !== null)
        : undefined;

      const sectionMatch = section.title.toLowerCase().includes(keyword);

      if (filteredItems.length > 0 || sectionMatch || (filteredChildren && filteredChildren.length > 0)) {
        return {
          ...section,
          items: sectionMatch ? section.items : filteredItems,
          children: filteredChildren,
        };
      }
      return null;
    })
    .filter((s) => s !== null) as FlatSection[];
});

const inputModeSearchResults = computed<FlatSection[]>(() => {
  if (!slashQuery.value.trim()) return filteredSections.value;
  const keyword = slashQuery.value.toLowerCase();

  return filteredSections.value
    .map((section) => {
      const filteredItems = section.items.filter(
        (item) =>
          item.label.toLowerCase().includes(keyword) ||
          item.expression.toLowerCase().includes(keyword),
      );

      const filteredChildren = section.children
        ? section.children
            .map((child) => {
              const childItems = child.items.filter(
                (item) =>
                  item.label.toLowerCase().includes(keyword) ||
                  item.expression.toLowerCase().includes(keyword),
              );
              const childMatch = child.title.toLowerCase().includes(keyword);
              if (childItems.length > 0 || childMatch) {
                return {
                  ...child,
                  items: childMatch ? child.items : childItems,
                };
              }
              return null;
            })
            .filter((c): c is FlatSection => c !== null)
        : undefined;

      const sectionMatch = section.title.toLowerCase().includes(keyword);

      if (filteredItems.length > 0 || sectionMatch || (filteredChildren && filteredChildren.length > 0)) {
        return {
          ...section,
          items: sectionMatch ? section.items : filteredItems,
          children: filteredChildren,
        };
      }
      return null;
    })
    .filter((s) => s !== null) as FlatSection[];
});
</script>

<template>
  <div class="var-picker-root">
    <Popover
      v-model:open="popoverOpen"
      :trigger="[]"
      placement="bottomLeft"
      overlay-class-name="var-picker-popover"
      :get-popup-container="(trigger: any) => getPopupContainer(trigger)"
    >
      <template #content>
      <div class="var-dropdown" @click.stop>
        <div class="var-dropdown-header">
          <span class="var-dropdown-title">选择变量</span>
          <span class="var-dropdown-close" @click="closePanel">
            <IconifyIcon icon="mdi:close" :size="14" />
          </span>
        </div>
        <template v-if="inputModeSearchResults.length > 0">
          <div class="var-list-wrap">
            <div v-for="section in inputModeSearchResults" :key="section.key" class="var-section">
              <div class="section-header">
                <IconifyIcon :icon="section.icon" :size="14" class="section-icon" />
                <span class="section-title">{{ section.title }}</span>
              </div>
              <div v-if="section.items.length > 0" class="var-items">
                <div
                  v-for="item in section.items"
                  :key="item.key"
                  class="var-item"
                  :class="{ disabled: item.disabled }"
                  @click="pickVar(item)"
                >
                  <span class="item-label">{{ item.label }}</span>
                  <span v-if="item.type && item.type !== 'any'" class="item-type">{{ item.type }}</span>
                </div>
              </div>
              <div v-if="section.children && section.children.length > 0" class="var-subsections">
                <div v-for="child in section.children" :key="child.key" class="var-subsection">
                  <div class="subsection-header">
                    <IconifyIcon :icon="child.icon" :size="13" class="subsection-icon" />
                    <span class="subsection-title">{{ child.title }}</span>
                  </div>
                  <div v-if="child.items.length > 0" class="var-items">
                    <div
                      v-for="item in child.items"
                      :key="item.key"
                      class="var-item"
                      :class="{ disabled: item.disabled }"
                      @click="pickVar(item)"
                    >
                      <span class="item-label">{{ item.label }}</span>
                      <span v-if="item.type && item.type !== 'any'" class="item-type">{{ item.type }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <Empty v-else :image-style="{ height: '48px' }" description="没有匹配的变量" class="var-empty" />
      </div>
    </template>
    <div class="var-picker-wrapper" :class="{ 'is-disabled': disabled, 'var-picker-sm': size === 'small' }">
      <div
        ref="editorRef"
        class="var-picker-editor"
        :contenteditable="!disabled"
        :data-placeholder="placeholder"
        @input="handleInput"
        @keydown="handleKeydown"
        @focus="handleFocus"
        @blur="handleBlur"
        @paste="handlePaste"
      ></div>
      <span
        class="trigger-icon"
        @mousedown.prevent
        @click.stop="togglePanel"
      >
        <IconifyIcon icon="mdi:variable" :size="14" />
      </span>
    </div>
    </Popover>
  </div>
</template>

<style scoped>
.var-picker-root {
  display: block;
  width: 100%;
}

.var-picker-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 28px;
  padding: 2px 22px 2px 6px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  transition: border-color 0.2s;
  position: relative;
  box-sizing: border-box;
}

.var-picker-wrapper:hover {
  border-color: #4096ff;
}

.var-picker-wrapper:focus-within {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(5, 145, 255, 0.1);
}

.var-picker-wrapper.is-disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.var-picker-editor {
  flex: 1;
  min-height: 24px;
  outline: none;
  font-size: 14px;
  line-height: 24px;
  color: #333;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-y: auto;
}

.var-picker-editor:empty::before {
  content: attr(data-placeholder);
  color: #bfbfbf;
  pointer-events: none;
}

.trigger-icon {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  color: #bfbfbf;
  transition: color 0.2s;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
}

.trigger-icon:hover {
  color: #1677ff;
}

.var-picker-sm {
  min-height: 24px;
  padding: 0 20px 0 6px;
}

.var-picker-sm .var-picker-editor {
  min-height: 20px;
  font-size: 13px;
  line-height: 20px;
}
</style>

<style>
/* ===== VarPicker 下拉面板样式 ===== */
.var-picker-popover .ant-popover-inner {
  padding: 0 !important;
  border-radius: 8px;
  box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05);
}

.var-picker-popover .var-dropdown {
  width: 320px;
  max-height: 420px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.var-picker-popover .var-dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.var-picker-popover .var-dropdown-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.var-picker-popover .var-dropdown-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #999;
  padding: 2px;
  border-radius: 4px;
  transition: all 0.15s;
}

.var-picker-popover .var-dropdown-close:hover {
  color: #666;
  background: #f5f5f5;
}

.var-picker-popover .var-list-wrap {
  max-height: 380px;
  overflow-y: auto;
  padding: 4px 0;
}

.var-picker-popover .var-section {
  padding: 2px 0;
}

.var-picker-popover .section-header {
  display: flex !important;
  align-items: center !important;
  gap: 6px;
  padding: 6px 10px;
  user-select: none;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  background: #fafafa;
}

.var-picker-popover .section-title {
  flex: 1 !important;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.var-picker-popover .section-icon {
  color: #6b7280;
}

.var-picker-popover .var-items {
  padding: 2px 0;
}

.var-picker-popover .var-item {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 6px 12px 6px 32px;
  cursor: pointer;
  transition: background 0.15s;
  width: 100%;
}

.var-picker-popover .var-item:hover {
  background: #e6f4ff;
}

.var-picker-popover .var-item.disabled {
  color: #bfbfbf;
  cursor: not-allowed;
  background: transparent;
}

.var-picker-popover .item-label {
  flex: 1 1 0% !important;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  width: 100%;
}

.var-picker-popover .item-type {
  font-size: 11px;
  color: #9ca3af;
  padding: 1px 6px;
  background: #f3f4f6;
  border-radius: 3px;
  flex: 0 0 auto !important;
  flex-shrink: 0;
  margin-left: auto !important;
  display: inline-block !important;
}

.var-picker-popover .var-subsections {
  padding: 2px 0;
}

.var-picker-popover .var-subsection {
  padding: 0;
}

.var-picker-popover .subsection-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px 6px 32px;
  user-select: none;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}

.var-picker-popover .subsection-icon {
  color: #9ca3af;
}

.var-picker-popover .subsection-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.var-picker-popover .var-empty {
  padding: 32px 16px;
}

/* ===== VarPicker Token 样式（必须在非 scoped 块，因为 token 是动态创建的） ===== */
.var-token {
  display: inline;
  padding: 0 4px;
  margin: 0 1px;
  background: #e6f4ff;
  border-radius: 4px;
  color: #1677ff;
  font-size: 0.85em;
  font-weight: 500;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
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
