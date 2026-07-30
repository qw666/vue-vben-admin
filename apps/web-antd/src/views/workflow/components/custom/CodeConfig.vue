<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, Tooltip } from 'ant-design-vue';

const props = defineProps<{
  nodeConfigForm: Record<string, any>;
}>();

const DEFAULT_SOURCE_CODE = `def main(inputs):
    # 通过 inputs["参数key"] 获取上游传入的数据
    # 业务逻辑编写位置

    # return 字典作为节点输出，传递给下游节点
    return {

    }`;

const inputParams = ref<Array<{ key: string; expression: string; defaultValue: string }>>([]);
const outputKeys = ref<Array<{ key: string; remark: string }>>([]);

const codeValidationError = ref('');
const codeSyntaxErrors = ref<Array<{ line: number; message: string; type: 'error' | 'warning' }>>([]);

const inputsHelpText = `配置输入变量，在代码中通过 inputs["key"] 获取。
- 参数Key：英文字母或下划线开头，仅支持英文字母、数字、下划线
- 变量值：绑定上游变量，如 {{ vars.payload.data }}`;

const outputsHelpText = `输出变量仅用于画布下游节点下拉选择变量，不会注入运行代码。
真实输出由代码中 return 的字典决定，保证运行和配置解耦。`;

const codeHelpText = `必须定义 main(inputs) 函数作为入口，通过 return 字典返回输出。
平台后端自动拼接脚手架代码，用户不需要手动导入 os/json 等系统包。`;

function initForm() {
  if (!props.nodeConfigForm.inputParams) {
    props.nodeConfigForm.inputParams = [];
  }
  if (!props.nodeConfigForm.sourceCode) {
    props.nodeConfigForm.sourceCode = DEFAULT_SOURCE_CODE;
  }
  if (!props.nodeConfigForm.outputKeys) {
    props.nodeConfigForm.outputKeys = [];
  }

  inputParams.value = props.nodeConfigForm.inputParams.map((item: any) => ({
    key: item.key || '',
    expression: item.expression || '',
    defaultValue: item.defaultValue || '',
  }));

  outputKeys.value = props.nodeConfigForm.outputKeys.map((item: any) => {
    if (typeof item === 'string') {
      return { key: item, remark: '' };
    }
    return { key: item.key || '', remark: item.remark || '' };
  });
}

initForm();

watch(
  () => props.nodeConfigForm.inputParams,
  () => {
    inputParams.value = props.nodeConfigForm.inputParams.map((item: any) => ({
      key: item.key || '',
      expression: item.expression || '',
      defaultValue: item.defaultValue || '',
    }));
  },
  { deep: true },
);

watch(
  () => props.nodeConfigForm.outputKeys,
  () => {
    outputKeys.value = props.nodeConfigForm.outputKeys.map((item: any) => {
      if (typeof item === 'string') {
        return { key: item, remark: '' };
      }
      return { key: item.key || '', remark: item.remark || '' };
    });
  },
  { deep: true },
);

const keyPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const duplicateKeyError = computed(() => {
  const keys = inputParams.value.map(p => p.key).filter(k => k);
  const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
  return duplicates;
});

const outputDuplicateKeyError = computed(() => {
  const keys = outputKeys.value.map(p => p.key).filter(k => k);
  const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
  return duplicates;
});

function addInputParam() {
  inputParams.value.push({ key: '', expression: '' });
  syncInputParamsToForm();
}

function removeInputParam(index: number) {
  inputParams.value.splice(index, 1);
  syncInputParamsToForm();
}

function addOutputKey() {
  outputKeys.value.push({ key: '' });
  syncOutputKeysToForm();
}

function removeOutputKey(index: number) {
  outputKeys.value.splice(index, 1);
  syncOutputKeysToForm();
}

function syncInputParamsToForm() {
  props.nodeConfigForm.inputParams = inputParams.value.map(item => ({ ...item }));
}

