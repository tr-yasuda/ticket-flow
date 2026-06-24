-- 最後の Owner 削除防止トリガーを再作成
-- 組織削除時のカスケードでは、他のメンバーがいない場合のみ Owner 削除を許可する
DROP TRIGGER IF EXISTS ensure_at_least_one_owner_before_delete;

CREATE TRIGGER ensure_at_least_one_owner_before_delete
AFTER DELETE ON organization_members
FOR EACH ROW
WHEN OLD.role = 'owner'
BEGIN
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM organization_members
    WHERE organization_id = OLD.organization_id
  ) > 0
  AND (
    SELECT COUNT(*) FROM organization_members
    WHERE organization_id = OLD.organization_id AND role = 'owner'
  ) = 0
  THEN RAISE(ABORT, '最後の Owner は削除できません')
  END;
END;

-- 組織削除時はメンバー削除順序を制御し、Owner 以外を先に削除する
DROP TRIGGER IF EXISTS ensure_safe_member_deletion_on_organization_delete;

CREATE TRIGGER ensure_safe_member_deletion_on_organization_delete
BEFORE DELETE ON organizations
FOR EACH ROW
BEGIN
  DELETE FROM organization_members
  WHERE organization_id = OLD.id AND role != 'owner';

  DELETE FROM organization_members
  WHERE organization_id = OLD.id AND role = 'owner';
END;
