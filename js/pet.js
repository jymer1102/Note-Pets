import { scene } from './app.js';
import { savePetToDB, deletePetFromDB } from './auth.js';

export const pets = [];

export function clearPetsArray() {
  pets.forEach((p) => scene.remove(p.mesh));
  pets.length = 0;
}

export class Pet {
  constructor(data = {}) {
    this.id = data.id || null;
    this.title = data.title || 'My Pet';
    this.note = data.note || '';
    this.color = data.color || '#ff6b81';

    this.scaleX = data.scale_x || 1;
    this.scaleY = data.scale_y || 1;
    this.scaleZ = data.scale_z || 1;

    // Position spawning
    const posX = (Math.random() - 0.5) * 8;
    const posZ = (Math.random() - 0.5) * 8;

    // Create 3D Mesh
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      roughness: 0.4,
      metalness: 0.1
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(posX, 0.5, posZ);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    scene.add(this.mesh);
    pets.push(this);

    // Animation variables
    this.bounceOffset = Math.random() * Math.PI * 2;
  }

  setColor(hexColor) {
    this.color = hexColor;
    this.mesh.material.color.set(hexColor);
  }

  update() {
    this.bounceOffset += 0.05;
    this.mesh.position.y = 0.5 + Math.sin(this.bounceOffset) * 0.1;
    this.mesh.rotation.y += 0.01;
  }

  async save() {
    await savePetToDB(this);
  }

  async delete() {
    await deletePetFromDB(this);
  }

  destroy() {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
