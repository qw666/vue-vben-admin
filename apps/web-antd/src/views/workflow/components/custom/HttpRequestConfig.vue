<script lang="ts" setup>
import { ref, watch, nextTick } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Checkbox,
  CheckboxGroup,
  Input,
  InputNumber,
  Select,
  Switch,
  Tabs,
  Tooltip,
} from 'ant-design-vue';

const props = defineProps<{
  nodeConfigForm: Record<string, any>;
}>();

const activeTabKey = ref('body');
const authExpanded = ref(true);
const settingsExpanded = ref(false);

const methodOptions = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
];

const bodyTypeOptions = [
  { value: 'none', label: 'none' },
  { value: 'form-data', label: 'form-data' },
  { value: 'url-encoded', label: 'x-www-form-urlencoded' },
  { value: 'json', label: 'json' },
];

const authTypeOptions = [
  { value: null, label: '无' },
  { value: 'BASIC', label: 'Basic Auth' },
  { value: 'BEARER', label: 'Bearer Token' },
  { value: 'DIGEST', label: 'Digest Auth' },
];

const logOptions = [
  { value: 'REQUEST_HEADERS', label: '请求头' },
  { value: 'REQUEST_BODY', label: '请求体' },
  { value: 'RESPONSE_HEADERS', label: '响应头' },
  { value: 'RESPONSE_BODY', label: '响应体' },
];

const charsetOptions = [
  { value: 'utf8', label: 'utf8' },
  { value: 'GBK', label: 'GBK' },
  { value: 'GB2312', label: 'GB2312' },
  { value: 'ISO-8859-1', label: 'ISO-8859-1' },
  { value: 'US-ASCII', label: 'US-ASCII' },
];

if (props.nodeConfigForm.method === undefined)
  props.nodeConfigForm.method = 'POST';
if (props.nodeConfigForm.body === undefined) props.nodeConfigForm.body = '';
if (props.nodeConfigForm.uri === undefined) props.nodeConfigForm.uri = '';
if (props.nodeConfigForm.headers === undefined)
  props.nodeConfigForm.headers = {};
if (props.nodeConfigForm.params === undefined) props.nodeConfigForm.params = {};
if (props.nodeConfigForm.formData === undefined)
  props.nodeConfigForm.formData = {};

if (props.nodeConfigForm.bodyType === undefined) {
  const contentType = props.nodeConfigForm.contentType || 'application/json';
  props.nodeConfigForm.bodyType = contentType === 'multipart/form-data' ? 'form-data'
    : contentType === 'application/x-www-form-urlencoded' ? 'url-encoded'
    : 'json';
}

if (!props.nodeConfigForm.options) {
  props.nodeConfigForm.options = {
    auth: null,
    connectTimeout: 'PT30S',
    readTimeout: 'PT10S',
    ssl: { insecureTrustAllCertificates: true },
    logs: [],
    defaultCharset: 'utf8',
  };
} else {
  if (!props.nodeConfigForm.options.auth)
    props.nodeConfigForm.options.auth = null;
  if (!props.nodeConfigForm.options.connectTimeout)
    props.nodeConfigForm.options.connectTimeout = 'PT30S';
  if (!props.nodeConfigForm.options.readTimeout)
    props.nodeConfigForm.options.readTimeout = 'PT10S';
  if (!props.nodeConfigForm.options.ssl) {
    props.nodeConfigForm.options.ssl = { insecureTrustAllCertificates: true };
  } else {
    if (props.nodeConfigForm.options.ssl.insecureTrustAllCertificates !== undefined) {
      props.nodeConfigForm.options.ssl.insecureTrustAllCertificates =
        props.nodeConfigForm.options.ssl.insecureTrustAllCertificates === true ||
        props.nodeConfigForm.options.ssl.insecureTrustAllCertificates === 'true';
    } else {
      props.nodeConfigForm.options.ssl.insecureTrustAllCertificates = true;
    }
  }
  if (!props.nodeConfigForm.options.logs)
    props.nodeConfigForm.options.logs = [];
  if (!props.nodeConfigForm.options.defaultCharset)
    props.nodeConfigForm.options.defaultCharset = 'utf8';
}

