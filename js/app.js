import { Pet, pets } from './pet.js';
import { initAuth, savePetToDB, deletePetFromDB } from './auth.js';

// --- THEMES ---
const themes = {
  midnight: { bg: 0x1a1a2e, floor: 0x16213e },
  sunset:   { bg: 0xffd1dc, floor: 0xfbc4ab },
  cyber:    { bg: 0x0f051d, floor: 0x240046 },
  mint:     { bg: 0xe8f5e9, floor: 0xc8e6c9 },
  clean:    { bg: 0xf8f9fa, floor: 0xe9ecef }
};

// --- THREE.JS SETUP ---
const container = document.getElementById('canvas-container');
export const scene = new THREE.Scene();
scene.background = new THREE.Color(themes.midnight.bg);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 9, 17);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.02;

// Lights & Floor
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const arenaSize = 24;
const floorGeo = new THREE.PlaneGeometry(arenaSize, arenaSize);
const floorMat = new THREE.MeshStandardMaterial({ color: themes.midnight.floor, roughness: 0.8 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// --- UI SELECTION LOGIC ---
let selectedPet = null;

const petCard = document.getElementById('petCard');
const petColorInput = document.getElementById('petColor');
const noteTitle = document.getElementById('noteTitle');
const noteInput = document.getElementById('noteInput');

function selectPet(pet) {
  selectedPet = pet;
  if (pet) {
    petColorInput.value = '#' + pet.material.color.getHexString();
    noteTitle.value = pet.title;
    noteInput.value = pet.note;
    petCard.classList.add('active');
  } else {
    petCard.classList.remove('active');
  }
}

// Event Listeners
document.getElementById('addPetBtn').addEventListener('click', async () => {
  const newPet = new Pet();
  selectPet(newPet);
  await savePetToDB(newPet);
});

document.getElementById('closeCardBtn').addEventListener('click', () => selectPet(null));

petColorInput.addEventListener('input', (e) => {
  if (selectedPet) {
    selectedPet.color = e.target.value;
    selectedPet.material.color.set(e.target.value);
  }
});

document.getElementById('saveNoteBtn').addEventListener('click', async () => {
  if (selectedPet) {
    selectedPet.title = noteTitle.value;
    selectedPet.note = noteInput.value;
    selectedPet.updateLabel();
    selectedPet.triggerWiggle();
    await savePetToDB(selectedPet);
    selectPet(null);
  }
});

document.getElementById('deleteNoteBtn').addEventListener('click', async () => {
  if (selectedPet) {
    await deletePetFromDB(selectedPet);
    selectPet(null);
  }
});

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Init Auth and Animation Loop
initAuth();

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  pets.forEach((pet) => pet.update(delta));
  controls.update();
  renderer.render(scene, camera);
}
animate();
