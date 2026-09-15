# Omni AI 核心模块

这是 Java 11 共享 JAR，由 `java/pom.xml` 聚合。仅依赖 JDK、Jackson 和 SLF4J，不连接数据库，不包含业务 API、工具调用或业务编排。

## 调用约定

业务模块注入 `AiModelClient`，构造不可变 `AiRequest`，调用 `generate(request)` 或 `stream(request, onChunk)`。需要取消时使用带 `AiCancellationToken` 的重载，由断流处理线程调用 `token.cancel()`。方法在调用方线程上执行，业务自行选择执行器；回调应快速返回。

`AiRequest` 包含 `requestId`、`model`、`systemPrompt`、`messages`、`temperature`、`maxTokens`、`contextWindow`。可选采样字段不传时不额外写入默认值，模型和上下文窗口使用既有配置。未传 requestId 时自动生成 UUID。

流式返回增量 `AiStreamChunk`，sequence 从 0 开始；末块的 text 为空，携带 finishReason 和 usage。方法完成时同时返回完整 `AiResponse`。耗时单位为毫秒；用量来自上游，缺失值为 null，不估算。部分输出后发生异常不会重新调用模型或发送成功末块，由业务决定如何呈现失败。

`AiModelException` 提供安全中文信息、错误码、requestId 和可选 HTTP 状态。覆盖参数错误、禁用、取消、超时、不可用、HTTP、JSON、SSE、空结果和回调失败；不携带上游正文、地址或底层异常。日志仅包含请求标识、模型、耗时、成功状态、流式标志和结果码。

## 复用与兼容

`OllamaAiModelClient` 的 payload、响应字段解析和 think 过滤从原 `OllamaSupportLocalModelClient` 迁入。旧类现在只做客服兼容适配，保留 HTTP 非 2xx 流式失败后尝试普通调用、每 8 字符推送及 Optional.empty 规则兜底。FAQ、模型名、system prompt 和采样默认值保持原样。

原 HttpURLConnection 的 disconnect 会等待 chunked read 锁，无法及时取消。唯一传输实现因此改用 JDK HttpClient.sendAsync，取消时关闭原始 body、取消 future，覆盖响应交付竞态。沿用 timeout-ms，最小仍为 1000 毫秒；核心同时将其作为一次请求的总预算，避免持续流式数据无限延长调用。严格拒绝损坏 JSON、尾随 JSON 和无完成标记的截断流，避免将部分回复当成成功。

支持 Ollama NDJSON、SSE data 事件及既有 OpenAI choices 响应字段。`/chat/completions` 路径的新采样参数映射到 temperature/max_tokens；Ollama 使用 options.temperature/num_predict。保留原 options.num_ctx，不宣称兼容所有 OpenAI 供应商。

配置仅在 `java-user` 的 `SupportAiModelConfig` 装配，原 `omni.support.ai.*`、`omni.support.ai.local.*`、环境变量别名和默认值不变；没有新增第二套模型配置。后续业务模块按需依赖此 JAR，本阶段未接入找票或 Copilot。

## Prompt

业务 system prompt 放在各业务模块的资源目录，使用 `PromptTemplate.fromResource(...)` 加载，`render(Map<String,String>)` 渲染 `${variable}`。变量按白名单校验，缺失、额外或格式错误时拒绝；输入值只替换一次，不作为模板再次执行。`getVersion()` 返回 templateId、version、原始 UTF-8 模板 SHA-256。

现有客服资源为 `java-user/src/main/resources/prompts/support-local-v1.txt`，内容摘要和迁移前一致。资源目录固定 LF，避免 Windows 自动换行改变模板版本摘要。

## 本地验证

在项目根目录执行，`-o` 仅使用本地 Maven 依赖：

```powershell
mvn -o -f java/pom.xml compile
mvn -o -f java/pom.xml -pl java-user -am '-Dtest=Ai*Test,Ollama*Test,Prompt*Test,Support*Test,CustomerSupport*Test,HelpCenterServiceTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-DargLine=-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime -Dfile.encoding=UTF-8' test
```

测试使用内存协议 stub 和本地 HttpServer，真实检验 chunked 连接的取消与总超时，不依赖真实 Ollama。上面的临时目录参数针对本机 Windows JDK17 Unix-domain loopback 错误；其他机器替换为本机存在的短路径，或在无需修复时省略。

如单独从服务目录运行 Maven，先从父工程安装共享 JAR：

```powershell
mvn -o -f java/pom.xml -pl java-common,java-ai-core -am install '-DskipTests'
```

`start-project.ps1` 的默认安装步骤已经包含这两个共享模块，`-SkipInstall` 仍由调用者确保依赖已安装。
