---
title: 如何实现一个 Coding Agent？
tags: [study]
published: 2026-02-02
draft: true
---

## 缘起
Coding Agent 无疑是目前 AI 应用里价值最大的一类，也是我几乎每天都在用的 AI 工具，一直很好奇它们是如何工作的？

直到看到 OpenAI 发布的一篇文章介绍 Codex 的 Agent loop，发现 Codex 居然是开源的，于是产生了学习下的想法。
用 Codex 来学习 Codex ，也算赛博原汤化原食了。


## 定义场景
Codex 的功能很多，我就以一个最简单的开发需求为例：
把 /AppHeader.tsx  链接之间的间距加大一点。
来拆解它是如何工作的。

这里只看当前场景下的核心逻辑，同时描述的是我抽象的核心过程，不会完全展开实现细节，就比如前端输入到后端执行中间可能会经过多个队列处理，略过不提。

基本保证准确，能力有限错误难免:sweat_smile:

## 核心逻辑

1 处理用户输入
阶段目标：把用户输入处理成可被 Agent 消费的内容

核心代码：codex-rs/tui/src/chatwidget.rs

主要逻辑：
Codex 获取到用户输入后，会先解析成结构化的 UserInput，包括
文本
图像
Skills：就是靠文本匹配来判断是否需要调用
再把 UserInput 结合很多环境配置信息打包成 UserTurn，这里的环境配置信息主要包括：
工作目录 cwd
选择的 model
命令审批和沙盒策略
等
3. 最后把 UserTurn 提交给 Codex 核心线程。


2 构建 TurnContext
阶段目标：基于 UserTurn 构建更完整的 Context 并启动任务

核心代码： codex-rs/core/src/codex.rs

主要逻辑：
结合 UserTurn 构建 TurnContext，注入一些更多的信息，包括
developer_instructions：从配置文件 config.toml 中获取
compact_prompt：如果有压缩的话会用到
user_instructions：项目文档 AGENTS.md + Skills 拼接
toolsConfig
等
启动 RegularTask 开始运行


3 运行 Turn
阶段目标：通过 Agent Loop，完成具体工作比如修改代码

核心代码： codex-rs/core/src/codex.rs

主要逻辑：
构造最终发出的 initial prompt
最开头的文章就是相关细节
简单说就是 3 个关键参数，对应`/v1/responses` 的入参
instructions：系统提示词，针对不同模型做了定义，比如 gpt-5.2-codex-prompt
tools：获取可用工具
input：基于之前的  TurnContext 和 UserTurn 得到
tools 具体包括了Codex 定义的工具和 MCP 工具等，比如
shell
计划工具
获取文件工具
编辑代码工具
等
发出推理请求
也就是调用 /v1/responses API，进入 Agent Loop
这里有个细节，不同的鉴权方式调用的 API 不一样，还没研究出于什么原因
是否继续循环的核心逻辑是看模型的响应是否包含 tool call
如果包含就执行调用工具并继续请求
若没有则结束本轮 turn 请求并返回 assistant 消息
调用工具方法
解析：把模型响应转化成 ToolCall
调度：控制工具的并发与取消
执行：根据不同的工具找到对应的执行逻辑
回写：把工具执行完的结果回写，触发下一轮推理请求
这其中可能会进行安全评估和审批后，再具体执行
开始下一轮请求
除了第一轮请求的内容，新一轮请求会增加
上一轮模型返回的推理内容
上一轮模型返回的工具调用
调用工具得到的结果


4 前端展示结果
阶段目标：把 Agent Loop 的过程展示给用户

核心代码：codex-rs/tui/src/chatwidget.rs

主要逻辑：就是把推理接口响应的内容解析，流式输出给用户，直到循环结束展示 assistant 消息为止。

## 拆解真实请求
我打印了实际的日志，看下真实的过程感受更深一些。

第一次请求
Agent 基于我的输入「把 /AppHeader.tsx  链接之间的间距加大一点。」构建了 initial prompt 并请求 API。

第一次响应
核心就是模型要求调用工具，执行 ls 命令

response.output_item.added
item.type="function_call"
arguments="{\"command\":\"ls\",\"workdir\":\"/Users/...\"}"

第二次请求
Agent 完成了 ls的执行，带上执行结果再次请求 API

第二次响应
模型要求调用 sed 查看指定文件的前 200 行内容

response.output_item.added
item.type = "function_call"
name = "shell_command"
arguments = "{"command":"sed -n '1,200p' apps/web-backend/src/components/layout/AppHeader.tsx", "workdir":"/Users/..."}"

第三次请求
Agent 完成了 sed 命令，带上执行结果再次请求 API

第三次响应
模型要求调求用 apply_patch修改指定代码
 apply_patch 不是 OpenAI 标准 function_call，所以是 custom_tool_call

response.output_item.added
item.type = "custom_tool_call"
name = "apply_patch"
input = "*** Begin Patch
*** Update File: apps/web-backend/src/components/layout/AppHeader.tsx
@@
-        <nav className=\"flex items-center justify-center gap-4 text-sm font-medium leading-none text-muted-foreground sm:h-10 sm:justify-self-center\">\n
+        <nav className=\"flex items-center justify-center gap-3 text-sm font-medium leading-none text-muted-foreground sm:h-10 sm:justify-self-center\">\n
*** End Patch"


第四次请求
Agent 完成了工具调用修改了代码，带上执行结果再次请求 API

Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M apps/web-backend/src/components/layout/AppHeader.tsx


第四次响应
这次终于没有 tool_call了，返回了 assistant 消息，最终展示给用户

"output":[
  {
    "id":"msg_...",
    "type":"message",
    "status":"completed",
    "role":"assistant",
    "content":[
      {"type":"output_text","text":"已把导航链接间距从 ..."}
    ]
  }
]

## 我的感受

说实话，在知道 Codex 是如何实现之后，非常震惊
直到我打这几行字，还是会起鸡皮疙瘩

我甚至不敢相信这就是全部
还去找了找有没有验证生成代码的逻辑
结果没有找到
想了想不需要也不可能有
（当然也可能是我错了）

从产品层面来说，真的是大道至简
我试图去理解 Codex 的产品在做什么
构建上下文
定义工具
确保一些交互体验
剩下的交给模型
模型很重要
但是作为一个传统古典产品出生的人感受到了一丝「绝望」

可能 Coding Agent 是一个比较极端的场景
恰好是模型最擅长的领域
但是我感受到了 AI 原生产品的设计思路和非 AI 产品的巨大不同
现在还不能非常完整准确的描述出来
一个感受是
传统产品依然是在定义和创造，然后交付给用户
但是 AI 产品只是在帮助连接用户和模型
从一个创造者变成了传声筒？

另外一个感受是
没有垂直 Agent ，只有通用 Agent （佩服 Manus）
Codex 其实只是给了 Agent 一个运行环境
然后提供各种 tools 和需要的上下文
从某种本质来看
和编程没有什么关系
最近火爆的 clawdbot 算是某种证明？

同时我对于 skills 有了新的理解
它其实是 Agent 的拓展
拓展了 instructions 和 tools
夸张的说法，凡是通过计算设备交付的工作，Agent 理论上都可以完成

虽然类比很不准确
还是禁不住想
如果 LLM 是大脑
那它需要的就是一个身体（运行环境）和一台电脑（工具）