function syncOutputKeysToForm() {
  props.nodeConfigForm.outputKeys = outputKeys.value.map(item => ({ ...item }));
}

// ===== 校验辅助函数（所有函数按依赖顺序定义）=====

function checkBrackets(code: string, errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>) {
  const lines = code.split('\n');
  const stack: Array<{ char: string; line: number }> = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const openChars = new Set(['(', '[', '{']);
  const closeChars = new Set([')', ']', '}']);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 忽略字符串和注释中的括号
    const cleanLine = line.replace(/['"].*?['"]/g, '').replace(/#.*$/g, '');

    for (const char of cleanLine) {
      if (openChars.has(char)) {
        stack.push({ char, line: i + 1 });
      } else if (closeChars.has(char)) {
        if (stack.length === 0) {
          errors.push({ line: i + 1, message: `多余的闭合符号 "${char}"`, type: 'error' });
        } else {
          const last = stack.pop()!;
          if (pairs[last.char] !== char) {
            errors.push({ line: i + 1, message: `"${last.char}" 与 "${char}" 不匹配`, type: 'error' });
          }
        }
      }
    }
  }

  if (stack.length > 0) {
    for (const item of stack) {
      errors.push({ line: item.line, message: `未闭合的 "${item.char}"`, type: 'error' });
    }
  }
}

function checkQuotes(code: string, errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>) {
  const lines = code.split('\n');
  const quoteStack: Array<{ char: string; line: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let inString = false;
    let stringChar = '';
    let tripleCount = 0;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextTwo = line.substring(j, j + 3);

      if (inString) {
        if (char === stringChar && tripleCount === 0) {
          inString = false;
        }
        continue;
      }

      if (nextTwo === '"""' || nextTwo === "'''") {
        tripleCount = tripleCount === 0 ? 3 : 0;
        j += 2;
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        quoteStack.push({ char, line: i + 1 });
      }
    }

    if (inString && tripleCount === 0) {
      errors.push({ line: i + 1, message: '字符串未闭合', type: 'error' });
    }
  }
}

function checkIndentation(code: string, errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>) {
  const lines = code.split('\n');
  const indentStack: number[] = [0];

  // 能开启缩进的关键字
  const indentKeywords = ['def', 'class', 'for', 'while', 'if', 'elif', 'else', 'try', 'except', 'finally', 'with'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.match(/^\s*/)?.[0].length || 0;

    if (indent > indentStack[indentStack.length - 1]) {
      // 向前找最近的非空非注释行
      let prevCodeLine = '';
      for (let j = i - 1; j >= 0; j--) {
        const prev = lines[j];
        if (prev.trim() && !prev.trim().startsWith('#')) {
          prevCodeLine = prev.trim();
          break;
        }
      }

      // 检查是否是合法的缩进增加
      let isValidIndent = false;
      if (prevCodeLine) {
        // 以冒号、括号、方括号、花括号结尾
        if (prevCodeLine.endsWith(':') || prevCodeLine.endsWith('(') || prevCodeLine.endsWith('[') || prevCodeLine.endsWith('{')) {
          isValidIndent = true;
        }
        // 以关键字开头（如 def、class、for、while、if 等）
        for (const kw of indentKeywords) {
          if (prevCodeLine.startsWith(kw + ' ') || prevCodeLine.startsWith(kw + ':') || prevCodeLine === kw) {
            isValidIndent = true;
            break;
          }
        }
      }

      if (!isValidIndent) {
        errors.push({ line: i + 1, message: '缩进错误：这一行的缩进是非法的', type: 'error' });
      }
      indentStack.push(indent);
    } else if (indent < indentStack[indentStack.length - 1]) {
      // 检查缩进减少是否合法
      // 向前找最近的非空非注释行
      let prevCodeLine = '';
      for (let j = i - 1; j >= 0; j--) {
        const prev = lines[j];
        if (prev.trim() && !prev.trim().startsWith('#')) {
          prevCodeLine = prev.trim();
          break;
        }
      }

      // 如果前一行以冒号结尾（说明这是新代码块的第一行，缩进减少是错误的）
      if (prevCodeLine && prevCodeLine.endsWith(':')) {
        errors.push({ line: i + 1, message: '缩进错误：冒号后面的代码块应该增加缩进', type: 'error' });
      }

      // 缩进减少时，检查是否应该与某个祖先级别的缩进对齐
      while (indentStack.length > 1 && indentStack[indentStack.length - 1] > indent) {
        indentStack.pop();
      }

      if (indentStack[indentStack.length - 1] !== indent) {
        errors.push({ line: i + 1, message: '缩进不一致：与上层缩进级别不匹配', type: 'error' });
      }
    } else if (indent === indentStack[indentStack.length - 1]) {
      // 同级缩进，检查是否是 elif/else/except/finally 等应该减少缩进的情况
      const lineTrimmed = line.trim();
      const specialKeywords = ['elif ', 'else:', 'except ', 'finally:'];
      for (const kw of specialKeywords) {
        if (lineTrimmed.startsWith(kw)) {
          // 向前找最近的非空非注释行
          let prevCodeLine = '';
          for (let j = i - 1; j >= 0; j--) {
            const prev = lines[j];
            if (prev.trim() && !prev.trim().startsWith('#')) {
              prevCodeLine = prev.trim();
              break;
            }
          }
          // 检查上一行是否是对应的 if/try 等（通常应该减少缩进）
          if (prevCodeLine && !prevCodeLine.endsWith(':')) {
            // 如果上一行不是以冒号结尾，可能存在缩进问题
            // 这个检查可以放宽
          }
          break;
        }
      }
    }
  }
}

