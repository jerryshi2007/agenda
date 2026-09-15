# 测试报告：日程关联对象泛化（generalize-schedule-to-member）

> 日期：2026-09-12
> 阶段：Stage 4 测试（小程序分支）
> 执行方：主代理（dotnet test + npx jest）

## 结论

✅ **测试全部通过**，可进入 Stage 5 归档。

## 测试矩阵

| 测试端 | 框架 | 通过 | 失败 | 跳过 | 总计 |
|--------|------|-----:|-----:|-----:|-----:|
| 后端 | xUnit（dotnet test） | 295 | 0 | 0 | 295 |
| 前端 | Jest（miniprogram-simulate） | 614 | 0 | 0 | 614 |

## 后端测试（api/Agenda.Test/）

`dotnet test api/Agenda.Test/` → 295 通过 / 0 失败 / 0 跳过

覆盖：Schedule 权限矩阵（家长可给任意成员、孩子仅自己）、Checkin 孩子仅自己打卡、
Settlement streak 排除家长、兼容层（旧 ChildId 字段请求仍成功）等泛化相关单测。

## 前端测试（app/miniapp-test/）

`npx jest` → 614 通过 / 0 失败（52 套件）

覆盖：契约 parity（schedule/checkin/family/template/auth）、页面（child-month 等）、
组件（member-selector、schedule-form 等）、services。

## 测试期间发现并修复的缺陷

| # | 缺陷 | 修复提交 | 性质 |
|---|------|---------|------|
| 1 | schedule 契约镜像缺 5 个打卡/取消错误码，parity 测试失败 | e0fcd5c | 源码缺陷（Task 0.2 镜像未同步全量） |
| 2 | child-month 测试硬编码 2026-08 日期跨月失败 | 5ce1b0d | 测试时间炸弹（同类 2d91503） |

## 后续

- Stage 5 归档：执行 `openspec archive generalize-schedule-to-member`，
  archiver 回写 staging STATUS.md（Stage 5 归档 ✅ done、整体 done）。
