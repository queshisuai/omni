# Phase ⑥ 最终系统验收计划

## 目标

以当前仓库真实代码、测试输出和本地运行态为依据，完成 Omni 最终系统级回归与论文实现证据整理；保留已有未提交改动，不做无关重构，不提交 Git。

## 阶段

- [complete] 1. 梳理架构、实现记录、变更范围和运行态（文档、静态边界、端口、PID/版本已核对）
- [complete] 2. 执行核心测试、边界检查、生产拆库检查和前端质量检查（Java `397/397`、Frontend `62/62`、typecheck、build、边界/拆库检查通过；lint 保留 5 个既有 error）
- [complete] 3. 审计 Finder/Copilot 业务边界、RBAC、Skill Group 和敏感日志
- [complete] 4. 复核真实业务链路与 AI 延迟数据；区分未测量、环境问题和历史问题
- [complete] 5. 将可追溯结果写入 `implementation-notes.md`
- [complete] 6. 完成最终验证、检查工作区和输出 Phase ⑥ 结论

## 成功标准

- 核心业务、Finder、Copilot、RBAC、Skill Group、stale、fact validation 和 AI unavailable 均有仓库证据或明确标记未重新测量。
- 微服务边界、生产拆库、typecheck、build、测试和 `git diff --check` 有本轮命令输出支撑。
- 不把设计能力写成已实现，不编造性能指标，不隐藏失败。
- `implementation-notes.md` 包含系统模块表、AI 对比表、两个流程、Copilot 状态机、测试矩阵、风险清单和本轮真实结果。

## 记录策略

- 临时计划、发现和进度文件放在 `docs/superpowers/`，不放源码根目录。
- 任何错误记录到 findings/progress，并在下一次尝试前改变诊断或执行方式。
- 真实业务写操作只在已有验收口径明确且可逆时执行；支付、退款、库存等有外部副作用的动作不主动触发。
- 本轮已补齐 `grab-service` 的 runtime/import host 映射和 same-owner 约束资产；runtime verifier 现可覆盖六个 manifest service。
- 已修正 manifest 中 ticket 默认目标库为 `omni_ticket_split`，并验证 import 默认口径、runtime verifier 和生产拆库静态检查一致。
