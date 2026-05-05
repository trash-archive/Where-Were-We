-- ═══════════════════════════════════════════════════════════════════════════
-- WHERE WERE WE — Admin: get reported photos
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_reported_photos()
RETURNS TABLE (
  photo_id        UUID,
  public_url      TEXT,
  original_name   TEXT,
  storage_path    TEXT,
  is_public       BOOLEAN,
  owner_email     TEXT,
  report_count    BIGINT,
  reasons         TEXT[],
  reporter_emails TEXT[],
  first_reported  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    p.id                                          AS photo_id,
    p.public_url,
    p.original_name,
    p.storage_path,
    p.is_public,
    u.email                                       AS owner_email,
    COUNT(pr.id)                                  AS report_count,
    ARRAY_AGG(DISTINCT pr.reason)                 AS reasons,
    ARRAY_AGG(DISTINCT ru.email)                  AS reporter_emails,
    MIN(pr.created_at)                            AS first_reported
  FROM photo_reports pr
  JOIN photos p          ON p.id  = pr.photo_id
  LEFT JOIN auth.users u ON u.id  = p.user_id
  LEFT JOIN auth.users ru ON ru.id = pr.reporter_id
  GROUP BY p.id, p.public_url, p.original_name, p.storage_path, p.is_public, u.email
  ORDER BY report_count DESC, first_reported ASC;
$$;

-- Grant execute to authenticated users (the admin check is done in the app)
GRANT EXECUTE ON FUNCTION get_reported_photos() TO authenticated;
