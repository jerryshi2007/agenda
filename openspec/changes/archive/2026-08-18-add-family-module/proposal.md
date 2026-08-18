## Why

家庭管理模块是三个已完成模块（日程管理/认证/打卡）的数据边界补全。产品设计中日程与打卡统计均以家庭为隔离维度，但家庭实体、成员角色、邀请机制尚未落地。staging 目录 `production/staging/2026-08-18-家庭/` 已于 2026-08-18 通过 req-reviewer 审核与人审批，状态为 dev-ready，需求详见 [requirement.md](../../production/staging/2026-08-18-家庭/requirement.md)（结构化补充基于 [module-family.md](../../production/requirements/module-family.md)）。

## What Changes

- **家庭创建与首次引导**：无家庭用户进入统一引导页（创建/加入二选一）；创建家庭输入名称（2-20 字符，支持中英文和 emoji）+ 创建者自选角色（家长/孩子，默认家长）；创建者选孩子角色时可自升级为家长
- **双轨邀请机制**：微信分享卡片邀请家长（具体分享参数在技术设计阶段确定）；6 位纯数字邀请码邀请孩子（仅用 2-9 八个数字、24 小时有效、一次性、生成时预设角色、可撤销）；家庭人数上限 10 人，满额拒绝加入
- **成员与角色管理**：成员列表按家长/孩子分组；移除成员（含并发边界）；转让创建者（仅限家长角色接收）；孩子姓名在家庭内覆盖微信昵称；已注销成员 30 天缓冲期处理（到期移出、创建者身份自动转让规则）
- **孩子展示模式**：学龄前/小学/高年级三模式字段存储与设置流程（第一期不区分 UI，统一小学模式）
- **多家庭切换**：切换面板（按最近活跃排序）；每个家庭独立记忆上次视图/日期/筛选状态；单家庭用户隐藏切换入口
- **退出/解散/恢复**：退出限制（创建者不可退出、最后一个家长且家庭有孩子时阻止）；解散需输入家庭名称二次确认；解散后数据保留 30 天，任意原成员可恢复，到期物理删除（第一期不做订阅消息通知）

## Capabilities

### New Capabilities

- `family-lifecycle`: 家庭生命周期管理--创建/退出/解散/恢复/多家庭切换与状态记忆
- `family-member`: 成员与角色管理--邀请加入/移除/转让创建者/孩子姓名规则/已注销成员处理
- `family-invite`: 双轨邀请--微信分享卡片与 6 位邀请码的生成/校验/撤销/过期处理

### Modified Capabilities

- 现有 `event-crud` / `event-instance` / `event-checkin-integration` 的家庭隔离边界对接（具体 MODIFIED 范围以架构设计阶段现状对账为准）

## Impact

- **api/**：新增 Family 模块分层（Controller/Service/DTOs/Validators）；新增 Family/FamilyMember/InviteCode 等实体与 EF Core 迁移；现有 Schedule/Checkin 查询接入家庭上下文过滤（以现状对账为准）
- **app/**：新增页面族（引导页/创建家庭/加入家庭/邀请成员/邀请码/成员列表/展示模式/切换家庭/恢复家庭）；新增 `services/family.js` API 封装；"我的"页面接入切换家庭入口
- **openspec/contracts/family/**：新增枚举（角色/邀请状态/展示模式）、错误码、DTO 契约文件
- **openspec/specs/**：新建 `family-lifecycle`、`family-member`、`family-invite` capability specs
