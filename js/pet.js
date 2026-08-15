import { scene } from './app.js';
import { savePetToDB, deletePetFromDB } from './auth.js';

export const pets = [];

export function clearPetsArray() {
  pets.forEach((p) => p.destroy());
  pets.length = 0;
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

    // Unique seed generator
    this.seed = data.seed || Math.random();
    
    // Position & movement
    this.posX = (Math.random() - 0.5) * 8;
    this.posZ = (Math.random() - 0.5) * 8;
    this.targetX = this.posX;
    this.targetZ = this.posZ;
    this.speed = 0.02 + this.seed * 0.02;
    this.isDragging = false;

    this.group = new THREE.Group();

    // Procedural features based on seed
    const scaleY = 0.8 + this.seed * 0.5;
    const bodyGeo = new THREE.SphereGeometry(0.5, 32, 32);
    bodyGeo.scale(1, scaleY, 1);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      roughness: 0.3,
      metalness: 0.1
    });

    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.userData = { petInstance: this };
    this.group.add(this.bodyMesh);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.18, 0.15 * scaleY, 0.42);
    this.group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.18, 0.15 * scaleY, 0.42);
    this.group.add(rightEye);

    // Random Ears (Round vs Pointy based on seed)
    const earGeo = this.seed > 0.5 
      ? new THREE.ConeGeometry(0.15, 0.3, 16) 
      : new THREE.SphereGeometry(0.15, 16, 16);
    
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-0.3, 0.45 * scaleY, 0);
    if (this.seed > 0.5) leftEar.rotation.z = -0.3;
    this.group.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(0.3, 0.45 * scaleY, 0);
    if (this.seed > 0.5) rightEar.rotation.z = 0.3;
    this.group.add(rightEar);

    // Floating Title Tag
    this.labelSprite = this.createLabelSprite(this.title);
    this.labelSprite.position.set(0, 0.8 * scaleY + 0.6, 0);
    this.group.add(this.labelSprite);

    this.group.position.set(this.posX, 0.5 * scaleY, this.posZ);
    scene.add(this.group);

    this.mesh = this.bodyMesh;
    pets.push(this);

    this.bounceOffset = Math.random() * Math.PI * 2;
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
    this.labelSprite.material.dispose();
    this.labelSprite.material.map.dispose();

    this.labelSprite = this.createLabelSprite(this.title);
    this.labelSprite.position.set(0, 1.2, 0);
    this.group.add(this.labelSprite);
  }

  setColor(hexColor) {
    this.color = hexColor;
    this.bodyMesh.material.color.set(hexColor);
  }

  pickNewTarget() {
    if (!this.isDragging) {
      this.targetX = (Math.random() - 0.5) * 8;
      this.targetZ = (Math.random() - 0.5) * 8;
    }
    setTimeout(() => this.pickNewTarget(), 3000 + Math.random() * 4000);
  }

  update() {
    if (this.isDragging) return;

    const dx = this.targetX - this.group.position.x;
    const dz = this.targetZ - this.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      this.group.position.x += (dx / dist) * this.speed;
      this.group.position.z += (dz / dist) * this.speed;
      this.group.rotation.y = Math.atan2(dx, dz);
    }

    this.bounceOffset += 0.08;
    this.group.position.y = 0.5 + Math.abs(Math.sin(this.bounceOffset)) * 0.12;
  }

  async save() {
    await savePetToDB(this);
  }

  async delete() {
    await deletePetFromDB(this);
  }

  destroy() {
    scene.remove(this.group);
    this.bodyMesh.geometry.dispose();
    this.bodyMesh.material.dispose();
  }
}
