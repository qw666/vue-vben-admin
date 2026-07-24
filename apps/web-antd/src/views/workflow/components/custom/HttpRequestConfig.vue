<script lang="ts" setup>
import { computed, ref, watch, nextTick } from 'vue';
import { Button, Input, Select, Switch, Tooltip, Collapse, CheckboxGroup, Checkbox, InputNumber } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

const props = defineProps<{
  nodeConfigForm: Record<string, any>;
}>();

const activeCollapseKeys = ref(['auth', 'advanced']);
const isInternalUpdate = ref(false);

const methodOptions = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
];

const contentTypeOptions = [
  { value: 'application/json', label: 'application/json' },
  { value: 'application/x-www-form-urlencoded', label: 'application/x-www-form-urlencoded' },
  { value: 'multipart/form-data', label: 'multipart/form-data' },
  { value: 'text/plain', label: 'text/plain' },
];

const authTypeOptions = [
  { value: null, label: '无' },
  { value: 'BASIC', label: 'BasicAuth' },
  { value: 'BEARER', label: 'BearerAuth' },
  { value: 'DIGEST', label: 'DigestAuth' },
];

const logOptions = [
  { value: 'REQUEST_HEADERS', label: '请求头' },
  { value: 'REQUEST_BODY', label: '请求体' },
  { value: 'RESPONSE_HEADERS', label: '响应头' },
  { value: 'RESPONSE_BODY', label: '响应体' },
];

const charsetOptions = [
  { value: 'UTF-8', label: 'UTF-8' },
  { value: 'GBK', label: 'GBK' },
  { value: 'GB2312', label: 'GB2312' },
  { value: 'ISO-8859-1', label: 'ISO-8859-1' },
  { value: 'US-ASCII', label: 'US-ASCII' },
];

const headersArray = ref<Array<{ key: string; value: string }>>([]);
const paramsArray = ref<Array<{ key: string; value: string }>>([]);
const formDataArray = ref<Array<{ key: string; value: string }>>([]);

const connectTimeoutValue = ref(30);
const connectTimeoutUnit = ref('秒');
const readIdleTimeoutValue = ref(30);
const readIdleTimeoutUnit = ref('秒');

const showRequestBody = computed(() => {
  const method = String(props.nodeConfigForm.method || 'GET').toUpperCase();
  const noBodyMethods = ['GET', 'HEAD', 'OPTIONS'];
  return !noBodyMethods.includes(method);
});

const showContentType = computed(() => true);

const showFormData = computed(() => {
  const contentType = String(props.nodeConfigForm.contentType || '');
  return showRequestBody.value && (
    contentType === 'multipart/form-data' ||
    contentType === 'application/x-www-form-urlencoded'
  );
});

const showJsonBody = computed(() => {
  const contentType = String(props.nodeConfigForm.contentType || '');
  return showRequestBody.value && contentType === 'application/json';
});

const showTextBody = computed(() => {
  const contentType = String(props.nodeConfigForm.contentType || '');
  return showRequestBody.value && contentType === 'text/plain';
});

function addKeyValueRow(arr: Array<{ key: string; value: string }>) {
  arr.push({ key: '', value: '' });
}

function removeKeyValueRow(arr: Array<{ key: string; value: string }>, index: number) {
  arr.splice(index, 1);
}

function setAuthType(type: string | null) {
  if (!type) {
    props.nodeConfigForm.options.auth = null;
  } else if (type === 'BASIC') {
    props.nodeConfigForm.options.auth = { type: 'BASIC', username: '', password: '' };
  } else if (type === 'BEARER') {
    props.nodeConfigForm.options.auth = { type: 'BEARER', token: '' };
  } else if (type === 'DIGEST') {
    props.nodeConfigForm.options.auth = { type: 'DIGEST', username: '', password: '' };
  }
}

function objectToArray(obj: Record<string, any> | undefined): Array<{ key: string; value: string }> {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }));
}

