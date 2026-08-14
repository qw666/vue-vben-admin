<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Button, Card, Col, Row, Space, Statistic } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import { useRouter } from 'vue-router';

const router = useRouter();

const stats = ref({
  projectCount: 0,
  flowCount: 0,
  todayRuns: 0,
  totalRuns: 0,
});

onMounted(() => {
  // TODO: Load real data from backend
  stats.value = {
    projectCount: 3,
    flowCount: 12,
    todayRuns: 28,
    totalRuns: 156,
  };
});
</script>

<template>
  <div class="p-4">
    <h2 class="mb-4 text-xl font-semibold">工作台</h2>
    <Row :gutter="16" class="mb-4">
      <Col :span="6">
        <Card>
          <Statistic title="项目总数" :value="stats.projectCount" />
        </Card>
      </Col>
      <Col :span="6">
        <Card>
          <Statistic title="流程总数" :value="stats.flowCount" />
        </Card>
      </Col>
      <Col :span="6">
        <Card>
          <Statistic title="今日运行" :value="stats.todayRuns" />
        </Card>
      </Col>
      <Col :span="6">
        <Card>
          <Statistic title="累计运行" :value="stats.totalRuns" />
        </Card>
      </Col>
    </Row>
    <Card title="快捷操作">
      <div class="flex gap-3">
        <Button type="primary" @click="router.push('/shuzhiliu/workflow/list')">流程列表</Button>
        <Button @click="router.push('/system/user')">用户管理</Button>
        <Button @click="router.push('/system/role')">角色管理</Button>
      </div>
    </Card>
  </div>
</template>
