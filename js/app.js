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

// --- COLOR THEMES ---
// Curated palettes the user can pick a pet color from, in addition to the
// free-form color input. Purely a UI convenience layer over Pet#setColor.
const COLOR_THEMES = [
  { name: 'Pastel', colors: ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e0bbff'] },
  { name: 'Neon', colors: ['#ff206e', '#fbff12', '#05f2af', '#00f5ff', '#ff9f1c', '#7b2ff7'] },
  { name: 'Earth', colors: ['#8d6e63', '#a1887f', '#c9b458', '#6d8b74', '#4e6151', '#d7a86e'] },
  { name: 'Ocean', colors: ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8', '#48cae4'] },
  { name: 'Sunset', colors: ['#ff9a8b', '#ff6a88', '#ff99ac', '#fecd1a', '#ff6f61', '#c94b4b'] }
];

let activeThemeIndex = 0;
let themeUI = null; // { container, tabsEl, swatchesEl }

function buildThemeUI() {
  if (themeUI) return themeUI;

  const container = document.createElement('div');
  container.className = 'control-group theme-picker';
  container.style.marginTop = '4px';
  container.style.marginBottom = '15px';

  const label = document.createElement('label');
  label.textContent = 'Color Theme:';
  container.appendChild(label);

  const tabsEl = document.createElement('div');
  tabsEl.style.display = 'flex';
  tabsEl.style.flexWrap = 'wrap';
  tabsEl.style.gap = '6px';
  tabsEl.style.margin = '6px 0 10px';

  const swatchesEl = document.createElement('div');
  swatchesEl.style.display = 'flex';
  swatchesEl.style.flexWrap = 'wrap';
  swatchesEl.style.gap = '8px';

  COLOR_THEMES.forEach((theme, i) => {
    const tabBtn = document.createElement('button');
    tabBtn.type = 'button';
    tabBtn.textContent = theme.name;
    tabBtn.style.padding = '4px 10px';
    tabBtn.style.borderRadius = '999px';
    tabBtn.style.border = '1px solid rgba(255,255,255,0.2)';
    tabBtn.style.background = i === activeThemeIndex ? '#4f46e5' : 'rgba(255,255,255,0.08)';
    tabBtn.style.color = '#fff';
    tabBtn.style.fontSize = '12px';
    tabBtn.style.cursor = 'pointer';
    tabBtn.addEventListener('click', () => {
      activeThemeIndex = i;
      renderThemeTabs();
      renderThemeSwatches();
    });
    tabsEl.appendChild(tabBtn);
  });

  container.appendChild(tabsEl);
  container.appendChild(swatchesEl);

  themeUI = { container, tabsEl, swatchesEl };
  return themeUI;
}

function renderThemeTabs() {
  Array.from(themeUI.tabsEl.children).forEach((btn, i) => {
    btn.style.background = i === activeThemeIndex ? '#4f46e5' : 'rgba(255,255,255,0.08)';
  });
}

function renderThemeSwatches() {
  const swatchesEl = themeUI.swatchesEl;
  swatchesEl.innerHTML = '';

  const activeColor = (document.getElementById('petColor')?.value || '').toLowerCase();

  COLOR_THEMES[activeThemeIndex].colors.forEach((hex) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.title = hex;
    swatch.style.width = '28px';
    swatch.style.height = '28px';
    swatch.style.borderRadius = '50%';
    swatch.style.border = hex.toLowerCase() === activeColor ? '2px solid #fff' : '2px solid rgba(255,255,255,0.25)';
    swatch.style.background = hex;
    swatch.style.cursor = 'pointer';
    swatch.addEventListener('click', () => applyPetColor(hex));
    swatchesEl.appendChild(swatch);
  });
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

function applyPetColor(hex) {
  petColorInput.value = hex;
  if (selectedPet) selectedPet.setColor(hex);
  if (currentPreview) currentPreview.bodyMaterial.color.set(hex);
  if (themeUI) renderThemeSwatches();
}

function selectPet(pet) {
  selectedPet = pet;
  petCard.classList.add('active');

  petColorInput.value = pet.color;
  noteTitleInput.value = pet.title;
  noteInput.value = pet.note;

  updatePreviewPet(pet);

  const ui = buildThemeUI();
  if (!ui.container.isConnected) {
    petColorInput.closest('.control-group').insertAdjacentElement('afterend', ui.container);
  }
  renderThemeTabs();
  renderThemeSwatches();
}

function deselectPet() {
  selectedPet = null;
  petCard.classList.remove('active');
  clearPreview();
}

if (closeCardBtn) closeCardBtn.addEventListener('click', deselectPet);

// Live Color Preview - updates both the live pet and the mini preview model
if (petColorInput) {
  petColorInput.addEventListener('input', (e) => applyPetColor(e.target.value));
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