function parseDuration(duration: string): { value: number; unit: string } {
  const match = duration.match(/PT(\d+)([HM]?)/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2] === 'H' ? '小时' : match[2] === 'M' ? '分钟' : '秒';
    return { value, unit };
  }
  return { value: 30, unit: '秒' };
}

function formatDuration(value: number, unit: string): string {
  const unitMap: Record<string, string> = { '秒': 'S', '分钟': 'M', '小时': 'H' };
  return `PT${value}${unitMap[unit] || 'S'}`;
}

function syncArraysToForm() {
  isInternalUpdate.value = true;
  props.nodeConfigForm.headers = headersArray.value.reduce((acc, item) => {
    if (item.key) acc[item.key] = item.value;
    return acc;
  }, {} as Record<string, string>);
  props.nodeConfigForm.params = paramsArray.value.reduce((acc, item) => {
    if (item.key) acc[item.key] = item.value;
    return acc;
  }, {} as Record<string, string>);
  props.nodeConfigForm.formData = formDataArray.value.reduce((acc, item) => {
    if (item.key) acc[item.key] = item.value;
    return acc;
  }, {} as Record<string, string>);
  nextTick(() => { isInternalUpdate.value = false; });
}

function syncTimeoutToForm() {
  isInternalUpdate.value = true;
  if (!props.nodeConfigForm.options) props.nodeConfigForm.options = {};
  if (!props.nodeConfigForm.options.timeout) props.nodeConfigForm.options.timeout = {};
  props.nodeConfigForm.options.timeout.connectTimeout = formatDuration(connectTimeoutValue.value, connectTimeoutUnit.value);
  props.nodeConfigForm.options.timeout.readIdleTimeout = formatDuration(readIdleTimeoutValue.value, readIdleTimeoutUnit.value);
  nextTick(() => { isInternalUpdate.value = false; });
}

watch(headersArray, syncArraysToForm, { deep: true });
watch(paramsArray, syncArraysToForm, { deep: true });
watch(formDataArray, syncArraysToForm, { deep: true });
watch([connectTimeoutValue, connectTimeoutUnit], syncTimeoutToForm);
watch([readIdleTimeoutValue, readIdleTimeoutUnit], syncTimeoutToForm);

watch(() => props.nodeConfigForm, (form) => {
  if (isInternalUpdate.value) return;
  if (!form) return;

  isInternalUpdate.value = true;

  if (form.uri === undefined) form.uri = '';
  if (form.method === undefined) form.method = 'POST';
  if (form.contentType === undefined) form.contentType = 'application/json';
  if (form.body === undefined) form.body = '';

  headersArray.value = objectToArray(form.headers);
  paramsArray.value = objectToArray(form.params);
  formDataArray.value = objectToArray(form.formData);

  if (!form.options) {
    form.options = {
      timeout: { connectTimeout: 'PT30S', readIdleTimeout: 'PT30S' },
      ssl: { insecureTrustAllCertificates: true },
      logs: [],
      defaultCharset: 'UTF-8',
    };
  } else {
    if (!form.options.timeout) form.options.timeout = { connectTimeout: 'PT30S', readIdleTimeout: 'PT30S' };
    if (!form.options.ssl) form.options.ssl = { insecureTrustAllCertificates: true };
    if (!form.options.logs) form.options.logs = [];
    if (!form.options.defaultCharset) form.options.defaultCharset = 'UTF-8';
  }

  const connectParsed = parseDuration(form.options.timeout.connectTimeout);
  connectTimeoutValue.value = connectParsed.value;
  connectTimeoutUnit.value = connectParsed.unit;

  const readParsed = parseDuration(form.options.timeout.readIdleTimeout);
  readIdleTimeoutValue.value = readParsed.value;
  readIdleTimeoutUnit.value = readParsed.unit;

  nextTick(() => { isInternalUpdate.value = false; });
}, { immediate: true, deep: true });
</script>

