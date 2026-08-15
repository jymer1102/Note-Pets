import { scene } from './app.js';
import { savePetToDB, deletePetFromDB } from './auth.js';

export const pets = [];

export function clearPetsArray() {
  pets.forEach((p) => p.destroy());
  pets.length = 0;
}

// Helper to render text labels onto Canvas textures
function createTextTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 20);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'Bold 36px Arial';
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
    this.color = data.color || '#ff6b81';

    // Spawn parameters & movement vectors
    this.posX = (Math.random() - 0.5) * 8;
    this.posZ = (Math.random() - 0.5) * 8;
    this.targetX = this.posX;
    this.targetZ = this.posZ;
    this.speed = 0.03;

    // Create a composite mesh for a character shape
    this.group = new THREE.Group();

    // Body (Sphere)
    const bodyGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      roughness: 0.3,
      metalness: 0.1
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.castShadow = true;
    this.group.add(this.bodyMesh);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.18, 0.15, 0.42);
    this.group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.18, 0.15, 0.42);
    this.group.add(rightEye);

    // Floating Title Label
    this.labelSprite = this.createLabelSprite(this.title);
    this.labelSprite.position.set(0, 1.1, 0);
    this.group.add(this.labelSprite);

    this.group.position.set(this.posX, 0.5, this.posZ);
    scene.add(this.group);

    // Expose primary mesh reference for raycasting selection
    this.mesh = this.bodyMesh;

    pets.push(this);

    // Movement timer & idle animation variables
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
    this.labelSprite.position.set(0, 1.1, 0);
    this.group.add(this.labelSprite);
  }

  setColor(hexColor) {
    this.color = hexColor;
    this.bodyMesh.material.color.set(hexColor);
  }

  pickNewTarget() {
    this.targetX = (Math.random() - 0.5) * 8;
    this.targetZ = (Math.random() - 0.5) * 8;
    setTimeout(() => this.pickNewTarget(), 3000 + Math.random() * 4000);
  }

  update() {
    // Wander toward target position
    const dx = this.targetX - this.group.position.x;
    const dz = this.targetZ - this.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      this.group.position.x += (dx / dist) * this.speed;
      this.group.position.z += (dz / dist) * this.speed;
      this.group.rotation.y = Math.atan2(dx, dz);
    }

    // Walking bounce animation
    this.bounceOffset += 0.08;
    this.group.position.y = 0.5 + Math.abs(Math.sin(this.bounceOffset)) * 0.15;
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
