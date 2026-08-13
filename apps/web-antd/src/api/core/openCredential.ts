import { requestClient } from '#/api/request';

/** 生成密钥请求 */
export interface CreateCredentialReq {
  /** 项目ID */
  projectId: number;
  /** 流程ID */
  flowId?: string;
}

/** 生成密钥响应 */
export interface ApiKeyOnlyResp {
  apiKey: string;
}

/** 凭据响应（包含密钥和预览信息） */
export interface CredentialResp {
  id: number;
  /** 明文apiKey */
  apiKey: string;
  /** webhook调用地址 */
  webhookUrl: string;
  /** 请求头复制文本 */
  authHeaderText: string;
  /** body inputs模板示例 */
  bodyExample: string;
  /** curl完整可复制示例 */
  curlExample: string;
}

/**
 * 生成密钥接口：存在更新，不存在新建
 */
export function createOrUpdateCredential(req: CreateCredentialReq) {
  return requestClient.post<ApiKeyOnlyResp>(
    '/flow/plat/open-credential/createOrUpdate',
    req,
  );
}

/**
 * 根据流程ID获取凭据信息
 */
export function getCredentialByFlow(projectId: number, flowId?: string) {
  return requestClient.get<CredentialResp>(
    '/flow/plat/open-credential/getByFlow',
    { params: { projectId, flowId } },
  );
}
