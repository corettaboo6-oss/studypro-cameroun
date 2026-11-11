-- STUDYPRO CAMEROUN: comptes et classement collectif hebdomadaire
create table if not exists public.studypro_profiles (user_id uuid primary key references auth.users(id) on delete cascade,display_name text not null check(char_length(display_name) between 2 and 32),created_at timestamptz not null default now());
create table if not exists public.studypro_weekly_scores (user_id uuid not null references auth.users(id) on delete cascade,week_start date not null,score integer not null default 0 check(score>=0),answers_count integer not null default 0 check(answers_count>=0),best_time_ms integer,updated_at timestamptz not null default now(),primary key(user_id,week_start));
create table if not exists public.studypro_weekly_answers (user_id uuid not null references auth.users(id) on delete cascade,week_start date not null,question_id integer not null check(question_id>=0),elapsed_ms integer not null check(elapsed_ms between 1 and 600000),created_at timestamptz not null default now(),primary key(user_id,week_start,question_id));
alter table public.studypro_profiles enable row level security;
alter table public.studypro_weekly_scores enable row level security;
alter table public.studypro_weekly_answers enable row level security;
drop policy if exists "Profiles are publicly readable" on public.studypro_profiles;
create policy "Profiles are publicly readable" on public.studypro_profiles for select using(true);
drop policy if exists "Students update own profile" on public.studypro_profiles;
create policy "Students update own profile" on public.studypro_profiles for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "Weekly scores are publicly readable" on public.studypro_weekly_scores;
create policy "Weekly scores are publicly readable" on public.studypro_weekly_scores for select using(true);
revoke all on public.studypro_weekly_answers from anon,authenticated;
revoke insert,update,delete on public.studypro_weekly_scores from anon,authenticated;
revoke insert,delete on public.studypro_profiles from anon,authenticated;
grant select on public.studypro_profiles,public.studypro_weekly_scores to anon,authenticated;
create or replace function public.studypro_new_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.studypro_profiles(user_id,display_name) values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'),32),''),'Étudiant')) on conflict(user_id) do nothing; return new; end; $$;
drop trigger if exists studypro_create_profile on auth.users;
create trigger studypro_create_profile after insert on auth.users for each row execute procedure public.studypro_new_profile();
create or replace function public.studypro_record_answer(p_question_id integer,p_elapsed_ms integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_week date:=date_trunc('week',now() at time zone 'utc')::date; v_added integer;
begin
 if v_uid is null then raise exception 'Authentification requise'; end if;
 if p_question_id is null or p_question_id<0 or p_elapsed_ms is null or p_elapsed_ms<1 or p_elapsed_ms>600000 then raise exception 'Résultat invalide'; end if;
 insert into public.studypro_weekly_answers(user_id,week_start,question_id,elapsed_ms) values(v_uid,v_week,p_question_id,p_elapsed_ms) on conflict do nothing;
 get diagnostics v_added=row_count;
 if v_added=1 then insert into public.studypro_weekly_scores(user_id,week_start,score,answers_count,best_time_ms) values(v_uid,v_week,5,1,p_elapsed_ms) on conflict(user_id,week_start) do update set score=studypro_weekly_scores.score+5,answers_count=studypro_weekly_scores.answers_count+1,best_time_ms=least(coalesce(studypro_weekly_scores.best_time_ms,p_elapsed_ms),p_elapsed_ms),updated_at=now(); end if;
 return jsonb_build_object('recorded',v_added=1,'week',v_week);
end; $$;
create or replace function public.studypro_weekly_leaderboard() returns table(user_id uuid,display_name text,score integer,best_time_ms integer,answers_count integer) language sql stable security definer set search_path=public as $$
 select s.user_id,p.display_name,s.score,s.best_time_ms,s.answers_count from public.studypro_weekly_scores s join public.studypro_profiles p on p.user_id=s.user_id where s.week_start=date_trunc('week',now() at time zone 'utc')::date order by s.score desc,s.best_time_ms asc nulls last,s.updated_at asc limit 100;
$$;
revoke all on function public.studypro_record_answer(integer,integer) from public;
revoke all on function public.studypro_weekly_leaderboard() from public;
grant execute on function public.studypro_record_answer(integer,integer) to authenticated;
grant execute on function public.studypro_weekly_leaderboard() to authenticated;
