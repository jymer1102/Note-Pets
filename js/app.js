import { initAuth } from './auth.js';
import { Pet, pets, disposePreviewClone } from './pet.js';

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
const PREVIEW_HEIGHT = 150;
const PREVIEW_SPIN_SPEED = (Math.PI * 2) / 6; // one slow 360° spin every 6 seconds

let previewScene, previewCamera, previewRenderer;
let currentPreview = null; // { group, bodyMaterial, eyeMaterial } from Pet#createPreviewClone

function initPreviewWindow() {
  const petCard = document.getElementById('petCard');

  // Create preview container if not present in HTML
  let previewContainer = document.getElementById('petPreviewContainer');
  if (!previewContainer) {
    previewContainer = document.createElement('div');
    previewContainer.id = 'petPreviewContainer';
    previewContainer.style.width = '100%';
    previewContainer.style.height = `${PREVIEW_HEIGHT}px`;
    previewContainer.style.borderRadius = '12px';
    previewContainer.style.overflow = 'hidden';
    previewContainer.style.marginBottom = '15px';
    previewContainer.style.background = '#111122';

    // Insert preview box at the top of petCard
    petCard.insertBefore(previewContainer, petCard.firstChild.nextSibling);
  }

  previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color(0x16162a);

  previewCamera = new THREE.PerspectiveCamera(45, previewContainer.clientWidth / PREVIEW_HEIGHT, 0.1, 100);
  previewCamera.position.set(0, 0.9, 3);
  previewCamera.lookAt(0, 0.1, 0);

  const previewLight = new THREE.DirectionalLight(0xffffff, 1);
  previewLight.position.set(2, 5, 3);
  previewScene.add(previewLight);
  previewScene.add(new THREE.AmbientLight(0xffffff, 0.6));

  previewRenderer = new THREE.WebGLRenderer({ antialias: true });
  previewRenderer.setSize(previewContainer.clientWidth, PREVIEW_HEIGHT);
  previewRenderer.setPixelRatio(window.devicePixelRatio);
  previewContainer.appendChild(previewRenderer.domElement);
}

function clearPreview() {
  if (currentPreview) {
    previewScene.remove(currentPreview.group);
    disposePreviewClone(currentPreview);
    currentPreview = null;
  }
}

function updatePreviewPet(pet) {
  if (!previewScene) initPreviewWindow();

  clearPreview();

  currentPreview = pet.createPreviewClone();
  previewScene.add(currentPreview.group);
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
  const meshes = pets.flatMap((p) => p.hitMeshes);
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
  clearPreview();
}

if (closeCardBtn) closeCardBtn.addEventListener('click', deselectPet);

// Live Color Preview - updates both the live pet and the mini preview model
if (petColorInput) {
  petColorInput.addEventListener('input', (e) => {
    if (selectedPet) {
      selectedPet.setColor(e.target.value);
    }
    if (currentPreview) {
      currentPreview.bodyMaterial.color.set(e.target.value);
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

      // Play delete shrink animation before removing from the scene and Supabase
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
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  // Clamp delta so a backgrounded/inactive tab doesn't cause a huge jump
  // (e.g. an instant full spawn/save animation) when it regains focus.
  const delta = Math.min(clock.getDelta(), 0.1);

  controls.update();

  pets.forEach((pet) => pet.update(delta));

  // Slow continuous 360° spin for the pet preview window
  if (currentPreview) {
    currentPreview.group.rotation.y += delta * PREVIEW_SPIN_SPEED;
    previewRenderer.render(previewScene, previewCamera);
  }

  renderer.render(scene, camera);
}

initAuth();
animate();
