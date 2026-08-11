<script lang="ts" setup>
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Card } from 'ant-design-vue';

import { useRouter } from 'vue-router';

import { $t } from '#/locales';

const router = useRouter();

const features = computed(() => [
  {
    icon: 'mdi:palette',
    title: $t('page.home.features.visual.title'),
    desc: $t('page.home.features.visual.desc'),
    gradient: 'from-blue-500 to-cyan-400',
    bgLight: 'bg-blue-50',
  },
  {
    icon: 'mdi:robot',
    title: $t('page.home.features.ai.title'),
    desc: $t('page.home.features.ai.desc'),
    gradient: 'from-purple-500 to-pink-400',
    bgLight: 'bg-purple-50',
  },
  {
    icon: 'mdi:engine',
    title: $t('page.home.features.multi.title'),
    desc: $t('page.home.features.multi.desc'),
    gradient: 'from-orange-500 to-amber-400',
    bgLight: 'bg-orange-50',
  },
  {
    icon: 'mdi:shield-check',
    title: $t('page.home.features.reliable.title'),
    desc: $t('page.home.features.reliable.desc'),
    gradient: 'from-emerald-500 to-green-400',
    bgLight: 'bg-emerald-50',
  },
]);

const createFlow = () => {
  router.push('/shuzhiliu/workflow/list');
};
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-cyan-50">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl"></div>
      <div class="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-purple-200/40 blur-3xl"></div>
      <div class="absolute top-1/3 left-1/4 h-64 w-64 rounded-full bg-cyan-200/30 blur-3xl"></div>
    </div>

    <!-- 内容区域 -->
    <div class="relative z-10 mx-auto max-w-6xl px-6 py-12">
      <!-- Hero Section -->
      <div class="mb-16 text-center">
        <h1 class="mb-6 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
          {{ $t('page.home.subtitle') }}
        </h1>
        
        <p class="mx-auto mb-8 max-w-2xl text-lg text-slate-600">
          {{ $t('page.home.description') }}
        </p>

        <div class="flex items-center justify-center gap-4">
          <Button
            type="primary"
            size="large"
            class="!h-12 !px-8 !text-base !font-medium !bg-gradient-to-r !from-blue-500 !to-indigo-600 hover:!shadow-lg hover:!shadow-blue-500/30 transition-all"
            @click="createFlow"
          >
            <IconifyIcon icon="mdi:plus" class="mr-2" :size="20" />
            {{ $t('page.home.quickStart.create') }}
          </Button>
        </div>
      </div>

      <!-- Features Grid -->
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card
          v-for="(feature, index) in features"
          :key="index"
          class="!border-slate-200 !bg-white !shadow-sm hover:!shadow-lg hover:!border-blue-300 transition-all duration-300 hover:-translate-y-1"
          :body-style="{ padding: '24px' }"
        >
          <div class="flex flex-col items-center text-center">
            <div
              :class="[
                'mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg',
                feature.gradient,
              ]"
            >
              <IconifyIcon :icon="feature.icon" :size="32" />
            </div>
            <h3 class="mb-2 text-lg font-semibold text-slate-800">
              {{ feature.title }}
            </h3>
            <p class="text-sm text-slate-500">{{ feature.desc }}</p>
          </div>
        </Card>
      </div>

      <!-- Platform Preview -->
      <div class="mt-16">
        <div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
            <!-- Left: Feature List -->
            <div>
              <h2 class="mb-6 text-2xl font-bold text-slate-800">
                为什么选择万象？
              </h2>
              <ul class="space-y-4">
                <li class="flex items-start gap-3">
                  <div class="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <IconifyIcon icon="mdi:check" class="text-blue-600" :size="14" />
                  </div>
                  <span class="text-slate-600">
                    <span class="font-medium text-slate-800">零代码构建</span>
                    无需编码，通过拖拽即可完成复杂流程设计
                  </span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-100">
                    <IconifyIcon icon="mdi:check" class="text-purple-600" :size="14" />
                  </div>
                  <span class="text-slate-600">
                    <span class="font-medium text-slate-800">实时调试</span>
                    在线测试流程，快速发现并修复问题
                  </span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
                    <IconifyIcon icon="mdi:check" class="text-orange-600" :size="14" />
                  </div>
                  <span class="text-slate-600">
                    <span class="font-medium text-slate-800">版本管理</span>
                    自动保存历史版本，随时回溯
                  </span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <IconifyIcon icon="mdi:check" class="text-emerald-600" :size="14" />
                  </div>
                  <span class="text-slate-600">
                    <span class="font-medium text-slate-800">生产就绪</span>
                    支持高并发执行，保证稳定性
                  </span>
                </li>
              </ul>
            </div>

            <!-- Right: Platform Preview -->
            <div class="relative">
              <div class="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-lg">
                <div class="mb-4 flex items-center gap-2">
                  <div class="h-3 w-3 rounded-full bg-red-400"></div>
                  <div class="h-3 w-3 rounded-full bg-yellow-400"></div>
                  <div class="h-3 w-3 rounded-full bg-green-400"></div>
                  <span class="ml-2 text-sm text-slate-500">Workflow Canvas</span>
                </div>
                
                <div class="grid grid-cols-4 gap-3">
                  <div class="col-span-1 space-y-2">
                    <div class="rounded-lg bg-blue-100 p-2 text-center text-xs text-blue-700">开始</div>
                    <div class="rounded-lg bg-purple-100 p-2 text-center text-xs text-purple-700">AI</div>
                    <div class="rounded-lg bg-cyan-100 p-2 text-center text-xs text-cyan-700">条件</div>
                  </div>
                  <div class="col-span-2 flex flex-col items-center justify-center space-y-4">
                    <div class="h-px w-full bg-gradient-to-r from-transparent via-blue-300 to-transparent"></div>
                    <div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                      <IconifyIcon icon="mdi:workflow" class="mx-auto mb-2 text-blue-500" :size="24" />
                      <div class="text-xs text-slate-500">画布预览</div>
                    </div>
                    <div class="h-px w-full bg-gradient-to-r from-transparent via-purple-300 to-transparent"></div>
                  </div>
                  <div class="col-span-1 space-y-2">
                    <div class="rounded-lg bg-emerald-100 p-2 text-center text-xs text-emerald-700">代码</div>
                    <div class="rounded-lg bg-orange-100 p-2 text-center text-xs text-orange-700">输出</div>
                    <div class="rounded-lg bg-red-100 p-2 text-center text-xs text-red-700">结束</div>
                  </div>
                </div>
              </div>
              
              <!-- Floating badges -->
              <div class="absolute -right-4 -top-4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2 text-xs font-medium text-white shadow-lg">
                AI Ready
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
