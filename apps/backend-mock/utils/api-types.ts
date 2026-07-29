export interface PluginMetaDetailDTO {
  type: string;
  nodeName: string;
  nodeDesc?: string;
  nodeCategory: string;
  icon: string;
  description?: string;
  formSchema: string;
}

export interface PluginGroupTreeDTO {
  groupKey: string;
  groupName: string;
  sort: number;
  pluginList: PluginSimpleDTO[];
}

export interface PluginSimpleDTO {
  type: string;
  nodeName: string;
  nodeCategory: string;
  icon: string;
}
