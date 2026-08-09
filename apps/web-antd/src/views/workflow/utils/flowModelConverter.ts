import type { Workflow } from '#/types/workflow';

import { convertWorkflowToFlowModel } from './flowModelSerializer';
import { convertFlowModelToWorkflow } from './flowModelDeserializer';
import { generateFlowLayout, getDefaultOutputPortField } from './flowLayout';

export { convertFlowModelToWorkflow, convertWorkflowToFlowModel, generateFlowLayout, getDefaultOutputPortField };

export function buildFlowSavePayload(
  workflow: Workflow,
  projectId: number,
  workflowName: string,
) {
  const flowModel = convertWorkflowToFlowModel(workflow);
  const flowLayout = generateFlowLayout(workflow.nodes);

  flowModel.disabled = !workflow.enabled;

  return {
    projectId,
    folderId: workflow.folderId || 0,
    description: workflowName,
    flowId: workflow.flowId,
    flowModel,
    flowLayout,
  };
}
