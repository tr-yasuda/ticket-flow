-- CreateTrigger
CREATE TRIGGER IF NOT EXISTS ensure_at_least_one_owner_before_delete
AFTER DELETE ON organization_members
FOR EACH ROW
WHEN OLD.role = 'owner'
BEGIN
  SELECT CASE WHEN (
    SELECT COUNT(*)
    FROM organization_members
    WHERE organization_id = OLD.organization_id
      AND role = 'owner'
  ) = 0
  AND EXISTS (
    SELECT 1
    FROM organizations
    WHERE id = OLD.organization_id
  )
  THEN RAISE(ABORT, '最後の Owner は削除できません')
  END;
END;
