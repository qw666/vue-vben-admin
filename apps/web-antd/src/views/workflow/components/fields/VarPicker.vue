<script lang="ts" setup>
import type { VarNode } from '#/types/workflow';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Empty, Input, Popover } from 'ant-design-vue';

import { isSingleVarRef, useVarSources } from '../../composables/useVarSources';

/**
 * VarPicker - 变量选择器
 * 始终表现为输入框，通过 / 快捷键触发变量选择面板。
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

/**
 * 本地输入值 ref —— 解决受控 Input 的时序问题。
 * 用户输入时立即更新本地 ref，Input 不会因为 currentValue 尚未同步而擦除字符。
 */
const inputValue = ref(currentValue.value);

watch(currentValue, (val) => {
  if (val !== inputValue.value) {
    inputValue.value = val;
  }
}, { immediate: true });

const isUnmounting = ref(false);

onBeforeUnmount(() => {
  isUnmounting.value = true;
});

function writeValue(val: string) {
  if (isUnmounting.value) return;
  inputValue.value = val;
  if (props.field && props.nodeConfigForm) {
    props.nodeConfigForm[fieldKey.value] = val;
  }
  emit('update:value', val);
  emit('change', val);
}

// ===== 状态 =====

const popoverOpen = ref(false);
const searchValue = ref('');

// ===== 变量查找 =====

function findVarInTree(nodes: VarNode[], expression: string): VarNode | undefined {
  for (const node of nodes) {
    if (node.expression === expression) return node;
    if (node.children && node.children.length > 0) {
      const found = findVarInTree(node.children, expression);
      if (found) return found;
    }
  }
  return undefined;
}

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
  order: number;
  items: FlatVarItem[];
  children?: FlatSection[];
}

const flatSections = computed<FlatSection[]>(() => {
  const sections: FlatSection[] = [];

  for (const group of availableVars.value) {
    if (group.group === 'upstream') {
      const nodeSections: FlatSection[] = [];
      for (const child of group.children || []) {
        if (child.children && child.children.length > 0) {
          nodeSections.push({
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
        } else {
          nodeSections.push({
            key: child.key,
            title: child.label,
            icon: child.icon || 'mdi:cube-outline',
            order: 0,
            items: [{
              key: `${child.key}-placeholder`,
              label: '暂无输出变量',
              expression: '',
              disabled: true,
            }],
          });
        }
      }
      if (nodeSections.length > 0) {
        sections.push({
          key: group.key,
          title: group.label,
          icon: group.icon || 'mdi:source-branch',
          order: group.order ?? 10,
          items: [],
          children: nodeSections,
        });
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
        order: group.order ?? 100,
        items,
      });
    }
  }

  return sections.sort((a, b) => a.order - b.order);
});

// ===== 展开/折叠 =====

const expandedSections = ref<Set<string>>(new Set());

watch(
  flatSections,
  (sections) => {
    const keys = new Set<string>();
    for (const s of sections) {
      keys.add(s.key);
      if (s.children) {
        for (const c of s.children) keys.add(c.key);
      }
    }
    expandedSections.value = keys;
  },
  { immediate: true },
);

function toggleSection(key: string) {
  const next = new Set(expandedSections.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedSections.value = next;
}

function isExpanded(key: string): boolean {
  return expandedSections.value.has(key);
}

// ===== 搜索（select 模式面板用）=====

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
    .filter((s): s is FlatSection => s !== null);
});

// ===== Input / 触发 =====

const inputRef = ref<any>(null);
const slashQuery = ref('');
let blurTimer: ReturnType<typeof setTimeout> | null = null;

function getNativeInput(): HTMLInputElement | null {
  if (!inputRef.value) return null;
  const el = inputRef.value.$el || inputRef.value;
  return (el.querySelector?.('input') as HTMLInputElement) || (el as HTMLInputElement);
}

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  // inputValue 已通过 v-model 自动更新，这里只需同步到父组件并检测 / 触发
  writeValue(target.value);

  const cursor = target.selectionStart ?? target.value.length;
  const textBefore = target.value.slice(0, cursor);
  const lastSlashIdx = textBefore.lastIndexOf('/');

  if (lastSlashIdx === -1) {
    popoverOpen.value = false;
    slashQuery.value = '';
    return;
  }

  // 输入 / 即触发变量选择（与 Dify 行为一致）
  // 搜索词（/ 后到光标之间的文本）不含空格时保持面板打开
  const query = textBefore.slice(lastSlashIdx + 1);
  if (!query.includes(' ')) {
    slashQuery.value = query;
    popoverOpen.value = true;
    return;
  }

  popoverOpen.value = false;
  slashQuery.value = '';
}

