import { initAuth } from './auth.js';
import { Pet, pets } from './pet.js';

// --- MAIN THREE.JS SCENE SETUP ---
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

// --- PREVIEW WINDOW (MINI THREE.JS SCENE FOR EDITING) ---
let previewScene, previewCamera, previewRenderer, previewPetGroup;

function initPreviewWindow() {
  const petCard = document.getElementById('petCard');
  
  // Create preview container if not present in HTML
  let previewContainer = document.getElementById('petPreviewContainer');
  if (!previewContainer) {
    previewContainer = document.createElement('div');
    previewContainer.id = 'petPreviewContainer';
    previewContainer.style.width = '100%';
    previewContainer.style.height = '150px';
    previewContainer.style.borderRadius = '12px';
    previewContainer.style.overflow = 'hidden';
    previewContainer.style.marginBottom = '15px';
    previewContainer.style.background = '#111122';
    
    // Insert preview box at the top of petCard
    petCard.insertBefore(previewContainer, petCard.firstChild.nextSibling);
  }

  previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color(0x16162a);

  previewCamera = new THREE.PerspectiveCamera(45, previewContainer.clientWidth / 150, 0.1, 100);
  previewCamera.position.set(0, 0.8, 2.5);

  const previewLight = new THREE.DirectionalLight(0xffffff, 1);
  previewLight.position.set(2, 5, 3);
  previewScene.add(previewLight);
  previewScene.add(new THREE.AmbientLight(0xffffff, 0.6));

  previewRenderer = new THREE.WebGLRenderer({ antialias: true });
  previewRenderer.setSize(previewContainer.clientWidth, 150);
  previewRenderer.setPixelRatio(window.devicePixelRatio);
  previewContainer.appendChild(previewRenderer.domElement);
}

function updatePreviewPet(pet) {
  if (!previewScene) initPreviewWindow();

  // Clear previous preview mesh
  if (previewPetGroup) previewScene.remove(previewPetGroup);

  // Clone pet group for spinning preview
  previewPetGroup = pet.group.clone();
  previewPetGroup.position.set(0, -0.2, 0);
  previewScene.add(previewPetGroup);
}

// --- RAYCASTING & DRAG CONTROLS ---
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
      controls.enabled = false;
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
    controls.enabled = true;
  }
});

function selectPet(pet) {
  selectedPet = pet;
  petCard.classList.add('active');

  petColorInput.value = pet.color;
  noteTitleInput.value = pet.title;
  noteInput.value = pet.note;

  updatePreviewPet(pet);
}

function deselectPet() {
  selectedPet = null;
  petCard.classList.remove('active');
}

if (closeCardBtn) closeCardBtn.addEventListener('click', deselectPet);

// Live Color Preview
if (petColorInput) {
  petColorInput.addEventListener('input', (e) => {
    if (selectedPet) {
      selectedPet.setColor(e.target.value);
      if (previewPetGroup) {
        previewPetGroup.traverse((child) => {
          if (child.isMesh && child.material && child !== previewPetGroup.children[1]) {
            child.material.color.set(e.target.value);
          }
        });
      }
    }
  });
}

// Save with bounce animation
if (saveNoteBtn) {
  saveNoteBtn.addEventListener('click', async () => {
    if (selectedPet) {
      const newTitle = noteTitleInput.value.trim() || 'My Pet';
      selectedPet.updateLabel(newTitle);
      selectedPet.note = noteInput.value;

      // Play save bounce animation
      selectedPet.playSaveAnimation();

      await selectedPet.save();
      deselectPet();
    }
  });
}

// Delete with fade/shrink animation
if (deleteNoteBtn) {
  deleteNoteBtn.addEventListener('click', async () => {
    if (selectedPet) {
      const petToDelete = selectedPet;
      deselectPet();
      
      // Play delete shrink animation before removing from DB
      petToDelete.playDeleteAnimation(async () => {
        await petToDelete.delete();
      });
    }
  });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- ANIMATION LOOP ---
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  pets.forEach((pet) => pet.update());

  // Slow spin for pet preview window
  if (previewPetGroup) {
    previewPetGroup.rotation.y += 0.015;
    previewRenderer.render(previewScene, previewCamera);
  }

  renderer.render(scene, camera);
}

initAuth();
animate();
