-- Reusable 2-seat room foundation + Gomoku state.
-- Applied by tcb db pg migration up. Safe to re-run (IF NOT EXISTS / OR REPLACE).

CREATE TABLE IF NOT EXISTS public.rooms (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind ~ '^[a-z0-9_-]{1,32}$'),
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'finished')),
  host_uid text NOT NULL,
  guest_uid text,
  capacity smallint NOT NULL DEFAULT 2 CHECK (capacity BETWEEN 1 AND 8),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  version integer NOT NULL DEFAULT 1,
  host_seen_at timestamptz,
  guest_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rooms_distinct_players CHECK (guest_uid IS NULL OR guest_uid <> host_uid)
);

CREATE INDEX IF NOT EXISTS rooms_active_idx ON public.rooms (last_active_at);
CREATE INDEX IF NOT EXISTS rooms_host_idx ON public.rooms (host_uid, last_active_at);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rooms FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rooms TO service_role;

-- Serialize a room for the current caller without leaking uids/timestamps.
CREATE OR REPLACE FUNCTION public.room_json(r public.rooms, p_uid text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', r.id,
    'kind', r.kind,
    'status', r.status,
    'version', r.version,
    'state', r.state,
    'seat', CASE
      WHEN r.host_uid = p_uid THEN 'host'
      WHEN r.guest_uid = p_uid THEN 'guest'
      ELSE NULL
    END,
    'guestJoined', r.guest_uid IS NOT NULL,
    'hostOnline', coalesce(r.host_seen_at > now() - interval '60 seconds', false),
    'guestOnline', coalesce(r.guest_seen_at > now() - interval '60 seconds', false),
    'createdAt', r.created_at,
    'lastActiveAt', r.last_active_at,
    'serverNow', now()
  );
$$;

CREATE OR REPLACE FUNCTION public.room_create(
  p_room_id text,
  p_kind text,
  p_host_uid text,
  p_state jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.rooms%ROWTYPE;
  recent_count integer;
BEGIN
  IF p_room_id !~ '^[A-Za-z0-9_-]{8,64}$' THEN
    RETURN jsonb_build_object('error', 'INVALID_ROOM_ID');
  END IF;
  IF p_kind <> 'gomoku' THEN
    RETURN jsonb_build_object('error', 'UNSUPPORTED_KIND');
  END IF;
  IF p_state IS NULL THEN
    p_state := '{}'::jsonb;
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.rooms
  WHERE host_uid = p_host_uid
    AND last_active_at > now() - interval '1 hour';

  IF recent_count >= 5 THEN
    RETURN jsonb_build_object('error', 'RATE_LIMITED');
  END IF;

  INSERT INTO public.rooms (id, kind, status, host_uid, capacity, state, host_seen_at)
  VALUES (p_room_id, p_kind, 'waiting', p_host_uid, 2, p_state, now())
  RETURNING * INTO r;

  RETURN jsonb_build_object('room', public.room_json(r, p_host_uid));
END;
$$;

CREATE OR REPLACE FUNCTION public.room_join(p_room_id text, p_uid text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.rooms%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ROOM_NOT_FOUND');
  END IF;

  IF r.host_uid = p_uid OR r.guest_uid = p_uid THEN
    UPDATE public.rooms
    SET last_active_at = now(),
        host_seen_at = CASE WHEN host_uid = p_uid THEN now() ELSE host_seen_at END,
        guest_seen_at = CASE WHEN guest_uid = p_uid THEN now() ELSE guest_seen_at END
    WHERE id = p_room_id
    RETURNING * INTO r;
    RETURN jsonb_build_object('room', public.room_json(r, p_uid));
  END IF;

  IF r.guest_uid IS NOT NULL OR r.status <> 'waiting' THEN
    RETURN jsonb_build_object('error', 'ROOM_FULL');
  END IF;

  UPDATE public.rooms
  SET guest_uid = p_uid,
      status = 'active',
      guest_seen_at = now(),
      version = version + 1,
      updated_at = now(),
      last_active_at = now()
  WHERE id = p_room_id
  RETURNING * INTO r;

  RETURN jsonb_build_object('room', public.room_json(r, p_uid));
END;
$$;

CREATE OR REPLACE FUNCTION public.room_get(p_room_id text, p_uid text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.rooms%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ROOM_NOT_FOUND');
  END IF;

  IF r.host_uid <> p_uid AND (r.guest_uid IS NULL OR r.guest_uid <> p_uid) THEN
    RETURN jsonb_build_object('error', 'NOT_IN_ROOM');
  END IF;

  IF r.host_uid = p_uid
     AND (r.host_seen_at IS NULL OR r.host_seen_at < now() - interval '10 seconds') THEN
    UPDATE public.rooms
    SET host_seen_at = now(), last_active_at = now()
    WHERE id = p_room_id
    RETURNING * INTO r;
  ELSIF r.guest_uid = p_uid
     AND (r.guest_seen_at IS NULL OR r.guest_seen_at < now() - interval '10 seconds') THEN
    UPDATE public.rooms
    SET guest_seen_at = now(), last_active_at = now()
    WHERE id = p_room_id
    RETURNING * INTO r;
  END IF;

  RETURN jsonb_build_object('room', public.room_json(r, p_uid));
END;
$$;

CREATE OR REPLACE FUNCTION public.room_commit_state(
  p_room_id text,
  p_uid text,
  p_expected_version integer,
  p_expected_status text,
  p_state jsonb,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.rooms%ROWTYPE;
BEGIN
  IF p_state IS NULL THEN
    RETURN jsonb_build_object('error', 'INVALID_STATE');
  END IF;
  IF p_status NOT IN ('waiting', 'active', 'finished') THEN
    RETURN jsonb_build_object('error', 'INVALID_STATUS');
  END IF;

  UPDATE public.rooms
  SET state = p_state,
      status = p_status,
      version = version + 1,
      updated_at = now(),
      last_active_at = now(),
      host_seen_at = CASE WHEN host_uid = p_uid THEN now() ELSE host_seen_at END,
      guest_seen_at = CASE WHEN guest_uid = p_uid THEN now() ELSE guest_seen_at END
  WHERE id = p_room_id
    AND version = p_expected_version
    AND status = p_expected_status
    AND (host_uid = p_uid OR guest_uid = p_uid)
  RETURNING * INTO r;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'CONFLICT');
  END IF;

  RETURN jsonb_build_object('room', public.room_json(r, p_uid));
END;
$$;

CREATE OR REPLACE FUNCTION public.room_cleanup(p_before timestamptz)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  removed integer;
BEGIN
  IF p_before IS NULL THEN
    p_before := now() - interval '7 days';
  END IF;

  WITH deleted AS (
    DELETE FROM public.rooms WHERE last_active_at < p_before RETURNING 1
  )
  SELECT count(*) INTO removed FROM deleted;

  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.room_json(public.rooms, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.room_create(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.room_join(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.room_get(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.room_commit_state(text, text, integer, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.room_cleanup(timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.room_create(text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.room_join(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.room_get(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.room_commit_state(text, text, integer, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.room_cleanup(timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';
