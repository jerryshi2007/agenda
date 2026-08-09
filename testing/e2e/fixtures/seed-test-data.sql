-- testing/e2e/fixtures/seed-test-data.sql
-- PostgreSQL seed data for Agenda E2E tests
-- Run: psql -U postgres -d agenda_dev -f seed-test-data.sql
-- OR use the seed-db.js helper script

-- Test users (matches testing/e2e/helpers/jwt-helper.js TEST_USERS)
-- Role: 1=Parent, 2=Child (matches api/Domain/Enums/UserRole.cs)
INSERT INTO "Users" ("Id", "Nickname", "AvatarUrl", "Role", "OpenId", "IsDeleted", "CreatedAt", "UpdatedAt")
VALUES
  ('00000000-0000-0000-0000-000000000001', '家长A', '', 1, 'openid-parent-a', false, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', '家长B', '', 1, 'openid-parent-b', false, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000010', '小明',   '', 2, 'openid-child-1',  false, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000011', '小红',   '', 2, 'openid-child-2',  false, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000012', '小刚',   '', 2, 'openid-child-3',  false, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000099', '外人',   '', 1, 'openid-outsider', false, NOW(), NOW())
ON CONFLICT ("Id") DO NOTHING;

-- Test families
INSERT INTO "Families" ("Id", "Name", "CreatedAt")
VALUES
  ('00000000-0000-0000-0000-100000000001', '测试家庭一', NOW()),
  ('00000000-0000-0000-0000-100000000002', '测试家庭二', NOW())
ON CONFLICT ("Id") DO NOTHING;

-- Family members (fam1)
-- Role: 0=Parent(Owner), 1=Child (matches api/Domain/Enums/FamilyRole.cs)
INSERT INTO "FamilyMembers" ("Id", "FamilyId", "UserId", "Role", "JoinedAt")
VALUES
  -- fam1 members
  (gen_random_uuid(), '00000000-0000-0000-0000-100000000001', '00000000-0000-0000-0000-000000000001', 0, NOW()), -- parentA
  (gen_random_uuid(), '00000000-0000-0000-0000-100000000001', '00000000-0000-0000-0000-000000000002', 0, NOW()), -- parentB
  (gen_random_uuid(), '00000000-0000-0000-0000-100000000001', '00000000-0000-0000-0000-000000000010', 1, NOW()), -- child1
  (gen_random_uuid(), '00000000-0000-0000-0000-100000000001', '00000000-0000-0000-0000-000000000011', 1, NOW()), -- child2
  (gen_random_uuid(), '00000000-0000-0000-0000-100000000001', '00000000-0000-0000-0000-000000000012', 1, NOW()), -- child3
  -- fam2 members (for outsider)
  (gen_random_uuid(), '00000000-0000-0000-0000-100000000002', '00000000-0000-0000-0000-000000000099', 0, NOW())  -- outsider
ON CONFLICT DO NOTHING;