if (!props.nodeConfigForm.timeout)
  props.nodeConfigForm.timeout = 'PT10M';

function objectToArray(
  obj: Record<string, any> | undefined,
): Array<{ enabled: boolean; key: string; value: string; }> {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    return obj.map(item => ({
      key: item.key || '',
      value: item.value !== undefined ? String(item.value) : '',
      enabled: item.enabled !== undefined ? item.enabled : true,
    }));
  }
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    enabled: true,
  }));
}

let isUpdatingForm = false;

const headersArray = ref<Array<{ enabled: boolean; key: string; value: string; }>>([]);
const paramsArray = ref<Array<{ enabled: boolean; key: string; value: string; }>>([]);
const formDataArray = ref<Array<{ enabled: boolean; key: string; value: string; }>>([]);

headersArray.value = objectToArray(props.nodeConfigForm.headers);
paramsArray.value = objectToArray(props.nodeConfigForm.params);
formDataArray.value = objectToArray(props.nodeConfigForm.formData);

watch(
  () => [props.nodeConfigForm.headers, props.nodeConfigForm.params, props.nodeConfigForm.formData],
  ([headers, params, formData]) => {
    if (!isUpdatingForm) {
      headersArray.value = objectToArray(headers);
      paramsArray.value = objectToArray(params);
      formDataArray.value = objectToArray(formData);
    }
  },
  { deep: true },
);

function parseDuration(duration: string): { unit: string; value: number; } {
  const match = duration?.match(/PT(\d+)([HM]?)/);
  if (match) {
    const value = Number.parseInt(match[1]);
    const unit = match[2] === 'H' ? '小时' : match[2] === 'M' ? '分钟' : '秒';
    return { value, unit };
  }
  return { value: 30, unit: '秒' };
}

function formatDuration(value: number, unit: string): string {
  const unitMap: Record<string, string> = { 秒: 'S', 分钟: 'M', 小时: 'H' };
  return `PT${value}${unitMap[unit] || 'S'}`;
}

const connectTimeoutValue = ref(30);
const connectTimeoutUnit = ref('秒');
const readTimeoutValue = ref(10);
const readTimeoutUnit = ref('秒');

const showPassword = ref(false);
const showToken = ref(false);

function syncTimeoutFromForm() {
  const connectParsed = parseDuration(
    props.nodeConfigForm.options.connectTimeout || 'PT30S',
  );
  connectTimeoutValue.value = connectParsed.value;
  connectTimeoutUnit.value = connectParsed.unit;

  const readParsed = parseDuration(
    props.nodeConfigForm.options.readTimeout || 'PT10S',
  );
  readTimeoutValue.value = readParsed.value;
  readTimeoutUnit.value = readParsed.unit;
}

syncTimeoutFromForm();

watch(
  () => [props.nodeConfigForm.options.connectTimeout, props.nodeConfigForm.options.readTimeout],
  () => {
    syncTimeoutFromForm();
  },
  { deep: true },
);

function addKeyValueRow(
  arr: Array<{ enabled: boolean; key: string; value: string; }>,
) {
  arr.push({ key: '', value: '', enabled: true });
}

function removeKeyValueRow(
  arr: Array<{ enabled: boolean; key: string; value: string; }>,
  index: number,
) {
  arr.splice(index, 1);
}

function toggleKeyValueEnabled(
  arr: Array<{ enabled: boolean; key: string; value: string; }>,
  index: number,
) {
  arr[index].enabled = !arr[index].enabled;
}

function setAuthType(type: null | string) {
  if (!type) {
    props.nodeConfigForm.options.auth = null;
  } else if (type === 'BASIC') {
    props.nodeConfigForm.options.auth = {
      type: 'BASIC',
      username: '',
      password: '',
    };
  } else if (type === 'BEARER') {
    props.nodeConfigForm.options.auth = { type: 'BEARER', token: '' };
  } else if (type === 'DIGEST') {
    props.nodeConfigForm.options.auth = {
      type: 'DIGEST',
      username: '',
      password: '',
    };
  }
}

