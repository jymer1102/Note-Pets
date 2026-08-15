import { scene } from './app.js';
import { savePetToDB, deletePetFromDB } from './auth.js';

export const pets = [];

export function clearPetsArray() {
  pets.forEach((p) => p.destroy());
  pets.length = 0;
}

// --- Easing helpers (used for spawn / save / delete animations) ---
function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function easeInQuad(t) {
  return t * t;
}

function createTextTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 20);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'Bold 42px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  return new THREE.CanvasTexture(canvas);
}

export class Pet {
  constructor(data = {}) {
    this.id = data.id || null;
    this.title = data.title || 'My Pet';
    this.note = data.note || '';
    this.color = data.color || `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;

    // Unique seed generator - drives every procedural feature below.
    // Falls back to a fresh random seed for brand-new pets; a loaded
    // pet keeps whatever seed it was created with (when available).
    this.seed = typeof data.seed === 'number' ? data.seed : Math.random();

    // Position & movement
    this.posX = typeof data.posX === 'number' ? data.posX : (Math.random() - 0.5) * 8;
    this.posZ = typeof data.posZ === 'number' ? data.posZ : (Math.random() - 0.5) * 8;
    this.targetX = this.posX;
    this.targetZ = this.posZ;
    // Units per second (previously tuned as a per-frame value at ~60fps).
    this.speed = (0.02 + this.seed * 0.02) * 60;
    this.isDragging = false;
    this.destroyed = false;

    this.group = new THREE.Group();

    // --- Procedural features based on seed ---
    const scaleY = 0.8 + this.seed * 0.5;
    this.scaleY = scaleY;
    // Kept for the pets.scale_x / scale_y / scale_z (not-null) DB columns.
    this.scaleX = 1;
    this.scaleZ = scaleY;

    const bodyGeo = new THREE.SphereGeometry(0.5, 32, 32);
    bodyGeo.scale(1, scaleY, 1);

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 1
    });

    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMaterial);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.userData.petInstance = this;
    this.group.add(this.bodyMesh);

    // Eyes
    this.eyeMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 1
    });
    const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16);

    const leftEye = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    leftEye.position.set(-0.18, 0.15 * scaleY, 0.42);

    const rightEye = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    rightEye.position.set(0.18, 0.15 * scaleY, 0.42);

    this.eyeMeshes = [leftEye, rightEye];
    this.group.add(leftEye, rightEye);

    // Random Ears (Round vs Pointy based on seed)
    this.pointyEars = this.seed > 0.5;
    const earGeo = this.pointyEars
      ? new THREE.ConeGeometry(0.15, 0.3, 16)
      : new THREE.SphereGeometry(0.15, 16, 16);

    const leftEar = new THREE.Mesh(earGeo, this.bodyMaterial);
    leftEar.position.set(-0.3, 0.45 * scaleY, 0);
    if (this.pointyEars) leftEar.rotation.z = -0.3;

    const rightEar = new THREE.Mesh(earGeo, this.bodyMaterial);
    rightEar.position.set(0.3, 0.45 * scaleY, 0);
    if (this.pointyEars) rightEar.rotation.z = 0.3;

    this.earMeshes = [leftEar, rightEar];
    this.group.add(leftEar, rightEar);

    // Make ears clickable/selectable too (body sphere already covers most of it).
    leftEar.userData.petInstance = this;
    rightEar.userData.petInstance = this;
    this.hitMeshes = [this.bodyMesh, leftEar, rightEar];

    // Floating Title Tag
    this.labelYOffset = 0.8 * scaleY + 0.6;
    this.labelSprite = this.createLabelSprite(this.title);
    this.labelSprite.position.set(0, this.labelYOffset, 0);
    this.group.add(this.labelSprite);

    this.baseY = 0.5 * scaleY;
    this.group.position.set(this.posX, this.baseY, this.posZ);
    scene.add(this.group);

    this.mesh = this.bodyMesh; // kept for backward compatibility
    pets.push(this);

    this.bounceOffset = Math.random() * Math.PI * 2;

    // Animation state
    this.spawnAnim = { elapsed: 0, duration: 0.7 };
    this.saveAnim = null;
    this.deleteAnim = null;

    this.pickNewTarget();
  }

  createLabelSprite(text) {
    const texture = createTextTexture(text);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
  }

  updateLabel(text) {
    this.title = text;
    this.group.remove(this.labelSprite);
    this.labelSprite.material.map.dispose();
    this.labelSprite.material.dispose();

    this.labelSprite = this.createLabelSprite(this.title);
    this.labelSprite.position.set(0, this.labelYOffset, 0);
    this.group.add(this.labelSprite);
  }

  setColor(hexColor) {
    this.color = hexColor;
    this.bodyMaterial.color.set(hexColor);
  }

  // Builds a fully independent copy of this pet (own geometries + own
  // materials) for use in the mini edit-card preview scene, so spinning
  // or recoloring the preview never touches the live pet in the world.
  createPreviewClone() {
    const group = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      roughness: 0.3,
      metalness: 0.1
    });
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const body = new THREE.Mesh(this.bodyMesh.geometry.clone(), bodyMaterial);
    group.add(body);

    this.eyeMeshes.forEach((eye) => {
      const m = new THREE.Mesh(eye.geometry.clone(), eyeMaterial);
      m.position.copy(eye.position);
      group.add(m);
    });

    this.earMeshes.forEach((ear) => {
      const m = new THREE.Mesh(ear.geometry.clone(), bodyMaterial);
      m.position.copy(ear.position);
      m.rotation.copy(ear.rotation);
      group.add(m);
    });

    group.position.set(0, -0.5 * this.scaleY, 0);

    return { group, bodyMaterial, eyeMaterial };
  }

  pickNewTarget() {
    if (this.destroyed) return;
    if (!this.isDragging) {
      this.targetX = (Math.random() - 0.5) * 8;
      this.targetZ = (Math.random() - 0.5) * 8;
    }
    setTimeout(() => this.pickNewTarget(), 3000 + Math.random() * 4000);
  }

  playSaveAnimation() {
    this.saveAnim = { elapsed: 0, duration: 0.5 };
  }

  playDeleteAnimation(onComplete) {
    this.deleteAnim = { elapsed: 0, duration: 0.45, done: false, onComplete };
  }

  // Squish-then-pop scale multiplier for the save animation.
  _saveScaleMultiplier(t) {
    if (t < 0.35) {
      const k = t / 0.35;
      return THREE.MathUtils.lerp(1, 0.8, easeOutQuad(k));
    }
    const k = (t - 0.35) / 0.65;
    return THREE.MathUtils.lerp(0.8, 1, easeOutBack(k));
  }

  update(delta = 1 / 60) {
    // Delete animation takes over completely: shrink + fade, then fire the callback once.
    if (this.deleteAnim) {
      this.deleteAnim.elapsed += delta;
      const t = Math.min(this.deleteAnim.elapsed / this.deleteAnim.duration, 1);
      const scale = Math.max(1 - easeInQuad(t), 0.001);
      this.group.scale.setScalar(scale);

      const opacity = 1 - t;
      this.bodyMaterial.opacity = opacity;
      this.eyeMaterial.opacity = opacity;
      if (this.labelSprite) this.labelSprite.material.opacity = opacity;

      if (t >= 1 && !this.deleteAnim.done) {
        this.deleteAnim.done = true;
        this.deleteAnim.onComplete();
      }
      return;
    }

    // Wandering movement
    if (!this.isDragging) {
      const dx = this.targetX - this.group.position.x;
      const dz = this.targetZ - this.group.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.1) {
        const step = this.speed * delta;
        this.group.position.x += (dx / dist) * step;
        this.group.position.z += (dz / dist) * step;
        this.group.rotation.y = Math.atan2(dx, dz);
      }
    }

    // Subtle wandering bob
    this.bounceOffset += delta * 5;
    const bob = Math.abs(Math.sin(this.bounceOffset)) * 0.12;

    let scaleMult = 1;
    let dropOffset = 0;

    // Spawn: springy drop-in / scale bounce
    if (this.spawnAnim) {
      this.spawnAnim.elapsed += delta;
      const t = Math.min(this.spawnAnim.elapsed / this.spawnAnim.duration, 1);
      scaleMult *= easeOutElastic(t);
      dropOffset = (1 - easeOutBack(t)) * 1.5;
      if (t >= 1) this.spawnAnim = null;
    }

    // Save: squish-and-pop bounce
    if (this.saveAnim) {
      this.saveAnim.elapsed += delta;
      const t = Math.min(this.saveAnim.elapsed / this.saveAnim.duration, 1);
      scaleMult *= this._saveScaleMultiplier(t);
      if (t >= 1) this.saveAnim = null;
    }

    this.group.scale.setScalar(Math.max(scaleMult, 0.001));
    this.group.position.y = this.baseY + bob + dropOffset;
  }

  async save() {
    await savePetToDB(this);
  }

  async delete() {
    await deletePetFromDB(this);
  }

  destroy() {
    this.destroyed = true;
    scene.remove(this.group);

    this.bodyMesh.geometry.dispose();
    this.bodyMaterial.dispose();

    this.eyeMeshes.forEach((m) => m.geometry.dispose());
    this.eyeMaterial.dispose();

    this.earMeshes.forEach((m) => m.geometry.dispose());

    if (this.labelSprite) {
      this.labelSprite.material.map.dispose();
      this.labelSprite.material.dispose();
    }
  }
}

// Disposes a preview clone produced by Pet#createPreviewClone.
export function disposePreviewClone(preview) {
  if (!preview) return;
  preview.group.traverse((child) => {
    if (child.isMesh) child.geometry.dispose();
  });
  preview.bodyMaterial.dispose();
  preview.eyeMaterial.dispose();
}
