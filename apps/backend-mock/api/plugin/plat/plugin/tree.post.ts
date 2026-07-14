import { PluginGroupTreeDTO, PluginSimpleDTO } from '#/api';

const pluginGroups: PluginGroupTreeDTO[] = [
  {
    groupKey: 'flow',
    groupName: '流程控制',
    sort: 1,
    pluginList: [
      { type: 'idp_core_flow_If', nodeName: '条件判断', nodeCategory: 'flow', icon: 'mdi:compare' },
      { type: 'idp_core_flow_Parallel', nodeName: '并行执行', nodeCategory: 'flow', icon: 'mdi:git-branch' },
      { type: 'idp_core_flow_Pause', nodeName: '暂停节点', nodeCategory: 'flow', icon: 'mdi:pause' },
      { type: 'idp_core_flow_Subflow', nodeName: '子流程', nodeCategory: 'flow', icon: 'mdi:folder-open' },
      { type: 'idp_core_flow_Switch', nodeName: '分支判断', nodeCategory: 'flow', icon: 'mdi:shuffle' },
      { type: 'idp_core_flow_ForEach', nodeName: '循环遍历', nodeCategory: 'flow', icon: 'mdi:repeat' },
    ],
  },
  {
    groupKey: 'http',
    groupName: 'HTTP操作',
    sort: 2,
    pluginList: [
      { type: 'idp_core_http_Download', nodeName: '文件下载', nodeCategory: 'http', icon: 'mdi:download' },
      { type: 'idp_core_http_Request', nodeName: 'HTTP请求', nodeCategory: 'http', icon: 'mdi:web' },
    ],
  },
  {
    groupKey: 'output',
    groupName: '输出操作',
    sort: 3,
    pluginList: [
      { type: 'idp_core_output_OutputValues', nodeName: '输出变量', nodeCategory: 'output', icon: 'mdi:export' },
    ],
  },
];

export default () => {
  return {
    code: 200,
    msg: 'success',
    data: pluginGroups,
  };
};
