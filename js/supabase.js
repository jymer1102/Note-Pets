const SUPABASE_URL = "https://ckjwbcwwrbtyqqliesnk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrandiY3d3cmJ0eXFxbGllc25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3Nzk4ODAsImV4cCI6MjEwMjM1NTg4MH0.XD932PhYXoJ5psXWKDttTJuTHdYjun6hMT3MlgsQs7E";

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export let currentUser = null;

export function setCurrentUser(user) {
  currentUser = user;
}
