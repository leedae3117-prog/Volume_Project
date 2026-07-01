create table if not exists workout_sets (
  id bigint generated always as identity primary key,
  user_id text not null default 'daeyeon',
  workout_date date not null,
  body_part text not null,
  exercise_name text not null,
  set_no integer not null,
  weight numeric not null,
  reps integer not null,
  volume numeric not null,
  created_at timestamptz not null default now()
);

alter table workout_sets
add column if not exists user_id text;

update workout_sets
set user_id = 'daeyeon'
where user_id is null
  and workout_date in ('2026-06-30', '2026-07-01');

update workout_sets
set user_id = 'daeyeon'
where user_id is null;

alter table workout_sets
alter column user_id set default 'daeyeon';

alter table workout_sets
alter column user_id set not null;

create index if not exists workout_sets_date_idx
on workout_sets (workout_date desc);

create index if not exists workout_sets_body_part_idx
on workout_sets (body_part, workout_date desc);

create index if not exists workout_sets_user_date_idx
on workout_sets (user_id, workout_date desc);
