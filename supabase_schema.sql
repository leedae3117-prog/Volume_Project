create table if not exists workout_sets (
  id bigint generated always as identity primary key,
  workout_date date not null,
  body_part text not null,
  exercise_name text not null,
  set_no integer not null,
  weight numeric not null,
  reps integer not null,
  volume numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists workout_sets_date_idx
on workout_sets (workout_date desc);

create index if not exists workout_sets_body_part_idx
on workout_sets (body_part, workout_date desc);