function checkIndentFormat(code: string, errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>) {
  const lines = code.split('\n');
  let hasTab = false;
  let hasSpaceIndent = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    if (line.startsWith('\t')) {
      hasTab = true;
    } else if (/^ +\S/.test(line)) {
      hasSpaceIndent = true;
      const indentMatch = line.match(/^( +)/);
      if (indentMatch) {
        const indentLen = indentMatch[1].length;
        if (indentLen % 4 !== 0) {
          errors.push({ line: i + 1, message: `缩进不是4的倍数（${indentLen}个空格），建议使用4空格缩进`, type: 'warning' });
        }
      }
    }
  }

  if (hasTab && hasSpaceIndent) {
    errors.push({ line: 1, message: '代码中混用了 Tab 和空格进行缩进，可能导致运行时错误', type: 'warning' });
  }
}

function checkStringPrefixes(code: string, errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>) {
  const lines = code.split('\n');
  const prefixPattern = /\b([rbfRuUbB]{1,2})\s+(['"`])/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('#')) continue;

    const matches = line.matchAll(prefixPattern);
    for (const match of matches) {
      errors.push({
        line: i + 1,
        message: `字符串前缀 "${match[1]}" 与引号之间不能有空格`,
        type: 'error',
      });
    }
  }
}

function checkColonUsage(code: string, errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>) {
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#')) continue;

    if (line.endsWith(':') && !line.includes('{') && !line.includes('}')) {
      // 向后查找第一个非空、非注释的行
      let hasCodeBlock = false;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (!nextLine || nextLine.startsWith('#')) continue;

        // 找到实际代码行，检查缩进是否增加
        const currentIndent = lines[i].match(/^\s*/)?.[0].length || 0;
        const nextIndent = lines[j].match(/^\s*/)?.[0].length || 0;
        if (nextIndent > currentIndent) {
          hasCodeBlock = true;
        }
        break;
      }

      if (!hasCodeBlock) {
        errors.push({
          line: i + 1,
          message: '冒号后面没有代码块内容',
          type: 'error',
        });
      }
    }
  }
}