function handleKeydown(e: KeyboardEvent) {
  if (!popoverOpen.value) {
    if (e.key === '/') {
      popoverOpen.value = false;
    }
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    popoverOpen.value = false;
    slashQuery.value = '';
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

function handleFocus() {
  if (blurTimer) {
    clearTimeout(blurTimer);
    blurTimer = null;
  }
}

function handleBlur() {
  blurTimer = setTimeout(() => {
    popoverOpen.value = false;
  }, 150);
}

function togglePanel() {
  if (popoverOpen.value) {
    popoverOpen.value = false;
    slashQuery.value = '';
  } else {
    popoverOpen.value = true;
    slashQuery.value = '';
  }
}

function pickVar(item: FlatVarItem) {
  if (!item.expression || item.disabled) return;
  if (blurTimer) {
    clearTimeout(blurTimer);
    blurTimer = null;
  }
  insertAtCursor(item.expression);
}

function insertAtCursor(expression: string) {
  if (blurTimer) {
    clearTimeout(blurTimer);
    blurTimer = null;
  }

  const input = getNativeInput();
  const value = inputValue.value;
  const cursor = input ? (input.selectionStart ?? value.length) : value.length;

  const textBefore = value.slice(0, cursor);
  const lastSlashIdx = textBefore.lastIndexOf('/');

  // 找到触发变量选择的 / 位置，选中的变量将替换 / 及其后的搜索词
  let insertStart = cursor;
  if (lastSlashIdx >= 0) {
    insertStart = lastSlashIdx;
  }

  const rawExpr = expression.includes('{{') ? expression : '{{ ' + expression + ' }}';
  const before = value.slice(0, insertStart);
  const after = value.slice(cursor);
  const newValue = before + rawExpr + after;
  writeValue(newValue);
  popoverOpen.value = false;
  slashQuery.value = '';

  setTimeout(() => {
    if (input) {
      input.focus();
      const pos = before.length + rawExpr.length;
      input.setSelectionRange(pos, pos);
    }
  }, 0);
}

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
    .filter((s): s is FlatSection => s !== null);
});
</script>

<template>
  <Popover
    v-model:open="popoverOpen"
    trigger=""
    placement="bottomLeft"
    overlay-class-name="var-picker-popover"
    :get-popup-container="(trigger: any) => (trigger?.parentNode || document.body)"
  >
    <template #content>
      <div class="var-dropdown" @click.stop>
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
    <Input
      ref="inputRef"
      :value="inputValue"
      :placeholder="placeholder"
      :size="size"
      :disabled="disabled"
      @input="handleInput"
      @keydown="handleKeydown"
      @focus="handleFocus"
      @blur="handleBlur"
      :class="['var-picker', { 'var-picker-sm': size === 'small', 'var-picker-disabled': disabled }]"
    >
      <template #suffix>
        <span
          class="trigger-icon"
          @mousedown.prevent
          @click.stop="togglePanel"
        >
          <IconifyIcon icon="mdi:variable" :size="14" />
        </span>
      </template>
    </Input>
  </Popover>
</template>

<style scoped>
.var-picker {
  width: 100%;
}

.trigger-icon {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  color: #bfbfbf;
  transition: color 0.2s;
}

.trigger-icon:hover {
  color: #1677ff;
}

/* ===== 下拉面板 ===== */
.var-dropdown {
  width: 320px;
  max-height: 420px;
  overflow: hidden;
}

.var-list-wrap {
  max-height: 380px;
  overflow-y: auto;
  padding: 4px 0;
}

.var-section {
  padding: 2px 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  user-select: none;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  background: #fafafa;
}

.section-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-icon {
  color: #6b7280;
}

.var-items {
  padding: 2px 0;
}

.var-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 32px;
  cursor: pointer;
  transition: background 0.15s;
}

.var-item:hover {
  background: #e6f4ff;
}

.var-item.disabled {
  color: #bfbfbf;
  cursor: not-allowed;
  background: transparent;
}

.item-label {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-type {
  font-size: 11px;
  color: #9ca3af;
  padding: 1px 6px;
  background: #f3f4f6;
  border-radius: 3px;
}

.var-subsections {
  padding: 2px 0;
}

.var-subsection {
  padding: 0;
}

.subsection-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px 6px 32px;
  user-select: none;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}

.subsection-icon {
  color: #9ca3af;
}

.subsection-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.var-empty {
  padding: 32px 16px;
}
</style>

<style>
.var-picker-popover .ant-popover-inner {
  padding: 0 !important;
  border-radius: 8px;
  box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05);
}
</style>
