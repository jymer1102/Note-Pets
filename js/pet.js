import { scene } from './app.js';

export let pets = [];

const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

export class Pet {
  constructor(dbRecord = {}) {
    this.id = dbRecord.id || null;
    this.group = new THREE.Group();
    this.color = dbRecord.color || '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    this.material = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.4 });

    this.title = dbRecord.title || "";
    this.note = dbRecord.note || "";

    // Dimensions / Shape
    this.scaleX = dbRecord.scale_x || (0.7 + Math.random() * 0.5);
    this.scaleY = dbRecord.scale_y || (0.7 + Math.random() * 0.5);
    this.scaleZ = dbRecord.scale_z || (0.7 + Math.random() * 0.5);

    this.eyesGroup = new THREE.Group();
    this.happyEyesGroup = new THREE.Group();
    this.buildBody();

    this.labelSprite = null;
    this.updateLabel();

    // Spawn parameters
    this.group.position.set((Math.random() - 0.5) * 12, 12, (Math.random() - 0.5) * 12);
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.isDropping = true;
    this.isWiggling = false;
    this.wiggleTimer = 0;

    scene.add(this.group);
    pets.push(this);
  }

  buildBody() {
    const bodyGeo = new THREE.SphereGeometry(1, 32, 32);
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.material);
    this.bodyMesh.scale.set(this.scaleX, this.scaleY, this.scaleZ);
    this.bodyMesh.castShadow = true;
    this.group.add(this.bodyMesh);

    // Normal Eyes
    this.group.add(this.eyesGroup);
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), whiteMat);
    leftEye.position.set(-0.35 * this.scaleX, 0.2 * this.scaleY, 0.85 * this.scaleZ);
    this.eyesGroup.add(leftEye);

    const rightEye = leftEye.clone();
    rightEye.position.x = 0.35 * this.scaleX;
    this.eyesGroup.add(rightEye);

    // Happy Eyes
    this.group.add(this.happyEyesGroup);
    this.happyEyesGroup.visible = false;

    const happyEyeGeo = new THREE.TorusGeometry(0.12 * this.scaleX, 0.03, 8, 16, Math.PI);
    const happyEyeL = new THREE.Mesh(happyEyeGeo, blackMat);
    happyEyeL.position.set(-0.35 * this.scaleX, 0.2 * this.scaleY, 0.88 * this.scaleZ);
    happyEyeL.rotation.x = Math.PI;
    this.happyEyesGroup.add(happyEyeL);

    const happyEyeR = happyEyeL.clone();
    happyEyeR.position.x = 0.35 * this.scaleX;
    this.happyEyesGroup.add(happyEyeR);

    this.group.position.y = this.scaleY;
  }

  updateLabel() {
    if (this.labelSprite) {
      this.group.remove(this.labelSprite);
    }

    if (!this.title.trim()) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 96, 24);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'Bold 42px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.labelSprite = new THREE.Sprite(spriteMat);
    this.labelSprite.position.set(0, this.scaleY * 1.5 + 0.8, 0);
    this.labelSprite.scale.set(2.4, 0.6, 1);

    this.group.add(this.labelSprite);
  }

  triggerWiggle() {
    this.isWiggling = true;
    this.wiggleTimer = 1.2;
    this.eyesGroup.visible = false;
    this.happyEyesGroup.visible = true;
  }

  destroy() {
    scene.remove(this.group);
  }

  update(delta) {
    if (this.isDropping) {
      this.velocity.y -= 22 * delta;
      this.group.position.y += this.velocity.y * delta;

      if (this.group.position.y <= this.scaleY) {
        this.group.position.y = this.scaleY;
        this.velocity.set(0, 0, 0);
        this.isDropping = false;
        this.triggerWiggle();
      }
      return;
    }

    if (this.isWiggling) {
      this.wiggleTimer -= delta;
      this.group.rotation.z = Math.sin(this.wiggleTimer * 22) * 0.25;
      this.group.position.y = this.scaleY + Math.abs(Math.sin(this.wiggleTimer * 18)) * 0.4;

      if (this.wiggleTimer <= 0) {
        this.isWiggling = false;
        this.group.rotation.z = 0;
        this.eyesGroup.visible = true;
        this.happyEyesGroup.visible = false;
      }
    }
  }
}

export function clearPetsArray() {
  pets.forEach(p => p.destroy());
  pets.length = 0;
}