function checkReturnValue(code: string, errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>) {
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'return') {
      errors.push({
        line: i + 1,
        message: 'return 语句后面没有返回值',
        type: 'error',
      });
    }
  }
}

function checkReturnStatement(code: string, errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>) {
  const mainFuncMatch = code.match(/def\s+main\s*\(\s*inputs\s*\)\s*:/);
  if (!mainFuncMatch) return;

  const lines = code.split('\n');
  const mainStartLine = mainFuncMatch.index !== undefined ? code.substring(0, mainFuncMatch.index).split('\n').length : 0;

  // 简单检查 main 函数内是否有 return
  let inMainFunc = false;
  let hasReturn = false;

  for (let i = mainStartLine; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.match(/^\s*/)?.[0].length || 0;

    if (i === mainStartLine) {
      inMainFunc = true;
      continue;
    }

    if (inMainFunc && indent === 0 && line.trim() && !line.trim().startsWith('#')) {
      break;
    }

    if (inMainFunc && /\breturn\b/.test(line)) {
      hasReturn = true;
    }
  }

  if (inMainFunc && !hasReturn) {
    errors.push({ line: mainStartLine + 1, message: 'main 函数中未找到 return 语句', type: 'warning' });
  }
}

function checkForbiddenImports(code: string, errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>) {
  const lines = code.split('\n');
  const forbidden = ['os', 'sys', 'subprocess', 'importlib'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import') || line.startsWith('from')) {
      for (const mod of forbidden) {
        if (line.includes(mod)) {
          errors.push({ line: i + 1, message: `不允许导入 "${mod}" 模块，平台会自动处理`, type: 'warning' });
        }
      }
    }
  }
}

function validateCode(): boolean {
  const code = props.nodeConfigForm.sourceCode || '';
  const errors: Array<{ line: number; message: string; type: 'error' | 'warning' }> = [];

  // 1. 检查 main(inputs) 函数
  const hasMainFunction = /def\s+main\s*\(\s*inputs\s*\)/.test(code);
  if (!hasMainFunction) {
    errors.push({ line: 1, message: '代码中未找到 main(inputs) 函数', type: 'error' });
  }

  // 2. 检查括号匹配
  checkBrackets(code, errors);

  // 3. 检查引号匹配
  checkQuotes(code, errors);

  // 4. 检查缩进一致性
  checkIndentation(code, errors);

  // 5. 检查 return 语句
  checkReturnStatement(code, errors);

  // 6. 检查不允许的导入
  checkForbiddenImports(code, errors);

  // 7. 检查行首缩进格式（不能混用 tab 和空格）
  checkIndentFormat(code, errors);

  // 8. 检查 raw string 语法（r/b/f/u 前缀不能与引号有空格）
  checkStringPrefixes(code, errors);

  // 9. 检查每个冒号后面是否有代码（不能空冒号）
  checkColonUsage(code, errors);

  // 10. 检查 return 后面是否有值（不能有空 return）
  checkReturnValue(code, errors);

  codeSyntaxErrors.value = errors;
  codeValidationError.value = errors.filter(e => e.type === 'error').map(e => `第${e.line}行: ${e.message}`).join('; ');

  return !errors.some(e => e.type === 'error');
}

