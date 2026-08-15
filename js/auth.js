import { supabase, setCurrentUser } from './supabase.js';
import { Pet, pets, clearPetsArray } from './pet.js';

let isUsernameValid = false;

const formatEmail = (username) => `${username.trim().toLowerCase()}@petapp.local`;

export function initAuth() {
  const authOverlay = document.getElementById('authOverlay');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const authError = document.getElementById('authError');

  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');

  const signupUsername = document.getElementById('signupUsername');
  const signupPassword = document.getElementById('signupPassword');
  const signupConfirmPassword = document.getElementById('signupConfirmPassword');
  const usernameCheck = document.getElementById('usernameCheck');

  const showSignupBtn = document.getElementById('showSignup');
  const showLoginBtn = document.getElementById('showLogin');

  // Toggle Password Visibility
  document.querySelectorAll('.toggle-password').forEach((icon) => {
    icon.addEventListener('click', () => {
      const targetId = icon.getAttribute('data-target');
      const targetInput = document.getElementById(targetId);

      if (targetInput.type === 'password') {
        targetInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        targetInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });
  });

  if (showSignupBtn) {
    showSignupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'none';
      signupForm.style.display = 'block';
      authError.textContent = '';
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      signupForm.style.display = 'none';
      loginForm.style.display = 'block';
      authError.textContent = '';
    });
  }

  if (signupUsername) {
    signupUsername.addEventListener('input', async () => {
      const username = signupUsername.value.trim();
      usernameCheck.className = 'check-icon';
      usernameCheck.innerHTML = '';
      isUsernameValid = false;

      if (username.length < 2) {
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase());

      if (error) return;

      if (data.length === 0) {
        usernameCheck.classList.add('valid');
        usernameCheck.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        isUsernameValid = true;
      } else {
        usernameCheck.classList.add('invalid');
        usernameCheck.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
      }
    });
  }

  const signupBtn = document.getElementById('signupBtn');
  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      authError.textContent = '';

      const username = signupUsername.value.trim();
      const password = signupPassword.value;
      const confirmPassword = signupConfirmPassword.value;

      if (username.length < 2) {
        return (authError.textContent = 'Username must be at least 2 characters.');
      }
      if (!isUsernameValid) {
        return (authError.textContent = 'Please choose an available username.');
      }
      if (password.length < 6) {
        return (authError.textContent = 'Password must be at least 6 characters.');
      }
      if (password !== confirmPassword) {
        return (authError.textContent = 'Passwords do not match.');
      }

      const email = formatEmail(username);

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return (authError.textContent = error.message);

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{ id: data.user.id, username: username.toLowerCase() }]);

        if (profileError) {
          return (authError.textContent = 'Error setting up profile.');
        }

        setCurrentUser(data.user);
        authOverlay.style.display = 'none';
        loadUserPets();
      }
    });
  }

  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      authError.textContent = '';
      const email = formatEmail(loginUsername.value);
      const password = loginPassword.value;

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return (authError.textContent = 'Invalid username or password.');

      setCurrentUser(data.user);
      authOverlay.style.display = 'none';
      loadUserPets();
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      location.reload();
    });
  }
}

export async function loadUserPets() {
  clearPetsArray();

  const { data, error } = await supabase.from('pets').select('*');
  if (error) return console.error('Error loading pets:', error);

  data.forEach((record) => new Pet(record));
}

export async function savePetToDB(pet) {
  const { currentUser } = await import('./supabase.js');
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
