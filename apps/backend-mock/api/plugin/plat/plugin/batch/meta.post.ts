import { PluginMetaDetailDTO } from '#/api';

const pluginMetaMap: Record<string, PluginMetaDetailDTO> = {
  idp_core_flow_ForEach: {
    type: 'idp_core_flow_ForEach',
    nodeName: '循环遍历',
    nodeDesc: '遍历数组执行循环',
    nodeCategory: 'task',
    icon: 'icon1',
    description: '该组件会解析 values 字段（支持JSON数组、YAML列表或表达式），并遍历每一项，每一项执行一次子任务组。当前遍历的元素可通过 taskrun.value 访问；嵌套循环场景下使用 parent.taskrun.value；taskrun.iteration 可以获取当前循环索引。\n可通过 concurrencyLimit 参数控制并发数：0 代表无并发限制，1 代表完全串行执行，N 代表最多同时运行 N 个任务组。如果希望每组内部的多个任务并行运行，可将这些任务包裹在 Parallel 任务组件中。\n当存在大量批量分发任务的场景时，建议为每个遍历项单独触发子流程，以此实现更好的横向扩容性能。',
    formSchema: JSON.stringify({
      properties: {
        $schema: 'https://json-schema.org/draft/2019-09/schema',
        properties: {
          concurrencyLimit: {
            type: 'integer',
            title: '数组每组数据对应的并发任务数量',
            description: '并发限制值为0代表无限制，全部任务组并行执行；\n并发限制值为1代表完全串行，同一时间仅能按顺序执行一组任务；\n并发限制大于1时，同一时间最多运行指定数量的任务组。',
            default: 1,
            minimum: 0,
            $dynamic: false,
            $required: false,
          },
          errors: {
            title: '当前循环任务出现失败时执行的任务列表',
            $dynamic: false,
            type: 'array',
            items: {
              $ref: '#/$defs/idp_core_models_tasks_Task',
              $dynamic: false,
            },
            $required: false,
          },
          finally: {
            type: 'array',
            items: {
              $ref: '#/$defs/idp_core_models_tasks_Task',
            },
            $required: false,
          },
          tasks: {
            minItems: 1,
            $dynamic: false,
            type: 'array',
            items: {
              $ref: '#/$defs/idp_core_models_tasks_Task',
              $dynamic: false,
            },
            $required: true,
          },
          values: {
            title: 'Kestra执行任务组的数据源列表',
            description: '数据源可传入字符串、字符串数组、对象数组',
            $dynamic: true,
            anyOf: [
              { type: 'string' },
              { type: 'array', items: {} },
            ],
            $required: true,
          },
        },
        required: ['tasks', 'values'],
        title: '遍历列表每个值执行子任务',
        description: '解析values字段（JSON数组、YAML列表、表达式），列表中每一项数据都会执行一组子任务。当前遍历项可通过 `taskrun_value` 获取；嵌套循环可使用 `parent_taskrun_value` 获取父循环遍历值；`taskrun_iteration` 代表当前遍历下标。\n\n通过concurrencyLimit控制并行度：0=无限制全部并行，1=完全串行，数字N=最多同时运行N组任务。若想单组内多任务并行，可嵌套Parallel并行任务。\n大批量数据分发场景，建议为每条数据触发子流程以提升性能。',
      },
      definitions: {},
      $defs: {
        idp_core_models_tasks_Task: {
          type: 'object',
          title: '通用任务节点',
          properties: {
            type: {
              type: 'string',
              title: '任务类型',
              $required: true,
            },
            name: {
              type: 'string',
              title: '任务名称',
              $required: false,
            },
            description: {
              type: 'string',
              title: '任务描述',
              $required: false,
            },
          },
        },
      },
    }),
  },
  idp_core_flow_If: {
    type: 'idp_core_flow_If',
    nodeName: '条件判断',
    nodeDesc: '根据条件判断执行不同的流程分支',
    nodeCategory: 'flow',
    icon: 'mdi:compare',
    description: '条件判断节点用于根据指定条件决定执行哪个分支。支持动态表达式作为判断条件。',
    formSchema: JSON.stringify({
      properties: {
        properties: {
          condition: {
            type: 'string',
            title: '判断条件',
            description: '输入判断条件表达式，支持动态表达式',
            $dynamic: true,
            $required: true,
          },
          then: {
            type: 'array',
            title: '满足条件时执行',
            description: '满足条件时执行的节点列表',
            items: {
              $ref: '#/$defs/idp_core_models_tasks_Task',
            },
            $required: true,
            minItems: 1,
          },
          else: {
            type: 'array',
            title: '不满足条件时执行',
            description: '不满足条件时执行的节点列表（可选）',
            items: {
              $ref: '#/$defs/idp_core_models_tasks_Task',
            },
            $required: false,
          },
        },
        required: ['condition', 'then'],
      },
      $defs: {
        idp_core_models_tasks_Task: {
          type: 'object',
          title: '通用任务节点',
          properties: {
            type: { type: 'string', title: '任务类型', $required: true },
            name: { type: 'string', title: '任务名称', $required: false },
          },
        },
      },
    }),
  },
  idp_core_flow_Parallel: {
    type: 'idp_core_flow_Parallel',
    nodeName: '并行执行',
    nodeDesc: '并行执行多个分支',
    nodeCategory: 'flow',
    icon: 'mdi:git-branch',
    description: '并行执行节点用于同时执行多个分支流程。',
    formSchema: JSON.stringify({
      properties: {
        properties: {
          branches: {
            type: 'array',
            title: '并行分支',
            description: '需要并行执行的分支列表',
            items: {
              type: 'object',
              properties: {
                branchName: { type: 'string', title: '分支名称', $required: true },
                nodes: {
                  type: 'array',
                  title: '节点列表',
                  items: { $ref: '#/$defs/idp_core_models_tasks_Task' },
                },
              },
            },
            $required: true,
            minItems: 2,
          },
          waitAll: {
            type: 'boolean',
            title: '等待全部完成',
            description: '是否等待所有分支完成后再继续',
            default: true,
            $required: false,
          },
        },
        required: ['branches'],
      },
      $defs: {
        idp_core_models_tasks_Task: {
          type: 'object',
          title: '通用任务节点',
          properties: {
            type: { type: 'string', title: '任务类型', $required: true },
            name: { type: 'string', title: '任务名称', $required: false },
          },
        },
      },
    }),
  },
  idp_core_flow_Pause: {
    type: 'idp_core_flow_Pause',
    nodeName: '暂停节点',
    nodeDesc: '暂停流程执行',
    nodeCategory: 'flow',
    icon: 'mdi:pause',
    description: '暂停节点用于暂停流程执行，等待人工干预或定时恢复。',
    formSchema: JSON.stringify({
      properties: {
        properties: {
          pauseType: {
            type: 'string',
            title: '暂停类型',
            description: '暂停方式：manual-人工恢复，timer-定时恢复',
            $required: true,
            enum: ['manual', 'timer'],
          },
          duration: {
            type: 'integer',
            title: '暂停时长',
            description: '定时恢复时的暂停时长（秒）',
            default: 300,
            minimum: 1,
            $required: false,
          },
        },
        required: ['pauseType'],
      },
      $defs: {},
    }),
  },
  idp_core_flow_Subflow: {
    type: 'idp_core_flow_Subflow',
    nodeName: '子流程',
    nodeDesc: '调用子流程',
    nodeCategory: 'flow',
    icon: 'mdi:folder-open',
    description: '子流程节点用于调用另一个工作流。',
    formSchema: JSON.stringify({
      properties: {
        properties: {
          workflowId: {
            type: 'string',
            title: '子流程ID',
            description: '要调用的子流程ID',
            $required: true,
          },
          inputParams: {
            type: 'array',
            title: '输入参数',
            description: '传递给子流程的参数列表',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', title: '参数名', $required: true },
                value: { type: 'string', title: '参数值', $dynamic: true },
              },
            },
            $required: false,
          },
        },
        required: ['workflowId'],
      },
      $defs: {},
    }),
  },
  idp_core_flow_Switch: {
    type: 'idp_core_flow_Switch',
    nodeName: '分支判断',
    nodeDesc: '根据值进行多分支判断',
    nodeCategory: 'flow',
    icon: 'mdi:shuffle',
    description: '分支判断节点用于根据表达式结果选择不同的执行路径。',
    formSchema: JSON.stringify({
      properties: {
        properties: {
          expression: {
            type: 'string',
            title: '判断表达式',
            description: '用于判断的表达式，支持动态表达式',
            $dynamic: true,
            $required: true,
          },
          cases: {
            type: 'array',
            title: '分支列表',
            description: '各分支的判断条件和执行节点',
            items: {
              type: 'object',
              properties: {
                value: { type: 'string', title: '匹配值', $required: true },
                nodes: {
                  type: 'array',
                  title: '执行节点',
                  items: { $ref: '#/$defs/idp_core_models_tasks_Task' },
                  $required: true,
                },
              },
            },
            $required: true,
            minItems: 1,
          },
        },
        required: ['expression', 'cases'],
      },
      $defs: {
        idp_core_models_tasks_Task: {
          type: 'object',
          title: '通用任务节点',
          properties: {
            type: { type: 'string', title: '任务类型', $required: true },
            name: { type: 'string', title: '任务名称', $required: false },
          },
        },
      },
    }),
  },
  idp_core_http_Download: {
    type: 'idp_core_http_Download',
    nodeName: '文件下载',
    nodeDesc: '从指定URL下载文件',
    nodeCategory: 'http',
    icon: 'mdi:download',
    description: '文件下载节点用于从指定URL下载文件到本地。',
    formSchema: JSON.stringify({
      properties: {
        properties: {
          url: {
            type: 'string',
            title: '下载地址',
            description: '文件下载URL，支持动态表达式',
            $dynamic: true,
            $required: true,
          },
          savePath: {
            type: 'string',
            title: '保存路径',
            description: '文件保存路径，支持动态表达式',
            $dynamic: true,
            $required: true,
          },
        },
        required: ['url', 'savePath'],
      },
      $defs: {},
    }),
  },
  idp_core_http_Request: {
    type: 'idp_core_http_Request',
    nodeName: 'HTTP请求',
    nodeDesc: '发送HTTP请求',
    nodeCategory: 'http',
    icon: 'mdi:web',
    description: 'HTTP请求节点用于发送HTTP请求到指定服务。',
    formSchema: JSON.stringify({
      properties: {
        properties: {
          method: {
            type: 'string',
            title: '请求方法',
            description: 'HTTP请求方法',
            $required: true,
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            default: 'GET',
          },
          url: {
            type: 'string',
            title: '请求地址',
            description: '目标URL，支持动态表达式',
            $dynamic: true,
            $required: true,
          },
        },
        required: ['method', 'url'],
      },
      $defs: {},
    }),
  },
  idp_core_output_OutputValues: {
    type: 'idp_core_output_OutputValues',
    nodeName: '输出变量',
    nodeDesc: '输出流程变量',
    nodeCategory: 'output',
    icon: 'mdi:export',
    description: '输出变量节点用于将流程中的变量输出到外部系统。',
    formSchema: JSON.stringify({
      properties: {
        properties: {
          outputs: {
            type: 'array',
            title: '输出变量',
            description: '要输出的变量列表',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', title: '变量名', $required: true },
                value: { type: 'string', title: '变量值', $dynamic: true, $required: true },
              },
            },
            $required: true,
            minItems: 1,
          },
        },
        required: ['outputs'],
      },
      $defs: {},
    }),
  },
};

export default () => {
  return {
    code: 200,
    msg: 'success',
    data: pluginMetaMap,
  };
};
