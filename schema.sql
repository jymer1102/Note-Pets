-- Create profiles table to manage usernames
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null constraint username_length check (char_length(username) >= 2),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create pets table
create table public.pets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default '',
  note text default '',
  color text not null,
  scale_x numeric not null,
  scale_y numeric not null,
  scale_z numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.pets enable row level security;

-- Profiles Policies
create policy "Allow public username lookup" 
  on public.profiles for select 
  using (true);

create policy "Users can insert their own profile" 
  on public.profiles for insert 
  with check (auth.uid() = id);

-- Pets Policies
create policy "Users can view their own pets" 
  on public.pets for select 
  using (auth.uid() = user_id);

create policy "Users can insert their own pets" 
  on public.pets for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own pets" 
  on public.pets for update 
  using (auth.uid() = user_id);

create policy "Users can delete their own pets" 
  on public.pets for delete 
  using (auth.uid() = user_id);
