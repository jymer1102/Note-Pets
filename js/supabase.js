const SUPABASE_URL = "https://ckjwbcwwrbtyqqliesnk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrandiY3d3cmJ0eXFxbGllc25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3Nzk4ODAsImV4cCI6MjEwMjM1NTg4MH0.XD932PhYXoJ5psXWKDttTJuTHdYjun6hMT3MlgsQs7E";

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export let currentUser = null;

export function setCurrentUser(user) {
  currentUser = user;
}

export async function checkSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error fetching session:', error.message);
    return null;
  }
  
  if (data?.session?.user) {
    currentUser = data.session.user;
    return data.session.user;
  }
  
  return null;
}
