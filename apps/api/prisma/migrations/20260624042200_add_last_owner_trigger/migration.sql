-- CreateTrigger
CREATE TRIGGER IF NOT EXISTS ensure_at_least_one_owner_before_update
BEFORE UPDATE ON organization_members
FOR EACH ROW
WHEN OLD.role = 'owner' AND NEW.role != 'owner'
BEGIN
  SELECT CASE WHEN (
    SELECT COUNT(*)
    FROM organization_members
    WHERE organization_id = NEW.organization_id
      AND role = 'owner'
      AND id != OLD.id
  ) = 0
  THEN RAISE(ABORT, '最後の Owner のロールは変更できません')
  END;
END;
