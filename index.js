import * as THREE from 'three';
import {scene, renderer, camera, runtime, world, physics, ui, app, appManager} from 'app';

const localVector = new THREE.Vector3();
const localMatrix = new THREE.Matrix4();

(async () => {
  {
    const u = 'table.glb';
    const fileUrl = app.files['./' + u];
    const res = await fetch(fileUrl);
    const file = await res.blob();
    file.name = u;
    let mesh = await runtime.loadFile(file, {
      optimize: false,
    });
    /* mesh.traverse(o => {
      if (o.isLight) {
        o.visible = false;
      }
    }); */
    app.object.add(mesh);
  }
  
  const textMesh = ui.makeTextMesh('Toys', undefined, 0.2, 'center', 'middle');
  textMesh.color = 0xCCCCCC;
  textMesh.position.y = 2;
  app.object.add(textMesh);

  const u = 'weapons.glb';
  const fileUrl = app.files['./' + u];
  const res = await fetch(fileUrl);
  const file = await res.blob();
  file.name = u;
  let mesh = await runtime.loadFile(file, {
    optimize: false,
  });
  const width = 2;
  const weapons = mesh.children.slice();
  for (let i = 0; i < weapons.length; i++) {
    const child = weapons[i];
    child.position.set(-width/2 + i/(weapons.length-1)*width, 1, 0);
    app.object.add(child);
  }

  const _getClosestWeapon = () => {
    const transforms = physics.getRigTransforms();
    const position = transforms[0].position.clone()
      .applyMatrix4(localMatrix.getInverse(app.object.matrixWorld));
    let closestWeapon = null;
    let closestWeaponDistance = Infinity;
    for (const weapon of weapons) {
      const distance = position.distanceTo(weapon.position);
      if (distance < closestWeaponDistance) {
        closestWeapon = weapon;
        closestWeaponDistance = distance;
      }
    }
    if (closestWeaponDistance < 0.5) {
      return closestWeapon;
    } else {
      return null;
    }
  };

  let closestWeapon = null;
  window.addEventListener('click', e => {
    if (closestWeapon) {
      const u = app.files['weapons/' + closestWeapon.name + '.js'];
      const transforms = physics.getRigTransforms();
      const {position, quaternion} = transforms[0];
      world.addObject(u, app.appId, position, quaternion); // XXX
      // appManager.grab('right', closestWeapon);
    }
  });

  let lastTimestamp = performance.now();
  renderer.setAnimationLoop((timestamp, frame) => {
    timestamp = timestamp || performance.now();
    const timeDiff = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
    lastTimestamp = timestamp;
    const now = Date.now();

    closestWeapon = _getClosestWeapon();
    for (const weapon of weapons) {
      weapon.scale.setScalar(weapon === closestWeapon ? 2 : 1);
    }
  });
})();