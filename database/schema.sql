-- ============================================================
-- CAC Tagger — Full Database Schema
-- Run this in your Supabase SQL Editor (fresh project)
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────
CREATE TYPE team_direction AS ENUM ('L2R', 'R2L');
CREATE TYPE match_status    AS ENUM ('Doing', 'QC', 'Done');
CREATE TYPE duel_result     AS ENUM ('Won', 'Lost', 'NA');
CREATE TYPE user_role       AS ENUM ('super_admin', 'analyst');

-- ============================================================
-- 1. PROFILES  (mirrors auth.users)
-- ============================================================
CREATE TABLE public.profiles (
    id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username   text NOT NULL,
    email      text NOT NULL,
    role       user_role NOT NULL DEFAULT 'analyst',
    created_at timestamptz DEFAULT now()
);

-- Auto-create profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'analyst')
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. TOURNAMENTS
-- ============================================================
CREATE TABLE public.tournaments (
    tournament_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL UNIQUE,
    created_by    uuid REFERENCES public.profiles(id),
    created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- 3. TEAMS
-- ============================================================
CREATE TABLE public.teams (
    team_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name  text NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now(),
    UNIQUE (team_name)
);

-- ============================================================
-- 4. PLAYERS
-- ============================================================
CREATE TABLE public.players (
    player_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name    text NOT NULL,
    team_id        uuid REFERENCES public.teams(team_id) ON DELETE SET NULL,
    jersey_number  integer,
    position       text,  -- GK, DF, MF, FW
    created_by     uuid REFERENCES public.profiles(id),
    created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_players_team ON public.players (team_id);

-- ============================================================
-- 5. MATCHES
-- ============================================================
CREATE TABLE public.matches (
    match_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_name   text NOT NULL,
    match_name        text NOT NULL,
    match_date        date NOT NULL,
    home_team_id      uuid REFERENCES public.teams(team_id),
    away_team_id      uuid REFERENCES public.teams(team_id),
    home_score        integer,
    away_score        integer,
    video_source_type text NOT NULL DEFAULT 'YouTube', -- 'YouTube' | 'Local'
    video_url         text,
    is_futsal         boolean NOT NULL DEFAULT false,
    status            match_status NOT NULL DEFAULT 'Doing',
    locked_by         uuid REFERENCES public.profiles(id),
    locked_at         timestamptz,
    created_by        uuid REFERENCES public.profiles(id),
    created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_matches_created_by ON public.matches (created_by);
CREATE INDEX idx_matches_status     ON public.matches (status);

-- ============================================================
-- 6. MATCH ASSIGNMENTS  (multi-analyst)
-- ============================================================
CREATE TABLE public.match_assignments (
    match_id    uuid NOT NULL REFERENCES public.matches(match_id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
    assigned_at timestamptz DEFAULT now(),
    PRIMARY KEY (match_id, user_id)
);

-- ============================================================
-- 7. LINEUPS
-- ============================================================
CREATE TABLE public.lineups (
    lineup_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id     uuid NOT NULL REFERENCES public.matches(match_id)  ON DELETE CASCADE,
    team_id      uuid NOT NULL REFERENCES public.teams(team_id)     ON DELETE CASCADE,
    player_id    uuid NOT NULL REFERENCES public.players(player_id) ON DELETE CASCADE,
    jersey_no    integer,
    position     text,
    starting_xi  boolean DEFAULT true,
    UNIQUE (match_id, player_id)
);

CREATE INDEX idx_lineups_match ON public.lineups (match_id);

-- ============================================================
-- 8. MATCH EVENTS  (raw tagged events)
-- ============================================================
CREATE TABLE public.match_events (
    match_event_id   bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    match_id         uuid        NOT NULL REFERENCES public.matches(match_id)  ON DELETE CASCADE,
    analyst_id       uuid        NOT NULL REFERENCES public.profiles(id)       ON DELETE CASCADE,
    match_time_seconds integer   NOT NULL,

    -- Pitch coordinates (0-100 percentage of 120x80 pitch)
    start_x          numeric(6,2) NOT NULL,
    start_y          numeric(6,2) NOT NULL,
    end_x            numeric(6,2),
    end_y            numeric(6,2),
    end_z            numeric(6,2),  -- shot height (for xGOT)

    -- Event classification
    action           text NOT NULL,
    outcome          text NOT NULL,
    type             text,
    body_part        text,          -- Right Foot, Left Foot, Head, Other

    -- Players
    player_id         uuid NOT NULL REFERENCES public.players(player_id) ON DELETE CASCADE,
    reaction_player_id uuid          REFERENCES public.players(player_id) ON DELETE SET NULL,

    -- Team context
    team_id           uuid REFERENCES public.teams(team_id) ON DELETE SET NULL,
    team_direction    team_direction NOT NULL DEFAULT 'L2R',

    -- Duel outcomes
    ground_duel      duel_result NOT NULL DEFAULT 'NA',
    aerial_duel      duel_result NOT NULL DEFAULT 'NA',

    -- Shot metadata
    shot_technique   text,
    first_time_shot  smallint,   -- 1 = yes
    assist_type      text,

    -- Extra
    pressure_on      boolean NOT NULL DEFAULT false,
    notes            text,
    created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_me_match        ON public.match_events (match_id);
CREATE INDEX idx_me_player       ON public.match_events (player_id);
CREATE INDEX idx_me_time         ON public.match_events (match_id, match_time_seconds);
CREATE INDEX idx_me_analyst      ON public.match_events (analyst_id);

-- ============================================================
-- 9. ACTION FLOW RULES  (smart auto-fill after logging)
-- ============================================================
CREATE TABLE public.action_flow_rules (
    id                  bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    current_action      text NOT NULL,
    current_outcome     text,
    current_type        text,
    next_action         text NOT NULL,
    next_outcome        text,
    next_type           text,
    next_action_player  text,    -- 'prevAction' | 'prevReaction' | 'prevReaction_or_prevAction'
    next_reaction_player text,
    updated_at          timestamptz DEFAULT now(),
    updated_by          uuid REFERENCES public.profiles(id)
);

CREATE UNIQUE INDEX idx_afr_unique ON public.action_flow_rules (current_action, current_outcome, current_type)
    NULLS NOT DISTINCT;

-- ============================================================
-- SEED: action_flow_rules
-- ============================================================
INSERT INTO public.action_flow_rules
    (current_action, current_outcome, current_type, next_action, next_outcome, next_type, next_action_player, next_reaction_player)
VALUES
    ('Pass',            'Intercepted',  NULL,                   'Pass Intercept', NULL,          NULL,             NULL,                          'prevAction'),
    ('Through Ball',    'Intercepted',  NULL,                   'Pass Intercept', NULL,          NULL,             NULL,                          'prevAction'),
    ('Shoot',           'Save',         NULL,                   'Save',           NULL,          NULL,             'prevReaction',                'prevAction'),
    ('Shoot',           'Save',         'Corner',               'Pass',           'Successful',  'Corner Kick',    NULL,                          NULL),
    ('Shoot',           'Block',        NULL,                   'Block',          NULL,          NULL,             'prevReaction',                'prevAction'),
    ('Shoot',           'Block',        'Corner',               'Pass',           'Successful',  'Corner Kick',    NULL,                          NULL),
    ('Shoot',           'Goal',         NULL,                   'Pass',           'Successful',  NULL,             NULL,                          NULL),
    ('Shoot',           'Woodwork',     'Corner',               'Pass',           'Successful',  'Corner Kick',    NULL,                          NULL),
    ('Shoot',           'Off-Target',   'Corner',               'Pass',           'Successful',  'Corner Kick',    NULL,                          NULL),
    ('Standing Tackle', 'Successful',   'With Possession',      'Pass',           'Successful',  NULL,             'prevAction',                  NULL),
    ('Sliding Tackle',  'Successful',   'With Possession',      'Pass',           'Successful',  NULL,             'prevAction',                  NULL),
    ('Standing Tackle', 'Successful',   'Without Possession',   'Pass',           'Successful',  NULL,             NULL,                          NULL),
    ('Sliding Tackle',  'Successful',   'Without Possession',   'Pass',           'Successful',  NULL,             NULL,                          NULL),
    ('Standing Tackle', 'Unsuccessful', NULL,                   'Pass',           'Successful',  NULL,             NULL,                          NULL),
    ('Sliding Tackle',  'Unsuccessful', NULL,                   'Pass',           'Successful',  NULL,             NULL,                          NULL),
    ('Standing Tackle', 'Foul',         NULL,                   'Discipline',     'Foul',        NULL,             'prevAction',                  NULL),
    ('Sliding Tackle',  'Foul',         NULL,                   'Discipline',     'Foul',        NULL,             'prevAction',                  NULL),
    ('Dribble',         'Foul Won',     NULL,                   'Discipline',     'Foul',        NULL,             'prevReaction',                NULL),
    ('Save',            'Gripping',     NULL,                   'Pass',           'Successful',  'Goalkeeper Throw','prevAction',                 NULL),
    ('Save',            'Pushing-in',   NULL,                   'Pass',           'Successful',  NULL,             NULL,                          NULL),
    ('Save',            'Pushing-out',  NULL,                   'Pass',           'Successful',  'Corner Kick',    NULL,                          NULL),
    ('Pressure',        'Foul',         NULL,                   'Discipline',     'Foul',        NULL,             'prevAction',                  NULL);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_flow_rules  ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_match(p_match_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.match_assignments
        WHERE match_id = p_match_id AND user_id = auth.uid()
    );
$$;

-- profiles
CREATE POLICY "profiles_select"   ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update"   ON public.profiles FOR UPDATE USING (id = auth.uid());

-- tournaments
CREATE POLICY "tournaments_all"   ON public.tournaments FOR ALL USING (auth.uid() IS NOT NULL);

-- teams
CREATE POLICY "teams_all"         ON public.teams FOR ALL USING (auth.uid() IS NOT NULL);

-- players
CREATE POLICY "players_all"       ON public.players FOR ALL USING (auth.uid() IS NOT NULL);

-- matches
CREATE POLICY "matches_select"    ON public.matches FOR SELECT
    USING (created_by = auth.uid() OR is_assigned_to_match(match_id) OR is_super_admin());
CREATE POLICY "matches_insert"    ON public.matches FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "matches_update"    ON public.matches FOR UPDATE
    USING (created_by = auth.uid() OR is_super_admin());
CREATE POLICY "matches_delete"    ON public.matches FOR DELETE
    USING (created_by = auth.uid() OR is_super_admin());

-- match_assignments
CREATE POLICY "assignments_select" ON public.match_assignments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "assignments_insert" ON public.match_assignments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "assignments_delete" ON public.match_assignments FOR DELETE
    USING (user_id = auth.uid() OR is_super_admin());

-- lineups
CREATE POLICY "lineups_all"       ON public.lineups FOR ALL USING (auth.uid() IS NOT NULL);

-- match_events
CREATE POLICY "events_select"     ON public.match_events FOR SELECT
    USING (
        analyst_id = auth.uid()
        OR is_assigned_to_match(match_id)
        OR is_super_admin()
    );
CREATE POLICY "events_insert"     ON public.match_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "events_update"     ON public.match_events FOR UPDATE
    USING (analyst_id = auth.uid() OR is_super_admin());
CREATE POLICY "events_delete"     ON public.match_events FOR DELETE
    USING (analyst_id = auth.uid() OR is_super_admin());

-- action_flow_rules
CREATE POLICY "afr_select"        ON public.action_flow_rules FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "afr_write"         ON public.action_flow_rules FOR ALL USING (is_super_admin());

-- ============================================================
-- MATCH LOCKING FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.acquire_match_lock(p_match_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_locked_by uuid;
    v_locked_at timestamptz;
BEGIN
    SELECT locked_by, locked_at INTO v_locked_by, v_locked_at
    FROM public.matches WHERE match_id = p_match_id;

    -- Release stale lock (older than 10 minutes)
    IF v_locked_by IS NOT NULL AND v_locked_at < now() - interval '10 minutes' THEN
        v_locked_by := NULL;
    END IF;

    IF v_locked_by IS NULL OR v_locked_by = auth.uid() THEN
        UPDATE public.matches
        SET locked_by = auth.uid(), locked_at = now()
        WHERE match_id = p_match_id;
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_match_lock(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.matches
    SET locked_at = now()
    WHERE match_id = p_match_id AND locked_by = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.release_match_lock(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.matches
    SET locked_by = NULL, locked_at = NULL
    WHERE match_id = p_match_id AND locked_by = auth.uid();
END;
$$;

-- ============================================================
-- MERGE UTILITIES  (admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.merge_teams(p_keep_id uuid, p_merge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.players      SET team_id = p_keep_id WHERE team_id = p_merge_id;
    UPDATE public.matches       SET home_team_id = p_keep_id WHERE home_team_id = p_merge_id;
    UPDATE public.matches       SET away_team_id = p_keep_id WHERE away_team_id = p_merge_id;
    UPDATE public.lineups       SET team_id = p_keep_id WHERE team_id = p_merge_id;
    UPDATE public.match_events  SET team_id = p_keep_id WHERE team_id = p_merge_id;
    DELETE FROM public.teams WHERE team_id = p_merge_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_players(p_keep_id uuid, p_merge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.match_events SET player_id          = p_keep_id WHERE player_id          = p_merge_id;
    UPDATE public.match_events SET reaction_player_id = p_keep_id WHERE reaction_player_id = p_merge_id;
    UPDATE public.lineups      SET player_id          = p_keep_id WHERE player_id          = p_merge_id;
    DELETE FROM public.players WHERE player_id = p_merge_id;
END;
$$;
