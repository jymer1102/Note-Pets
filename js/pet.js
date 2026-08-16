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

// --- Eye expressions ---
// Small canvas-drawn textures swapped onto the shared eye material so pets
// can flip between a normal dot, happy "^ ^" carets (spawn), and closed
// "- -" lines (save) without needing separate geometry per expression.
function createEyeTexture(type) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'happy') {
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(8, 42);
    ctx.lineTo(32, 16);
    ctx.lineTo(56, 42);
    ctx.stroke();
  } else if (type === 'closed') {
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(8, 32);
    ctx.lineTo(56, 32);
    ctx.stroke();
  } else {
    // normal
    ctx.beginPath();
    ctx.arc(32, 32, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const EYE_TEXTURES = {
  normal: createEyeTexture('normal'),
  happy: createEyeTexture('happy'),
  closed: createEyeTexture('closed')
};

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

    // Eyes - camera-facing sprites (like the title label) so the expression
    // (dot / happy / closed) always renders crisp and correctly oriented,
    // instead of a flat plane that can be seen edge-on as the pet turns.
    this.eyeMaterial = new THREE.SpriteMaterial({
      map: EYE_TEXTURES.normal,
      transparent: true,
      opacity: 1
    });
    this._eyeExpression = 'normal';

    const leftEye = new THREE.Sprite(this.eyeMaterial);
    leftEye.scale.set(0.22, 0.18, 1);
    leftEye.position.set(-0.18, 0.15 * scaleY, 0.42);

    const rightEye = new THREE.Sprite(this.eyeMaterial);
    rightEye.scale.set(0.22, 0.18, 1);
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
    // Spawn: falls in from off-screen above, lands, then does a happy
    // "^ ^" eyed wiggle before settling back to a normal expression.
    this.spawnAnim = {
      elapsed: 0,
      fallDuration: 0.45,
      landDuration: 0.12,
      wiggleDuration: 0.55
    };
    this.group.position.y = this.baseY + 14; // start well off-screen above
    this.setEyeExpression('normal');

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

  setEyeExpression(type) {
    if (this._eyeExpression === type) return;
    this._eyeExpression = type;
    this.eyeMaterial.map = EYE_TEXTURES[type] || EYE_TEXTURES.normal;
    this.eyeMaterial.needsUpdate = true;
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
    const eyeMaterial = new THREE.SpriteMaterial({
      map: EYE_TEXTURES.normal,
      transparent: true
    });

    const body = new THREE.Mesh(this.bodyMesh.geometry.clone(), bodyMaterial);
    group.add(body);

    this.eyeMeshes.forEach((eye) => {
      const m = new THREE.Sprite(eyeMaterial);
      m.scale.copy(eye.scale);
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
    this.saveAnim = { elapsed: 0, duration: 0.55 };
  }

  playDeleteAnimation(onComplete) {
    this.deleteAnim = { elapsed: 0, bulgeDuration: 0.18, popDuration: 0.18, done: false, onComplete };
  }

  // A decaying side-to-side roll used for both the post-landing spawn
  // wiggle and the save wiggle. Returns the current rotation.z value.
  _wiggleRotation(t) {
    const amplitude = 0.32 * (1 - t);
    return Math.sin(t * Math.PI * 6) * amplitude;
  }

  update(delta = 1 / 60) {
    // Delete animation takes over completely: bulge outward then pop
    // (rapid vanish + fade), then fire the callback once.
    if (this.deleteAnim) {
      const s = this.deleteAnim;
      s.elapsed += delta;
      const bulgeEnd = s.bulgeDuration;
      const popEnd = bulgeEnd + s.popDuration;
      const t = Math.min(s.elapsed, popEnd);

      let scale;
      let opacity = 1;

      if (t < bulgeEnd) {
        const k = t / bulgeEnd;
        scale = THREE.MathUtils.lerp(1, 1.35, easeOutQuad(k));
      } else {
        const k = (t - bulgeEnd) / s.popDuration;
        scale = THREE.MathUtils.lerp(1.35, 0, easeInQuad(k));
        opacity = 1 - k;
      }

      this.group.scale.setScalar(Math.max(scale, 0.001));
      this.bodyMaterial.opacity = opacity;
      this.eyeMaterial.opacity = opacity;
      if (this.labelSprite) this.labelSprite.material.opacity = opacity;

      if (s.elapsed >= popEnd && !s.done) {
        s.done = true;
        s.onComplete();
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
    let rotZ = 0;

    // Spawn: fall from off-screen, land with a squash, then a happy
    // "^ ^" eyed wiggle before settling back to a normal expression.
    if (this.spawnAnim) {
      const s = this.spawnAnim;
      s.elapsed += delta;
      const fallEnd = s.fallDuration;
      const landEnd = fallEnd + s.landDuration;
      const wiggleEnd = landEnd + s.wiggleDuration;

      if (s.elapsed < fallEnd) {
        // Falling: accelerating drop like gravity, eyes still normal.
        const t = s.elapsed / fallEnd;
        dropOffset = (1 - easeInQuad(t)) * 14;
        this.setEyeExpression('normal');
      } else if (s.elapsed < landEnd) {
        // Impact: quick squash-flat. Eyes stay normal here - they only
        // change during the wiggle itself, not the landing squash.
        const t = (s.elapsed - fallEnd) / s.landDuration;
        scaleMult = THREE.MathUtils.lerp(1, 0.6, Math.sin(t * Math.PI));
        this.setEyeExpression('normal');
      } else if (s.elapsed < wiggleEnd) {
        // Wiggle: rock side-to-side while bouncing scale back to normal.
        const t = (s.elapsed - landEnd) / s.wiggleDuration;
        scaleMult = easeOutElastic(Math.min(t * 2, 1));
        rotZ = this._wiggleRotation(t);
        this.setEyeExpression('happy');
      } else {
        this.setEyeExpression('normal');
        this.spawnAnim = null;
      }
    }

    // Save: wiggle with eyes closed, same motion as the spawn wiggle.
    if (this.saveAnim) {
      const s = this.saveAnim;
      s.elapsed += delta;
      const t = Math.min(s.elapsed / s.duration, 1);
      rotZ = this._wiggleRotation(t);
      this.setEyeExpression('closed');
      if (t >= 1) {
        this.setEyeExpression('normal');
        this.saveAnim = null;
      }
    }

    this.group.scale.setScalar(Math.max(scaleMult, 0.001));
    this.group.position.y = this.baseY + bob + dropOffset;
    this.group.rotation.z = rotZ;
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

    // Eyes are sprites (shared internal geometry managed by three.js) -
    // only the material needs disposing.
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
