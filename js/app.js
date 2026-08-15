import { initAuth } from './auth.js';
import { Pet, pets } from './pet.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

export const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 6, 10);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

export const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// LIGHTS & GROUND
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(20, 20, 0x4f46e5, 0x2e2e48);
scene.add(gridHelper);

const planeGeo = new THREE.PlaneGeometry(20, 20);
const planeMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.8 });
const ground = new THREE.Mesh(planeGeo, planeMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// RAYCASTING & DRAGGING
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const planeIntersection = new THREE.Vector3();

let selectedPet = null;
let draggedPet = null;

const petCard = document.getElementById('petCard');
const petColorInput = document.getElementById('petColor');
const noteTitleInput = document.getElementById('noteTitle');
const noteInput = document.getElementById('noteInput');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const closeCardBtn = document.getElementById('closeCardBtn');
const addPetBtn = document.getElementById('addPetBtn');

if (addPetBtn) {
  addPetBtn.addEventListener('click', () => {
    const newPet = new Pet();
    selectPet(newPet);
  });
}

// Mouse Controls for Dragging & Selecting
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#authOverlay') || e.target.closest('.pet-card') || e.target.closest('.top-right-controls')) {
    return;
  }

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const meshes = pets.map((p) => p.mesh);
  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object;
    const petInstance = hitMesh.userData.petInstance;

    if (petInstance) {
      draggedPet = petInstance;
      draggedPet.isDragging = true;
      controls.enabled = false; // Disable camera orbit while dragging pet
      selectPet(petInstance);
    }
  } else {
    deselectPet();
  }
});

window.addEventListener('pointermove', (e) => {
  if (!draggedPet) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  if (raycaster.ray.intersectPlane(dragPlane, planeIntersection)) {
    draggedPet.group.position.x = planeIntersection.x;
    draggedPet.group.position.z = planeIntersection.z;
    draggedPet.targetX = planeIntersection.x;
    draggedPet.targetZ = planeIntersection.z;
  }
});

window.addEventListener('pointerup', () => {
  if (draggedPet) {
    draggedPet.isDragging = false;
    draggedPet = null;
    controls.enabled = true; // Re-enable camera orbit
  }
});

function selectPet(pet) {
  selectedPet = pet;
  petCard.classList.add('active');

  petColorInput.value = pet.color;
  noteTitleInput.value = pet.title;
  noteInput.value = pet.note;
}

function deselectPet() {
  selectedPet = null;
  petCard.classList.remove('active');
}

if (closeCardBtn) closeCardBtn.addEventListener('click', deselectPet);

if (petColorInput) {
  petColorInput.addEventListener('input', (e) => {
    if (selectedPet) selectedPet.setColor(e.target.value);
  });
}

if (saveNoteBtn) {
  saveNoteBtn.addEventListener('click', async () => {
    if (selectedPet) {
      selectedPet.updateLabel(noteTitleInput.value);
      selectedPet.note = noteInput.value;
      await selectedPet.save();
      deselectPet();
    }
  });
}

if (deleteNoteBtn) {
  deleteNoteBtn.addEventListener('click', async () => {
    if (selectedPet) {
      await selectedPet.delete();
      deselectPet();
    }
  });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  pets.forEach((pet) => pet.update());

  renderer.render(scene, camera);
}

initAuth();
animate();