<template>
  <div class="space-y-4">
    <div class="p-3 bg-gray-50 rounded-lg">
      <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 12px;">基础配置</div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div>
          <label style="font-size: 14px; font-weight: 500; color: #374151; display: block; margin-bottom: 4px;">
            目标地址 <span style="color: #ef4444; margin-left: 4px;">*</span>
          </label>
          <Input v-model="nodeConfigForm.uri" placeholder="请输入完整HTTP目标访问地址" style="width: 100%;" />
        </div>
        <div style="display: flex; gap: 12px;">
          <div style="flex: 1;">
            <label style="font-size: 14px; font-weight: 500; color: #374151; display: block; margin-bottom: 4px;">
              请求方式
            </label>
            <Select v-model="nodeConfigForm.method" :options="methodOptions" style="width: 100%;" />
          </div>
          <div v-if="showContentType" style="flex: 1;">
            <label style="font-size: 14px; font-weight: 500; color: #374151; display: block; margin-bottom: 4px;">
              Content-Type
            </label>
            <Select v-model="nodeConfigForm.contentType" :options="contentTypeOptions" style="width: 100%;" />
          </div>
        </div>

        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <label style="font-size: 14px; font-weight: 500; color: #374151;">请求头</label>
            <Button type="text" size="small" @click="addKeyValueRow(headersArray)">
              <IconifyIcon icon="mdi:plus" :size="14" /> 添加
            </Button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div v-for="(item, index) in headersArray" :key="index" style="display: flex; gap: 8px;">
              <Input v-model="item.key" placeholder="键" size="small" style="width: 40%;" />
              <Input v-model="item.value" placeholder="值" size="small" style="flex: 1;" />
              <Button type="text" size="small" danger @click="removeKeyValueRow(headersArray, index)">
                <IconifyIcon icon="mdi:close" :size="12" />
              </Button>
            </div>
            <div v-if="headersArray.length === 0" style="text-center text-gray-400 text-sm py-2">
              暂无请求头，点击添加
            </div>
          </div>
        </div>

        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <label style="font-size: 14px; font-weight: 500; color: #374151;">URL查询参数</label>
            <Button type="text" size="small" @click="addKeyValueRow(paramsArray)">
              <IconifyIcon icon="mdi:plus" :size="14" /> 添加
            </Button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div v-for="(item, index) in paramsArray" :key="index" style="display: flex; gap: 8px;">
              <Input v-model="item.key" placeholder="键" size="small" style="width: 40%;" />
              <Input v-model="item.value" placeholder="值" size="small" style="flex: 1;" />
              <Button type="text" size="small" danger @click="removeKeyValueRow(paramsArray, index)">
                <IconifyIcon icon="mdi:close" :size="12" />
              </Button>
            </div>
            <div v-if="paramsArray.length === 0" style="text-center text-gray-400 text-sm py-2">
              暂无查询参数，点击添加
            </div>
          </div>
        </div>

        <div>
          <label style="font-size: 14px; font-weight: 500; color: #374151; display: block; margin-bottom: 4px;">请求体</label>
          <div v-if="showJsonBody">
            <textarea
              v-model="nodeConfigForm.body"
              rows="4"
              style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; resize: none;"
              placeholder="请输入JSON格式的请求体"
            ></textarea>
          </div>
          <div v-else-if="showTextBody">
            <textarea
              v-model="nodeConfigForm.body"
              rows="4"
              style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; resize: none;"
              placeholder="请输入文本格式的请求体"
            ></textarea>
          </div>
          <div v-else-if="showFormData">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 12px; color: #6b7280;">表单数据</span>
              <Button type="text" size="small" @click="addKeyValueRow(formDataArray)">
                <IconifyIcon icon="mdi:plus" :size="14" /> 添加
              </Button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div v-for="(item, index) in formDataArray" :key="index" style="display: flex; gap: 8px;">
                <Input v-model="item.key" placeholder="键" size="small" style="width: 40%;" />
                <Input v-model="item.value" placeholder="值" size="small" style="flex: 1;" />
                <Button type="text" size="small" danger @click="removeKeyValueRow(formDataArray, index)">
                  <IconifyIcon icon="mdi:close" :size="12" />
                </Button>
              </div>
              <div v-if="formDataArray.length === 0" style="text-center text-gray-400 text-sm py-2">
                暂无表单数据，点击添加
              </div>
            </div>
          </div>
          <div v-else>
            <textarea
              v-model="nodeConfigForm.body"
              rows="4"
              style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; resize: none;"
              placeholder="请输入请求体内容"
            ></textarea>
          </div>
        </div>
      </div>
    </div>

    <Collapse v-model:activeKey="activeCollapseKeys">
      <Collapse.Panel header="认证配置" key="auth">
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
          <div>
            <label style="font-size: 14px; font-weight: 500; color: #374151; display: block; margin-bottom: 4px;">认证类型</label>
            <Select
              :value="nodeConfigForm.options.auth?.type"
              :options="authTypeOptions"
              placeholder="选择认证类型"
              style="width: 100%;"
              @change="setAuthType"
            />
          </div>
          <div v-if="nodeConfigForm.options.auth?.type === 'BASIC' || nodeConfigForm.options.auth?.type === 'DIGEST'" style="display: flex; flex-direction: column; gap: 8px;">
            <Input v-model="nodeConfigForm.options.auth.username" placeholder="用户名" style="width: 100%;" />
            <Input v-model="nodeConfigForm.options.auth.password" type="password" placeholder="密码" style="width: 100%;" />
          </div>
          <div v-if="nodeConfigForm.options.auth?.type === 'BEARER'">
            <Input v-model="nodeConfigForm.options.auth.token" type="password" placeholder="Bearer令牌" style="width: 100%;" />
          </div>
        </div>
      </Collapse.Panel>

      <Collapse.Panel header="高级配置" key="advanced">
        <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 8px;">
          <div>
            <label style="font-size: 14px; font-weight: 500; color: #374151; display: block; margin-bottom: 8px;">超时配置</label>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; gap: 6px;">
                <label style="font-size: 12px; color: #6b7280; width: 60px; line-height: 28px;">连接超时</label>
                <InputNumber v-model="connectTimeoutValue" :min="1" :max="300" size="small" style="flex: 1;" />
                <Select v-model="connectTimeoutUnit" :options="[{ value: '秒', label: '秒' }, { value: '分钟', label: '分钟' }, { value: '小时', label: '小时' }]" size="small" style="width: 70px;" />
              </div>
              <div style="display: flex; gap: 6px;">
                <label style="font-size: 12px; color: #6b7280; width: 60px; line-height: 28px;">读取超时</label>
                <InputNumber v-model="readIdleTimeoutValue" :min="1" :max="300" size="small" style="flex: 1;" />
                <Select v-model="readIdleTimeoutUnit" :options="[{ value: '秒', label: '秒' }, { value: '分钟', label: '分钟' }, { value: '小时', label: '小时' }]" size="small" style="width: 70px;" />
              </div>
            </div>
          </div>

          <div>
            <label style="font-size: 14px; font-weight: 500; color: #374151; display: block; margin-bottom: 8px;">SSL配置</label>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-size: 14px; color: #374151;">是否关闭远端SSL证书校验</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">仅未配置信任证书库时生效，生产环境请配置证书信任库</div>
              </div>
              <Switch :checked="nodeConfigForm.options.ssl.insecureTrustAllCertificates" @change="(val: boolean) => { nodeConfigForm.options.ssl.insecureTrustAllCertificates = val; }" />
            </div>
          </div>

          <div>
            <label style="font-size: 14px; font-weight: 500; color: #374151; display: block; margin-bottom: 8px;">开启的日志类型</label>
            <CheckboxGroup v-model="nodeConfigForm.options.logs">
              <Checkbox v-for="opt in logOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </Checkbox>
            </CheckboxGroup>
          </div>

          <div>
            <label style="font-size: 14px; font-weight: 500; color: #374151; display: block; margin-bottom: 4px;">默认字符集</label>
            <Select v-model="nodeConfigForm.options.defaultCharset" :options="charsetOptions" style="width: 100%;" />
          </div>
        </div>
      </Collapse.Panel>
    </Collapse>
  </div>
</template>