function formatJson() {
  try {
    const parsed = JSON.parse(props.nodeConfigForm.body);
    props.nodeConfigForm.body = JSON.stringify(parsed, null, 2);
  } catch {
    console.warn('Invalid JSON, cannot format');
  }
}

function syncArraysToForm() {
  isUpdatingForm = true;
  props.nodeConfigForm.headers = headersArray.value
    .filter((i) => i.enabled)
    .reduce(
      (acc, item) => {
        if (item.key) acc[item.key] = item.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  props.nodeConfigForm.params = paramsArray.value
    .filter((i) => i.enabled)
    .reduce(
      (acc, item) => {
        if (item.key) acc[item.key] = item.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  props.nodeConfigForm.formData = formDataArray.value
    .filter((i) => i.enabled)
    .reduce(
      (acc, item) => {
        if (item.key) acc[item.key] = item.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  setTimeout(() => {
    isUpdatingForm = false;
  }, 0);
}

function syncTimeoutToForm() {
  props.nodeConfigForm.options.connectTimeout = formatDuration(
    connectTimeoutValue.value,
    connectTimeoutUnit.value,
  );
  props.nodeConfigForm.options.readTimeout = formatDuration(
    readTimeoutValue.value,
    readTimeoutUnit.value,
  );
}

watch(headersArray, syncArraysToForm, { deep: true });
watch(paramsArray, syncArraysToForm, { deep: true });
watch(formDataArray, syncArraysToForm, { deep: true });
watch([connectTimeoutValue, connectTimeoutUnit], syncTimeoutToForm);
watch([readTimeoutValue, readTimeoutUnit], syncTimeoutToForm);

watch(
  () => props.nodeConfigForm.bodyType,
  (val) => {
    const contentTypeMap: Record<string, string> = {
      none: 'application/json',
      'form-data': 'multipart/form-data',
      'url-encoded': 'application/x-www-form-urlencoded',
      json: 'application/json',
    };
    props.nodeConfigForm.contentType =
      contentTypeMap[val] || 'application/json';
  },
  { immediate: true },
);
</script>

<template>
  <div class="http-request-config">
    <div class="config-section">
      <div class="section-header">
        <span style="font-size: 14px; font-weight: 500; color: #374151">请求方式</span>
      </div>
      <div class="request-bar">
        <Select
          v-model:value="nodeConfigForm.method"
          :options="methodOptions"
          class="method-select"
        />
        <Input
          v-model:value="nodeConfigForm.uri"
          placeholder="请输入请求URL"
          class="url-input"
        />
        <span class="required-star">*</span>
      </div>
    </div>

    <Tabs v-model:active-key="activeTabKey" class="config-tabs">
      <Tabs.TabPane tab="Params" key="params">
        <div class="tab-content">
          <div class="content-header">
            <span class="header-label">URL查询参数</span>
            <Button
              type="text"
              size="small"
              @click="addKeyValueRow(paramsArray)"
              class="add-btn"
            >
              <IconifyIcon icon="mdi:plus" :size="14" /> 添加参数
            </Button>
          </div>
          <div class="key-value-list">
            <div
              v-for="(item, index) in paramsArray"
              :key="index"
              class="key-value-row"
              :class="{ disabled: !item.enabled }"
            >
              <Checkbox
                :checked="item.enabled"
                @change="toggleKeyValueEnabled(paramsArray, index)"
                class="enabled-checkbox"
              />
              <Input
                v-model:value="item.key"
                placeholder="Key"
                size="small"
                class="key-input"
              />
              <Input
                v-model:value="item.value"
                placeholder="Value"
                size="small"
                class="value-input"
              />
              <Button
                type="text"
                size="small"
                danger
                @click="removeKeyValueRow(paramsArray, index)"
                class="remove-btn"
              >
                <IconifyIcon icon="mdi:close" :size="12" />
              </Button>
            </div>
            <div v-if="paramsArray.length === 0" class="empty-tip">
              暂无查询参数，点击上方按钮添加
            </div>
          </div>
        </div>
      </Tabs.TabPane>

      <Tabs.TabPane tab="Headers" key="headers">
        <div class="tab-content">
          <div class="content-header">
            <span class="header-label">请求头</span>
            <Button
              type="text"
              size="small"
              @click="addKeyValueRow(headersArray)"
              class="add-btn"
            >
              <IconifyIcon icon="mdi:plus" :size="14" /> 添加请求头
            </Button>
          </div>
          <div class="key-value-list">
            <div
              v-for="(item, index) in headersArray"
              :key="index"
              class="key-value-row"
              :class="{ disabled: !item.enabled }"
            >
              <Checkbox
                :checked="item.enabled"
                @change="toggleKeyValueEnabled(headersArray, index)"
                class="enabled-checkbox"
              />
              <Input
                v-model:value="item.key"
                placeholder="Key"
                size="small"
                class="key-input"
              />
              <Input
                v-model:value="item.value"
                placeholder="Value"
                size="small"
                class="value-input"
              />
              <Button
                type="text"
                size="small"
                danger
                @click="removeKeyValueRow(headersArray, index)"
                class="remove-btn"
              >
                <IconifyIcon icon="mdi:close" :size="12" />
              </Button>
            </div>
            <div v-if="headersArray.length === 0" class="empty-tip">
              暂无请求头，点击上方按钮添加
            </div>
          </div>
        </div>
      </Tabs.TabPane>

      <Tabs.TabPane tab="Body" key="body">
        <div class="tab-content">
          <div class="body-type-tabs">
            <Button
              v-for="opt in bodyTypeOptions"
              :key="opt.value"
              :type="
                nodeConfigForm.bodyType === opt.value ? 'primary' : 'default'
              "
              size="small"
              @click="nodeConfigForm.bodyType = opt.value"
              class="body-type-btn"
            >
              {{ opt.label }}
            </Button>
          </div>

          <div v-if="nodeConfigForm.bodyType === 'none'" class="empty-tip">
            无请求体
          </div>

          <div
            v-else-if="
              nodeConfigForm.bodyType === 'form-data' ||
              nodeConfigForm.bodyType === 'url-encoded'
            "
          >
            <div class="content-header">
              <span class="header-label">{{
                nodeConfigForm.bodyType === 'form-data'
                  ? 'form-data'
                  : 'x-www-form-urlencoded'
              }}</span>
              <Button
                type="text"
                size="small"
                @click="addKeyValueRow(formDataArray)"
                class="add-btn"
              >
                <IconifyIcon icon="mdi:plus" :size="14" /> 添加字段
              </Button>
            </div>
            <div class="key-value-list">
              <div
                v-for="(item, index) in formDataArray"
                :key="index"
                class="key-value-row"
                :class="{ disabled: !item.enabled }"
              >
                <Checkbox
                  :checked="item.enabled"
                  @change="toggleKeyValueEnabled(formDataArray, index)"
                  class="enabled-checkbox"
                />
                <Input
                  v-model:value="item.key"
                  placeholder="Key"
                  size="small"
                  class="key-input"
                />
                <Input
                  v-model:value="item.value"
                  placeholder="Value"
                  size="small"
                  class="value-input"
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  @click="removeKeyValueRow(formDataArray, index)"
                  class="remove-btn"
                >
                  <IconifyIcon icon="mdi:close" :size="12" />
                </Button>
              </div>
              <div v-if="formDataArray.length === 0" class="empty-tip">
                暂无数据，点击上方按钮添加
              </div>
            </div>
          </div>

          <div v-else-if="nodeConfigForm.bodyType === 'json'">
            <div class="content-header">
              <span class="header-label">JSON</span>
              <Button
                type="text"
                size="small"
                @click="formatJson"
                class="format-btn"
              >
                <IconifyIcon icon="mdi:code-braces" :size="14" /> 格式化
              </Button>
            </div>
            <textarea
              v-model="nodeConfigForm.body"
              rows="8"
              class="raw-textarea"
              placeholder="请输入JSON内容"
            ></textarea>
          </div>
        </div>
      </Tabs.TabPane>
    </Tabs>

    <div class="custom-collapse">
      <div class="custom-collapse-item">
        <div
          class="custom-collapse-header"
          @click="authExpanded = !authExpanded"
        >
          <span class="expand-icon">{{ authExpanded ? '▼' : '▶' }}</span>
          <span class="header-text">认证方式</span>
        </div>
        <div v-show="authExpanded" class="custom-collapse-content">
          <div class="auth-content">
            <div class="form-group">
              <Select
                :value="nodeConfigForm.options.auth?.type"
                :options="authTypeOptions"
                placeholder="选择认证类型"
                style="width: 100%"
                @change="setAuthType"
              />
            </div>
            <div
              v-if="
                nodeConfigForm.options.auth?.type === 'BASIC' ||
                nodeConfigForm.options.auth?.type === 'DIGEST'
              "
              class="auth-fields"
            >
              <div class="form-group">
                <label class="form-label">用户名</label>
                <Input
                  v-model:value="nodeConfigForm.options.auth.username"
                  placeholder="请输入用户名"
                />
              </div>
              <div class="form-group">
                <label class="form-label">密码</label>
                <div class="password-input-wrap">
                  <Input
                    v-model:value="nodeConfigForm.options.auth.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="请输入密码"
                  />
                  <Button
                    type="text"
                    @click="showPassword = !showPassword"
                    class="password-toggle-btn"
                  >
                    <IconifyIcon :icon="showPassword ? 'mdi:eye-off' : 'mdi:eye'" :size="16" />
                  </Button>
                </div>
              </div>
            </div>
            <div
              v-if="nodeConfigForm.options.auth?.type === 'BEARER'"
              class="auth-fields"
            >
              <div class="form-group">
                <label class="form-label">Bearer Token</label>
                <div class="password-input-wrap">
                  <Input
                    v-model:value="nodeConfigForm.options.auth.token"
                    :type="showToken ? 'text' : 'password'"
                    placeholder="请输入令牌"
                  />
                  <Button
                    type="text"
                    @click="showToken = !showToken"
                    class="password-toggle-btn"
                  >
                    <IconifyIcon :icon="showToken ? 'mdi:eye-off' : 'mdi:eye'" :size="16" />
                  </Button>
                </div>
              </div>
            </div>
            <div v-if="!nodeConfigForm.options.auth?.type" class="empty-tip">
              未选择认证类型
            </div>
          </div>
        </div>
      </div>

      <div class="custom-collapse-item">
        <div
          class="custom-collapse-header"
          @click="settingsExpanded = !settingsExpanded"
        >
          <span class="expand-icon">{{ settingsExpanded ? '▼' : '▶' }}</span>
          <span class="header-text">高级设置</span>
        </div>
        <div v-show="settingsExpanded" class="custom-collapse-content">
          <div class="settings-content">
            <div class="form-group">
              <label class="form-label">超时配置</label>
              <div class="timeout-fields">
                <div class="timeout-row">
                  <span class="timeout-label">连接超时</span>
                  <InputNumber
                    v-model:value="connectTimeoutValue"
                    :min="1"
                    :max="300"
                    size="small"
                    class="timeout-input"
                  />
                  <Select
                    v-model:value="connectTimeoutUnit"
                    :options="[
                      { value: '秒', label: '秒' },
                      { value: '分钟', label: '分钟' },
                      { value: '小时', label: '小时' },
                    ]"
                    size="small"
                    class="timeout-unit"
                  />
                </div>
                <div class="timeout-row">
                  <span class="timeout-label">读取超时</span>
                  <InputNumber
                    v-model:value="readTimeoutValue"
                    :min="1"
                    :max="300"
                    size="small"
                    class="timeout-input"
                  />
                  <Select
                    v-model:value="readTimeoutUnit"
                    :options="[
                      { value: '秒', label: '秒' },
                      { value: '分钟', label: '分钟' },
                      { value: '小时', label: '小时' },
                    ]"
                    size="small"
                    class="timeout-unit"
                  />
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">SSL配置</label>
              <div class="ssl-row">
                <div class="ssl-title-wrap">
                  <span class="ssl-title">是否关闭远端SSL证书校验</span>
                  <Tooltip
                    title="仅未配置信任证书库时生效，生产环境请配置证书信任库"
                  >
                    <span class="help-icon">?</span>
                  </Tooltip>
                </div>
                <Switch
                  :checked="
                    nodeConfigForm.options.ssl.insecureTrustAllCertificates
                  "
                  @change="
                    (val: boolean) => {
                      nodeConfigForm.options.ssl.insecureTrustAllCertificates =
                        val;
                    }
                  "
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">开启的日志类型</label>
              <div class="logs-checkboxes">
                <CheckboxGroup v-model:value="nodeConfigForm.options.logs">
                  <Checkbox
                    v-for="opt in logOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </Checkbox>
                </CheckboxGroup>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">默认字符集</label>
              <Select
                v-model:value="nodeConfigForm.options.defaultCharset"
                :options="charsetOptions"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.http-request-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  padding: 0;
}

.config-section {
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.section-header {
  margin-bottom: 8px;
}

.request-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.method-select {
  width: 80px !important;
}

.url-input {
  flex: 1;
}

.required-star {
  color: #ff4d4f;
  font-size: 14px;
  margin-left: 4px;
  flex-shrink: 0;
}

.config-tabs :deep(.ant-tabs-tab) {
  font-size: 14px;
}

.tab-content {
  padding: 8px 0;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.header-label {
  font-size: 13px;
  font-weight: 500;
  color: #495057;
}

.add-btn {
  color: #4080ff;
}

.add-btn:hover {
  color: #1890ff;
}

.format-btn {
  color: #4080ff;
}

.format-btn:hover {
  color: #1890ff;
}

.key-value-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.key-value-row {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  transition: all 0.2s;
}

.key-value-row.disabled {
  opacity: 0.5;
}

.enabled-checkbox {
  flex-shrink: 0;
}

.key-input {
  width: 35% !important;
}

.value-input {
  flex: 1;
}

.remove-btn {
  flex-shrink: 0;
  padding: 4px !important;
}

.empty-tip {
  padding: 12px 0;
  font-size: 12px;
  color: #adb5bd;
  text-align: center;
}

.form-group {
  margin-bottom: 12px;
}

.form-label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #495057;
}

.auth-content {
  margin-top: 4px;
}

.auth-fields {
  margin-top: 8px;
}

.body-type-tabs {
  display: flex;
  gap: 4px;
  padding-bottom: 8px;
  margin-bottom: 10px;
  border-bottom: 1px solid #e5e7eb;
}

.body-type-btn {
  padding: 4px 10px;
  font-size: 12px;
}

.raw-textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 10px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  resize: none;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
}

.raw-textarea:focus {
  outline: none;
  border-color: #4080ff;
}

.settings-content {
  margin-top: 4px;
}

.timeout-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.timeout-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.timeout-label {
  width: 60px;
  font-size: 12px;
  color: #6c757d;
}

.timeout-input {
  flex: 1;
}

.timeout-unit {
  width: 70px !important;
}

.ssl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ssl-title-wrap {
  display: flex;
  gap: 6px;
  align-items: center;
}

.ssl-title {
  font-size: 13px;
  color: #495057;
}

.help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 12px;
  color: #6c757d;
  cursor: help;
  background: #e9ecef;
  border-radius: 50%;
}

.password-input-wrap {
  display: flex;
  align-items: center;
}

.password-toggle-btn {
  margin-left: -28px;
  z-index: 1;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logs-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.custom-collapse {
  width: 100%;
}

.custom-collapse-item {
  margin-bottom: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.custom-collapse-header {
  display: flex;
  align-items: center;
  padding: 12px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  user-select: none;
  background: #f9fafb;
}

.custom-collapse-header:hover {
  background: #f3f4f6;
}

.expand-icon {
  margin-right: 8px;
  font-size: 12px;
  color: #6b7280;
}

.header-text {
  flex: 1;
}

.custom-collapse-content {
  padding: 12px;
  background: #fff;
}
</style>
