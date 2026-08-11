import type { ComputedRef, Ref } from 'vue';
import { message } from 'ant-design-vue';
import { useRouter } from 'vue-router';
import { useWorkflowStore } from '#/store/workflow';
import { flowControlNodeRegistry } from '../nodes/types';
import { buildFlowSavePayload } from '../utils/flowModelConverter';
import { validateAll, formatValidationErrors } from '../utils/validateWorkflow';

export function useWorkflowActions(
  workflowName: Ref<string>,
  isLoading: Ref<boolean>,
  isRunning: Ref<boolean>,
  projectId: ComputedRef<number | null>,
) {
  const store = useWorkflowStore();
  const router = useRouter();

  async function handleSave() {
    isLoading.value = true;
    try {
      if (!store.currentWorkflow) {
        message.error('请先创建流程');
        return;
      }

      if (!workflowName.value || !workflowName.value.trim()) {
        message.error('请填写流程名称');
        return;
      }

      const validation = validateAll(store.currentWorkflow);

      if (!validation.valid) {
        message.error(formatValidationErrors(validation.errors));
        return;
      }

      const endNode = store.currentWorkflow.nodes.find(
        (n) => n.data.type === 'idp_core_flow_End',
      );
      store.currentWorkflow.outputs = endNode?.data.config?.outputs || [];

      const startNode = store.currentWorkflow.nodes.find(
        (n) => n.data.type === 'idp_core_flow_Start',
      );
      const startStrategy = startNode
        ? flowControlNodeRegistry.get(startNode.data.type)
        : null;
      if (startStrategy?.saveConfig && startNode?.data?.config) {
        startStrategy.saveConfig(startNode.data.config, store);
      } else {
        store.currentWorkflow.inputs = startNode?.data.config?.inputs || [];
        store.currentWorkflow.triggers = startNode?.data.config?.triggers || [];
      }

      store.currentWorkflow.name = workflowName.value;
      store.currentWorkflow.updatedAt = new Date().toISOString();

      const payload = buildFlowSavePayload(
        store.currentWorkflow,
        projectId.value ?? store.projectId,
        workflowName.value,
      );

      const backendValidationResult = await store.validateFlow(payload);

      if (backendValidationResult?.constraints) {
        message.error(`流程校验失败：${backendValidationResult.constraints}`);
        return;
      }

      const saved = await store.saveWorkflowToBackend(payload);

      if (saved) {
        message.success('流程已保存');
      } else {
        message.error('保存失败');
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
      message.error('保存失败');
    } finally {
      isLoading.value = false;
    }
  }

  async function handleRun() {
    if (isRunning.value) return;
    if (!store.currentWorkflow) {
      message.warning('请先创建流程');
      return;
    }
    if (!store.currentWorkflow.flowId) {
      message.warning('工作流ID不存在，请先保存流程');
      return;
    }
    isRunning.value = true;
    try {
      const success = await store.runWorkflow(store.currentWorkflow.id);
      if (success) {
        message.success('流程运行成功');
      } else {
        message.error('流程运行失败');
      }
    } catch (error) {
      console.error('Failed to run workflow:', error);
      message.error('流程运行失败');
    } finally {
      isRunning.value = false;
    }
  }

  function handleClear() {
    if (store.currentWorkflow) {
      store.currentWorkflow.nodes = [];
      store.currentWorkflow.edges = [];
    }
    message.info('画布已清空');
  }

  function handleBack() {
    store.setCurrentWorkflow(null);
    router.push('/shuzhiliu/workflow/list');
  }

  return {
    handleSave,
    handleRun,
    handleClear,
    handleBack,
  };
}
