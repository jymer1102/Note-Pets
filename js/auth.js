import { supabase, currentUser, setCurrentUser } from './supabase.js';
import { Pet, pets, clearPetsArray } from './pet.js';

const authOverlay = document.getElementById('authOverlay');
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const authError = document.getElementById('authError');

const formatEmail = (username) => `${username.trim().toLowerCase()}@petapp.local`;

export function initAuth() {
  document.getElementById('signupBtn').addEventListener('click', async () => {
    authError.textContent = '';
    const email = formatEmail(authUsername.value);
    const password = authPassword.value;

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return (authError.textContent = error.message);

    setCurrentUser(data.user);
    authOverlay.style.display = 'none';
    loadUserPets();
  });

  document.getElementById('loginBtn').addEventListener('click', async () => {
    authError.textContent = '';
    const email = formatEmail(authUsername.value);
    const password = authPassword.value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return (authError.textContent = error.message);

    setCurrentUser(data.user);
    authOverlay.style.display = 'none';
    loadUserPets();
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
  });
}

export async function loadUserPets() {
  clearPetsArray();

  const { data, error } = await supabase.from('pets').select('*');
  if (error) return console.error('Error loading pets:', error);

  data.forEach((record) => new Pet(record));
}

export async function savePetToDB(pet) {
  const petPayload = {
    user_id: currentUser.id,
    title: pet.title,
    note: pet.note,
    color: pet.color,
    scale_x: pet.scaleX,
    scale_y: pet.scaleY,
    scale_z: pet.scaleZ
  };

  if (pet.id) {
    await supabase.from('pets').update(petPayload).eq('id', pet.id);
  } else {
    const { data } = await supabase.from('pets').insert([petPayload]).select();
    if (data && data.length > 0) pet.id = data[0].id;
  }
}

export async function deletePetFromDB(pet) {
  if (pet.id) {
    await supabase.from('pets').delete().eq('id', pet.id);
  }
  pet.destroy();
  const index = pets.indexOf(pet);
  if (index > -1) pets.splice(index, 1);
}