// 格式化代码
function formatCode() {
  const code = props.nodeConfigForm.sourceCode || '';
  const lines = code.split('\n');
  const result: string[] = [];
  const indentUnit = '    '; // 4 spaces
  let indentLevel = 0;
  let inString = false;
  let stringChar = '';
  let stringLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 处理多行字符串
    if (inString) {
      stringLines.push(line);
      if (trimmed.endsWith(stringChar.repeat(3)) || trimmed.endsWith(stringChar)) {
        // 检查是否结束
        const stripped = line.trimEnd();
        if (stripped.endsWith(stringChar.repeat(3)) || stripped.endsWith(stringChar)) {
          inString = false;
          result.push(stringLines.join('\n'));
          stringLines = [];
        }
      }
      continue;
    }

    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) {
      result.push('');
      continue;
    }

    // 检查是否进入多行字符串
    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      inString = true;
      stringChar = trimmed[0] === '"' ? '"' : "'";
      stringLines = [line];
      if (trimmed.split(stringChar.repeat(3)).length - 1 >= 2) {
        // 单行多行字符串
        inString = false;
        result.push(indentUnit.repeat(indentLevel) + trimmed);
        stringLines = [];
      }
      continue;
    }

    // 调整缩进层级（基于上一行）
    if (result.length > 0) {
      const lastLine = result[result.length - 1].trim();
      if (lastLine.endsWith(':') || lastLine.endsWith('(') || lastLine.endsWith('[') || lastLine.endsWith('{')) {
        indentLevel++;
      }
      // 简化逻辑：基于花括号/方括号的平衡
      // 这里只是基本格式化，不做复杂语法分析
    }

    // 检查是否减少缩进
    // 简化处理：如果行以 return、elif、else、except、finally、break、continue、pass 开头
    const dedentKeywords = ['elif ', 'else:', 'except ', 'finally:', 'break', 'continue', 'pass'];
    const isDedentLine = dedentKeywords.some(kw => trimmed.startsWith(kw));
    if (isDedentLine && indentLevel > 0) {
      indentLevel--;
    }

    // 输出格式化的行
    result.push(indentUnit.repeat(indentLevel) + trimmed);

    // 如果行以冒号、括号等结尾，增加缩进
    if (trimmed.endsWith(':') || trimmed.endsWith('(') || trimmed.endsWith('[') || trimmed.endsWith('{')) {
      indentLevel++;
    }

    // 如果行以右括号等结尾，减少缩进
    if (trimmed.endsWith(')') || trimmed.endsWith(']') || trimmed.endsWith('}')) {
      if (indentLevel > 0) indentLevel--;
    }
  }

  // 合并结果，清理多余空行
  let formatted = result.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();

  // 确保结尾有空行
  if (!formatted.endsWith('\n')) {
    formatted += '\n';
  }

  props.nodeConfigForm.sourceCode = formatted;
  validateCode();
}

watch(
  () => props.nodeConfigForm.sourceCode,
  () => {
    validateCode();
  },
  { immediate: true },
);

function handleValidate() {
  return validateCode();
}

// 暴露给父组件使用
defineExpose({
  validate: handleValidate,
  getSyntaxErrors: () => codeSyntaxErrors.value,
  hasErrors: () => codeSyntaxErrors.value.some(e => e.type === 'error'),
});

function validateKeyFormat(key: string): boolean {
  if (!key) return true;
  return keyPattern.test(key);
}
</script>

