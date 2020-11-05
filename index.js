import * as THREE from 'three';
import {scene, renderer, camera, runtime, physics, app, appManager} from 'app';

const localVector = new THREE.Vector3();

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
    const {position} = transforms[0];
    let closestWeapon = null;
    let closestWeaponDistance = Infinity;
    for (const weapon of weapons) {
      const distance = position.distanceTo(weapon.position);
      if (distance < closestWeaponDistance) {
        closestWeapon = weapon;
        closestWeaponDistance = distance;
      }
    }
    return closestWeapon;
  };

  // const smg = mesh.getObjectByName('smg');
  window.addEventListener('keydown', e => {
    if (e.which === 70) {
      const closestWeapon = _getClosestWeapon();
      appManager.grab('right', closestWeapon);
    }
  });
  
  let shots = [];
  let explosionMeshes = [];
  const shotGeometry = new THREE.BoxBufferGeometry(0.01, 0.01, 0.01);
  const shotMaterial = new THREE.MeshBasicMaterial({color: 0xFF0000});
  const numSmokes = 10;
  const numZs = 10;
  const explosionCubeGeometry = new THREE.BoxBufferGeometry(0.04, 0.04, 0.04);
  const _makeExplosionMesh = () => {
    const numPositions = explosionCubeGeometry.attributes.position.array.length * numSmokes * numZs;
    const numIndices = explosionCubeGeometry.index.array.length * numSmokes * numZs;
    const arrayBuffer = new ArrayBuffer(
      numPositions * Float32Array.BYTES_PER_ELEMENT + // position
      numPositions / 3 * Float32Array.BYTES_PER_ELEMENT + // z
      numPositions / 3 * Float32Array.BYTES_PER_ELEMENT + // maxZ
      numPositions / 3 * 4 * Float32Array.BYTES_PER_ELEMENT + // q
      numPositions / 3 * 4 * Float32Array.BYTES_PER_ELEMENT + // phase
      numPositions / 3 * Float32Array.BYTES_PER_ELEMENT + // scale
      numIndices * Int16Array.BYTES_PER_ELEMENT, // index
    );
    let index = 0;
    const positions = new Float32Array(arrayBuffer, index, numPositions);
    index += numPositions * Float32Array.BYTES_PER_ELEMENT;
    const zs = new Float32Array(arrayBuffer, index, numPositions / 3);
    index += numPositions / 3 * Float32Array.BYTES_PER_ELEMENT;
    const maxZs = new Float32Array(arrayBuffer, index, numPositions / 3);
    index += numPositions / 3 * Float32Array.BYTES_PER_ELEMENT;
    const qs = new Float32Array(arrayBuffer, index, numPositions / 3 * 4);
    index += numPositions / 3 * 4 * Float32Array.BYTES_PER_ELEMENT;
    const phases = new Float32Array(arrayBuffer, index, numPositions / 3 * 4);
    index += numPositions / 3 * 4 * Float32Array.BYTES_PER_ELEMENT;
    const scales = new Float32Array(arrayBuffer, index, numPositions / 3);
    index += numPositions / 3 * Float32Array.BYTES_PER_ELEMENT;
    const indices = new Uint16Array(arrayBuffer, index, numIndices);
    index += numIndices * Uint16Array.BYTES_PER_ELEMENT;

    const numPositionsPerSmoke = numPositions / numSmokes;
    const numPositionsPerZ = numPositionsPerSmoke / numZs;
    const numIndicesPerSmoke = numIndices / numSmokes;
    const numIndicesPerZ = numIndicesPerSmoke / numZs;

    for (let i = 0; i < numSmokes; i++) {
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler((-1 + Math.random() * 2) * Math.PI * 2 * 0.05, (-1 + Math.random() * 2) * Math.PI * 2 * 0.05, (-1 + Math.random() * 2) * Math.PI * 2 * 0.05, 'YXZ'),
      );
      for (let j = 0; j < numPositionsPerSmoke / 3 * 4; j += 4) {
        q.toArray(qs, i * numPositionsPerSmoke / 3 * 4 + j);
      }
      const maxZ = Math.random();
      for (let j = 0; j < numZs; j++) {
        positions.set(explosionCubeGeometry.attributes.position.array, i * numPositionsPerSmoke + j * numPositionsPerZ);
        const indexOffset = i * numPositionsPerSmoke / 3 + j * numPositionsPerZ / 3;
        for (let k = 0; k < numIndicesPerZ; k++) {
          indices[i * numIndicesPerSmoke + j * numIndicesPerZ + k] = explosionCubeGeometry.index.array[k] + indexOffset;
        }

        const z = j / numZs;
        for (let k = 0; k < numPositionsPerZ / 3; k++) {
          zs[i * numPositionsPerSmoke / 3 + j * numPositionsPerZ / 3 + k] = z;
        }
        for (let k = 0; k < numPositionsPerZ / 3; k++) {
          maxZs[i * numPositionsPerSmoke / 3 + j * numPositionsPerZ / 3 + k] = maxZ;
        }
        const phase = new THREE.Vector4(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, 0.1 + Math.random() * 0.2, 0.1 + Math.random() * 0.2);
        for (let k = 0; k < numPositionsPerZ / 3 * 4; k += 4) {
          phase.toArray(phases, i * numPositionsPerSmoke / 3 * 4 + j * numPositionsPerZ / 3 * 4 + k);
        }
        const scale = 0.9 + Math.random() * 0.2;
        for (let k = 0; k < numPositionsPerZ / 3; k++) {
          scales[i * numPositionsPerSmoke / 3 * 4 + j * numPositionsPerZ / 3 * 4 + k] = scale;
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('z', new THREE.BufferAttribute(zs, 1));
    geometry.setAttribute('maxZ', new THREE.BufferAttribute(maxZs, 1));
    geometry.setAttribute('q', new THREE.BufferAttribute(qs, 4));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 4));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uAnimation: {
          type: 'f',
          value: 0,
        },
      },
      vertexShader: `\
        #define PI 3.1415926535897932384626433832795

        uniform float uAnimation;
        attribute float z;
        attribute float maxZ;
        attribute vec4 q;
        attribute vec4 phase;
        attribute float scale;
        varying float vZ;

        vec3 applyQuaternion(vec3 v, vec4 q) {
          return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
        }
        float easeBezier(float p, vec4 curve) {
          float ip = 1.0 - p;
          return (3.0 * ip * ip * p * curve.xy + 3.0 * ip * p * p * curve.zw + p * p * p).y;
        }
        float ease(float p) {
          return easeBezier(p, vec4(0., 1., 0., 1.));
        }

        void main() {
          vZ = z;
          float forwardFactor = pow(uAnimation, 0.5);
          float upFactor = uAnimation * 0.1;
          vec2 sideFactor = vec2(sin(phase.x + uAnimation*PI*2.*phase.z), sin(phase.y + uAnimation*PI*2.*phase.w));
          vec3 p = applyQuaternion(position * scale * (1.0-uAnimation) + vec3(0., 0., -z*maxZ*forwardFactor), q) +
            vec3(0., 1., 0.) * upFactor +
            vec3(uAnimation * sideFactor.x, uAnimation * sideFactor.y, 0.)*0.1;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `\
        #define PI 3.1415926535897932384626433832795

        uniform float uAnimation;
        varying float vZ;

        vec3 c = vec3(${new THREE.Color(0xff7043).toArray().join(', ')});
        vec3 s = vec3(${new THREE.Color(0x263238).toArray().join(', ')});

        void main() {
          float factor = min(vZ + pow(uAnimation, 0.5), 1.0);
          gl_FragColor = vec4(mix(c, s, factor) * (2.0 - pow(uAnimation, 0.2)), 1.0);
        }
      `,
      // transparent: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.trigger = (position, quaternion) => {
      material.uniform.uAnimation = 0;
    };
    return mesh;
  };
  window.addEventListener('mousedown', e => {
    const shotMesh = new THREE.Mesh(shotGeometry, shotMaterial);
    const currentWeapon = appManager.getGrab('right');
    shotMesh.position.copy(currentWeapon.position);
    shotMesh.quaternion.copy(currentWeapon.quaternion);
    shotMesh.frustumCulled = false;
    const startTime = Date.now();
    const endTime = startTime + 5000;
    const velocity = new THREE.Vector3(0, 0, -10);
    
    const _explode = () => {
      scene.remove(shotMesh);

      const explosionMesh = _makeExplosionMesh();
      explosionMesh.position.copy(shotMesh.position);
      explosionMesh.quaternion.copy(shotMesh.quaternion);
      scene.add(explosionMesh);
      explosionMeshes.push(explosionMesh);
    };
    shotMesh.update = (now, timeDiff) => {
      if (now < endTime) {
        localVector.copy(velocity)
          .applyQuaternion(shotMesh.quaternion)
          .multiplyScalar(timeDiff);
        
        const result = physics.raycast(shotMesh.position, shotMesh.quaternion);
        if (result) { // world geometry raycast
          result.point = new THREE.Vector3().fromArray(result.point);
          if (result.point.distanceTo(shotMesh.position) < localVector.length()) {
            _explode();
            return false;
          }
          /* raycastChunkSpec.normal = new THREE.Vector3().fromArray(raycastChunkSpec.normal);
          raycastChunkSpec.objectPosition = new THREE.Vector3().fromArray(raycastChunkSpec.objectPosition);
          raycastChunkSpec.objectQuaternion = new THREE.Quaternion().fromArray(raycastChunkSpec.objectQuaternion);
          cubeMesh.position.copy(raycastChunkSpec.point); */
        }
        
        shotMesh.position.add(localVector);
        return true;
      } else {
        _explode();
        return false;
      }
    };
    scene.add(shotMesh);
    shots.push(shotMesh);
  });
  
  let lastTimestamp = performance.now();
  renderer.setAnimationLoop((timestamp, frame) => {
    timestamp = timestamp || performance.now();
    const timeDiff = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
    lastTimestamp = timestamp;
    const now = Date.now();

    shots = shots.filter(shot => shot.update(now, timeDiff));
    explosionMeshes = explosionMeshes.filter(explosionMesh => {
      explosionMesh.material.uniforms.uAnimation.value += timeDiff;
      if (explosionMesh.material.uniforms.uAnimation.value < 1) {
        return true;
      } else {
        scene.remove(explosionMesh);
        return false;
      }
    });
  });
})();