<template>
  <div class="code-config">
    <!-- 输入参数 -->
    <div class="section-block">
      <div class="section-header">
        <div class="section-title">
          <span>输入参数</span>
        </div>
        <div class="section-header-right">
          <Button type="link" size="small" class="add-btn" @click="addInputParam">
            <IconifyIcon icon="mdi:plus" :size="14" />
            添加变量
          </Button>
          <Tooltip :title="inputsHelpText" placement="right">
            <span class="help-icon-wrapper">
              <IconifyIcon icon="mdi:help-circle" :size="14" class="help-icon" />
            </span>
          </Tooltip>
        </div>
      </div>

      <template v-if="inputParams.length > 0">
        <div class="list-header">
          <span class="col-key">参数Key</span>
          <span class="col-expression">上游来源表达式</span>
          <span class="col-action"></span>
        </div>

        <div
          v-for="(param, index) in inputParams"
          :key="index"
          class="form-row"
          :class="{ 'has-error': !validateKeyFormat(param.key) || duplicateKeyError.includes(param.key) }"
        >
          <Input
            v-model:value="param.key"
            placeholder="英文、下划线开头"
            class="col-key"
            @input="syncInputParamsToForm"
            :status="!validateKeyFormat(param.key) || duplicateKeyError.includes(param.key) ? 'error' : ''"
          />
          <Input
            v-model:value="param.expression"
            placeholder="{{ vars.xxx }}"
            class="col-expression"
            @input="syncInputParamsToForm"
          />
          <Button
            type="text"
            size="small"
            @click="removeInputParam(index)"
            class="col-action"
          >
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
      </template>

      <div v-else class="empty-tip">
        暂无输入参数，点击上方按钮添加
      </div>

      <div v-if="duplicateKeyError.length > 0" class="error-message">
        <IconifyIcon icon="mdi:alert" :size="12" />
        <span>参数Key重复：{{ duplicateKeyError.join(', ') }}</span>
      </div>
    </div>

    <!-- 代码 -->
    <div class="section-block">
      <div class="section-header">
        <div class="section-title">
          <span>代码</span>
        </div>
        <div class="section-header-right">
          <div class="section-actions">
            <Tooltip title="校验代码" placement="left">
              <Button type="text" size="small" @click="handleValidate">
                <IconifyIcon icon="mdi:check-circle" :size="14" />
              </Button>
            </Tooltip>
            <Tooltip title="格式化代码" placement="left">
              <Button type="text" size="small" @click="formatCode">
                <IconifyIcon icon="mdi:code-braces" :size="14" />
              </Button>
            </Tooltip>
            <Tooltip title="重置为默认模板" placement="left">
              <Button type="text" size="small" @click="nodeConfigForm.sourceCode = DEFAULT_SOURCE_CODE">
                <IconifyIcon icon="mdi:refresh" :size="14" />
              </Button>
            </Tooltip>
          </div>
          <Tooltip :title="codeHelpText" placement="right">
            <span class="help-icon-wrapper">
              <IconifyIcon icon="mdi:help-circle" :size="14" class="help-icon" />
            </span>
          </Tooltip>
        </div>
      </div>

      <div class="code-editor-wrapper">
        <div class="code-line-numbers">
          <div v-for="n in Math.max((nodeConfigForm.sourceCode || '').split('\n').length, 1)" :key="n" class="line-number">{{ n }}</div>
        </div>
        <textarea
          v-model="nodeConfigForm.sourceCode"
          class="code-textarea"
          spellcheck="false"
          @input="validateCode"
        ></textarea>
      </div>

      <!-- 语法错误列表 -->
      <div v-if="codeSyntaxErrors.length > 0" class="syntax-errors">
        <div
          v-for="(error, index) in codeSyntaxErrors"
          :key="index"
          class="syntax-error-item"
          :class="error.type === 'error' ? 'error' : 'warning'"
        >
          <IconifyIcon
            :icon="error.type === 'error' ? 'mdi:alert-circle' : 'mdi:alert-outline'"
            :size="12"
          />
          <span class="syntax-error-line">第{{ error.line }}行</span>
          <span class="syntax-error-msg">{{ error.message }}</span>
        </div>
      </div>

      <!-- 校验通过提示 -->
      <div v-else-if="nodeConfigForm.sourceCode" class="code-status-ok">
        <IconifyIcon icon="mdi:check-circle" :size="12" />
        <span>代码语法校验通过</span>
      </div>
    </div>

    <!-- 输出字段 -->
    <div class="section-block">
      <div class="section-header">
        <div class="section-title">
          <span>输出字段</span>
        </div>
        <div class="section-header-right">
          <Button type="link" size="small" class="add-btn" @click="addOutputKey">
            <IconifyIcon icon="mdi:plus" :size="14" />
            添加变量
          </Button>
          <Tooltip :title="outputsHelpText" placement="right">
            <span class="help-icon-wrapper">
              <IconifyIcon icon="mdi:help-circle" :size="14" class="help-icon" />
            </span>
          </Tooltip>
        </div>
      </div>

      <template v-if="outputKeys.length > 0">
        <div class="list-header">
          <span class="col-output-key">输出Key</span>
          <span class="col-action"></span>
        </div>

        <div
          v-for="(output, index) in outputKeys"
          :key="index"
          class="form-row"
          :class="{ 'has-error': outputDuplicateKeyError.includes(output.key) }"
        >
          <Input
            v-model:value="output.key"
            placeholder="输出变量名"
            class="col-output-key"
            @input="syncOutputKeysToForm"
            :status="outputDuplicateKeyError.includes(output.key) ? 'error' : ''"
          />
          <Button
            type="text"
            size="small"
            @click="removeOutputKey(index)"
            class="col-action"
          >
            <IconifyIcon icon="mdi:close" :size="14" />
          </Button>
        </div>
      </template>

      <div v-else class="empty-tip">
        暂无输出字段，点击上方按钮添加
      </div>

      <div v-if="outputDuplicateKeyError.length > 0" class="error-message">
        <IconifyIcon icon="mdi:alert" :size="12" />
        <span>输出Key重复：{{ outputDuplicateKeyError.join(', ') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.code-config {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  padding-top: 8px;
}

.section-block {
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.section-title::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9ca3af;
  margin-right: 8px;
}

.section-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.help-icon-wrapper {
  display: inline-flex;
  align-items: center;
}

.help-icon {
  color: #6b7280;
  cursor: help;
  transition: color 0.2s;
  pointer-events: none;
}

.help-icon:hover {
  color: #3b82f6;
}

.add-btn {
  font-size: 13px !important;
  color: #3b82f6;
}

.add-btn:hover {
  color: #2563eb;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.section-actions :deep(.ant-btn) {
  color: #9ca3af;
}

.section-actions :deep(.ant-btn:hover) {
  color: #3b82f6;
}

.list-header {
  display: flex;
  gap: 8px;
  padding: 0 0 4px;
  font-size: 12px;
  color: #6b7280;
}

.list-header .col-key {
  width: 30%;
}

.list-header .col-expression {
  flex: 1;
}

.list-header .col-output-key {
  flex: 1;
}

.list-header .col-action {
  width: 32px;
}

.form-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.form-row.has-error :deep(.ant-input) {
  border-color: #ef4444;
}

.col-key {
  width: 30% !important;
}

.col-expression {
  flex: 1;
}

.col-output-key {
  flex: 1;
}

.col-action {
  width: 32px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
  color: #9ca3af;
  flex-shrink: 0;
}

.col-action:hover {
  color: #ef4444;
}

.empty-tip {
  padding: 8px 0;
  font-size: 12px;
  color: #9ca3af;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 6px 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  font-size: 12px;
  color: #dc2626;
}

.code-editor-wrapper {
  position: relative;
  display: flex;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.code-textarea {
  flex: 1;
  min-height: 280px;
  padding: 10px 12px 10px 40px;
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #1f2937;
  background: #fff;
  border: none;
  resize: vertical;
  outline: none;
  tab-size: 4;
}

.code-textarea:focus {
  box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.5);
}

.code-line-numbers {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 32px;
  padding: 10px 6px;
  text-align: right;
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #9ca3af;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  user-select: none;
  overflow: hidden;
}

.code-line-numbers .line-number {
  min-height: 19.5px;
}

.syntax-errors {
  margin-top: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}

.syntax-error-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.syntax-error-item:last-child {
  border-bottom: none;
}

.syntax-error-item.error {
  background: #fef2f2;
  color: #dc2626;
}

.syntax-error-item.error .syntax-error-line {
  font-weight: 600;
}

.syntax-error-item.warning {
  background: #fffbeb;
  color: #b45309;
}

.syntax-error-item.warning .syntax-error-line {
  font-weight: 600;
}

.syntax-error-line {
  white-space: nowrap;
}

.syntax-error-msg {
  flex: 1;
}

.code-status-ok {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 6px 10px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 4px;
  font-size: 12px;
  color: #16a34a;
}
</style>
