
    import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

    const cellSize = 10;
    const roomCells = 11;
    const roomSize = roomCells * cellSize;
    const roomHeight = 3 * cellSize;
    const half = roomSize / 2;
    const worldHalf = roomSize + half;
    const playerSize = 1;
    const playerHalf = playerSize / 2;
    const floorY = playerHalf;
    const ceilingY = roomHeight - playerHalf;
    const moveSpeed = 10.5;
    const dashDistance = moveSpeed;
    const dashCooldown = 0.2;
    const flyAccel = 20;
    const gravity = 25;
    const jumpHeight = 0.5;
    const baseJumpSpeed = Math.sqrt(2 * gravity * jumpHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0e10);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1000);
    camera.position.set(0, playerSize, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(5, 10, 2);
    scene.add(ambient, dir);

    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55
    });

    function createMaterial(color) {
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
    }

    function mulberry32(seed) {
      return function () {
        let t = seed += 0x6d2b79f5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function buildMaze(size, openings, seed) {
      const grid = Array.from({ length: size }, () => Array(size).fill(1));
      const rand = mulberry32(seed);
      const dirs = [
        { x: 0, z: -1 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: -1, z: 0 }
      ];

      function shuffle(array) {
        for (let i = array.length - 1; i > 0; i -= 1) {
          const j = Math.floor(rand() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
      }

      function carve(x, z) {
        grid[z][x] = 0;
        const order = dirs.slice();
        shuffle(order);
        for (const dir of order) {
          const nx = x + dir.x * 2;
          const nz = z + dir.z * 2;
          if (nx > 0 && nx < size - 1 && nz > 0 && nz < size - 1 && grid[nz][nx] === 1) {
            grid[z + dir.z][x + dir.x] = 0;
            carve(nx, nz);
          }
        }
      }

      const center = Math.floor(size / 2);
      carve(center, center);

      function openCorridor(x, z, dx, dz) {
        while (x >= 0 && x < size && z >= 0 && z < size) {
          grid[z][x] = 0;
          if (x === center && z === center) break;
          x += dx;
          z += dz;
        }
      }

      if (openings.n) openCorridor(center, 0, 0, 1);
      if (openings.s) openCorridor(center, size - 1, 0, -1);
      if (openings.w) openCorridor(0, center, 1, 0);
      if (openings.e) openCorridor(size - 1, center, -1, 0);

      grid[center][center] = 0;
      return grid;
    }

    function createGridLines(width, height, divisionsW, divisionsH) {
      const vertices = [];
      const stepW = width / divisionsW;
      const stepH = height / divisionsH;
      const halfW = width / 2;
      const halfH = height / 2;

      for (let i = 0; i <= divisionsW; i += 1) {
        const x = -halfW + stepW * i;
        vertices.push(x, -halfH, 0, x, halfH, 0);
      }
      for (let j = 0; j <= divisionsH; j += 1) {
        const y = -halfH + stepH * j;
        vertices.push(-halfW, y, 0, halfW, y, 0);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      return new THREE.LineSegments(geometry, gridMaterial);
    }

    function createRoom(center, openings, color, blockBoxes) {
      const roomMat = createMaterial(color);
      const group = new THREE.Group();
      const yCenter = roomHeight / 2;

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), roomMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(center.x, 0, center.z);
      group.add(floor);

      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), roomMat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.set(center.x, roomHeight, center.z);
      group.add(ceiling);

      const floorGrid = createGridLines(roomSize, roomSize, roomSize, roomSize);
      floorGrid.rotation.x = -Math.PI / 2;
      floorGrid.position.set(center.x, 0.1, center.z);
      group.add(floorGrid);

      const ceilingGrid = createGridLines(roomSize, roomSize, roomSize, roomSize);
      ceilingGrid.rotation.x = Math.PI / 2;
      ceilingGrid.position.set(center.x, roomHeight - 0.1, center.z);
      group.add(ceilingGrid);

      if (!openings.n) {
        const north = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), roomMat);
        north.position.set(center.x, yCenter, center.z - half);
        group.add(north);

        const northGrid = createGridLines(roomSize, roomHeight, roomSize, roomHeight);
        northGrid.position.set(center.x, yCenter, center.z - half + 0.1);
        group.add(northGrid);
      }

      if (!openings.s) {
        const south = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), roomMat);
        south.rotation.y = Math.PI;
        south.position.set(center.x, yCenter, center.z + half);
        group.add(south);

        const southGrid = createGridLines(roomSize, roomHeight, roomSize, roomHeight);
        southGrid.rotation.y = Math.PI;
        southGrid.position.set(center.x, yCenter, center.z + half - 0.1);
        group.add(southGrid);
      }

      if (!openings.w) {
        const west = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), roomMat);
        west.rotation.y = Math.PI / 2;
        west.position.set(center.x - half, yCenter, center.z);
        group.add(west);

        const westGrid = createGridLines(roomSize, roomHeight, roomSize, roomHeight);
        westGrid.rotation.y = Math.PI / 2;
        westGrid.position.set(center.x - half + 0.1, yCenter, center.z);
        group.add(westGrid);
      }

      if (!openings.e) {
        const east = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), roomMat);
        east.rotation.y = -Math.PI / 2;
        east.position.set(center.x + half, yCenter, center.z);
        group.add(east);

        const eastGrid = createGridLines(roomSize, roomHeight, roomSize, roomHeight);
        eastGrid.rotation.y = -Math.PI / 2;
        eastGrid.position.set(center.x + half - 0.1, yCenter, center.z);
        group.add(eastGrid);
      }

      const blockMat = createMaterial(color);
      for (const box of blockBoxes) {
        const width = box.maxX - box.minX;
        const height = box.maxY - box.minY;
        const depth = box.maxZ - box.minZ;
        const blockGeo = new THREE.BoxGeometry(width, height, depth);
        const block = new THREE.Mesh(blockGeo, blockMat);
        block.position.set(
          (box.minX + box.maxX) / 2,
          (box.minY + box.maxY) / 2,
          (box.minZ + box.maxZ) / 2
        );
        group.add(block);
      }

      scene.add(group);
    }

    const offset = roomSize;
    const rooms = [
      { x: 0, z: 0, openings: { n: true, s: true, w: true, e: true } },
      { x: 0, z: -offset, openings: { n: false, s: true, w: false, e: false } },
      { x: offset, z: 0, openings: { n: false, s: false, w: true, e: false } },
      { x: 0, z: offset, openings: { n: true, s: false, w: false, e: false } },
      { x: -offset, z: 0, openings: { n: false, s: false, w: false, e: true } }
    ];

    const roomColors = [0xffffff, 0xff4b4b, 0xffd93d, 0x43d66d, 0x3aa0ff];
    const roomSeeds = [101, 202, 303, 404, 505];

    // Maze blocks removed per request.

      rooms.forEach((room, index) => {
        const baseSeed = roomSeeds[index];
        room.mazeLayers = [];
        room.blockBoxes = [];
        createRoom(
          new THREE.Vector3(room.x, 0, room.z),
          room.openings,
          roomColors[index],
          room.blockBoxes
        );
      });

      const enemyRadius = playerSize * 0.5;
      const enemyTypes = [
        { roomIndex: 1, color: 0xff4b4b },
        { roomIndex: 2, color: 0xffd93d },
        { roomIndex: 3, color: 0x43d66d },
        { roomIndex: 4, color: 0x3aa0ff }
      ];
      const enemies = [];
      const enemyProjectiles = [];
      const enemyBeams = [];
      const explosionFields = [];
      const floatingTexts = [];
      const enemySpawnTimers = new Map();
      const enemyMoveSpeed = 3;
      const enemyAvoidRadius = 2;

      function getRoomBounds(roomIndex) {
        const room = rooms[roomIndex];
        const margin = enemyRadius + 0.4;
        return {
          minX: room.x - half + margin,
          maxX: room.x + half - margin,
          minZ: room.z - half + margin,
          maxZ: room.z + half - margin
        };
      }

      function randomPointInRoom(roomIndex) {
        const bounds = getRoomBounds(roomIndex);
        return new THREE.Vector3(
          bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
          floorY + enemyRadius,
          bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
        );
      }

      function getRoomIndexForPos(pos) {
        for (let i = 0; i < rooms.length; i += 1) {
          const room = rooms[i];
          const minX = room.x - half + (room.openings.w ? -playerHalf : playerHalf);
          const maxX = room.x + half + (room.openings.e ? playerHalf : -playerHalf);
          const minZ = room.z - half + (room.openings.n ? -playerHalf : playerHalf);
          const maxZ = room.z + half + (room.openings.s ? playerHalf : -playerHalf);
          if (pos.x >= minX && pos.x <= maxX && pos.z >= minZ && pos.z <= maxZ) {
            return i;
          }
        }
        return -1;
      }

      function spawnEnemy(type) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(enemyRadius, 16, 16),
          new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.6, metalness: 0.1 })
        );
        mesh.position.copy(randomPointInRoom(type.roomIndex));
        scene.add(mesh);
        const label = document.createElement("div");
        label.className = "enemyLabel";
        label.textContent = "AP 5000 / PA 1000";
        document.body.appendChild(label);
        const now = performance.now() / 1000;
        const nextBeam = now + 50 + Math.random() * 5;
        enemies.push({
          mesh,
          label,
          roomIndex: type.roomIndex,
          baseColor: new THREE.Color(type.color),
          nextBall: now + 5 + Math.random() * 2,
          nextBeam,
          chargeStart: nextBeam - 10,
          ap: 5000,
          pa: 1000,
          moveTarget: randomPointInRoom(type.roomIndex),
          nextMoveUpdate: now + 0.3 + Math.random() * 0.4,
          spawnTime: now
        });
      }

      enemyTypes.forEach((type) => {
        const initialCount = 10 + Math.floor(Math.random() * 21);
        for (let i = 0; i < initialCount; i += 1) {
          spawnEnemy(type);
        }
        enemySpawnTimers.set(type.roomIndex, performance.now() / 1000 + 10 + Math.random() * 10);
      });

    const player = {
      position: new THREE.Vector3(0, floorY, 0),
      velocity: new THREE.Vector3(),
      grounded: true
    };

    const dummy = new THREE.Group();
    const dummyMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8, metalness: 0.0 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), dummyMat);
    head.position.set(0, 1.6, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), dummyMat);
    torso.position.set(0, 1.1, 0);
    const armL = new THREE.Group();
    const armR = new THREE.Group();
    const armUpperL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), dummyMat);
    const armUpperR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), dummyMat);
    armUpperL.position.set(0, -0.2, 0);
    armUpperR.position.set(0, -0.2, 0);
    const forearmL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.18), dummyMat);
    const forearmR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.18), dummyMat);
    forearmL.position.set(0, -0.45, 0.05);
    forearmR.position.set(0, -0.45, 0.05);
    forearmL.rotation.x = Math.PI / 4;
    forearmR.rotation.x = Math.PI / 4;
    armL.add(armUpperL, forearmL);
    armR.add(armUpperR, forearmR);
    armL.position.set(-0.45, 1.3, 0);
    armR.position.set(0.45, 1.3, 0);
    armL.rotation.x = Math.PI / 4;
    armR.rotation.x = Math.PI / 4;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), dummyMat);
    legL.position.set(-0.15, 0.45, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), dummyMat);
    legR.position.set(0.15, 0.45, 0);
    dummy.add(head, torso, armL, armR, legL, legR);
    dummy.scale.set(0.7, 0.7, 0.7);
    scene.add(dummy);

    function buildGun(color) {
      const gunGroup = new THREE.Group();
      const gunMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 });
      const gunMain = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.22), gunMat);
      gunMain.position.set(0.45, 0, 0);
      gunGroup.add(gunMain);
      return gunGroup;
    }

    const gunRight = buildGun(0x111111);
    gunRight.position.set(0, -0.14, -0.12);
    gunRight.rotation.set(0, Math.PI / 2, -Math.PI / 2);
    forearmR.add(gunRight);

    const gunLeft = buildGun(0xf2f2f2);
    gunLeft.position.set(0, -0.14, -0.12);
    gunLeft.rotation.set(0, Math.PI / 2, -Math.PI / 2);
    forearmL.add(gunLeft);

    let yaw = 0;
    let pitch = 0;
    const keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
    const hint = document.getElementById("hint");
    const staminaFill = document.getElementById("staminaFill");
    const menuOverlay = document.getElementById("menuOverlay");
    const ammoLeft = document.getElementById("ammoLeft");
      const ammoRight = document.getElementById("ammoRight");
      const apPanel = document.getElementById("apPanel");
      const apFill = document.getElementById("apFill");
      const paPanel = document.getElementById("paPanel");
      const paFill = document.getElementById("paFill");
      const enFill = document.getElementById("enFill");
      const energyWarning = document.getElementById("energyWarning");
      const apWarning = document.getElementById("apWarning");
      const septiaCountEl = document.getElementById("septiaCount");
      const septiaGaugeEl = document.getElementById("septiaGauge");
      const expansionCooldownEl = document.getElementById("expansionCooldown");
      const expansionOverlay = document.getElementById("expansionOverlay");
      const kitCountEl = document.getElementById("kitCount");
      const kitCooldownEl = document.getElementById("kitCooldown");
    const repairOverlay = document.getElementById("repairOverlay");
    const damageShield = document.getElementById("damageShield");
    const menuClose = document.getElementById("menuClose");
    const menuTabs = Array.from(document.querySelectorAll(".menuTab"));
    const menuSections = Array.from(document.querySelectorAll(".menuSection"));
    const assemblyItems = Array.from(document.querySelectorAll(".assemblyItem"));
    const assemblyDetail = document.getElementById("assemblyDetail");
    const assemblyDetailTitle = document.getElementById("assemblyDetailTitle");
    const assemblyDetailClose = document.getElementById("assemblyDetailClose");
    const assemblyDetailCurrent = document.getElementById("assemblyDetailCurrent");
    const assemblyDetailInventory = document.getElementById("assemblyDetailInventory");
    const assemblyDetailStatus = document.getElementById("assemblyDetailStatus");
    const assemblyUnequip = document.getElementById("assemblyUnequip");
    const codexGridWrap = document.getElementById("codexGridWrap");
    const itemGridWrap = document.getElementById("itemGridWrap");
    const shopGridWrap = document.getElementById("shopGridWrap");
    const codexDetailName = document.getElementById("codexDetailName");
    const itemDetailName = document.getElementById("itemDetailName");
    const shopDetailName = document.getElementById("shopDetailName");
    const codexDetailDesc = document.getElementById("codexDetailDesc");
    const itemDetailDesc = document.getElementById("itemDetailDesc");
    const shopDetailDesc = document.getElementById("shopDetailDesc");
    const codexGrid = document.getElementById("codexGrid");
    const itemGrid = document.getElementById("itemGrid");
    const shopGrid = document.getElementById("shopGrid");
    const previewCanvas = document.getElementById("assemblyPreviewCanvas");
      let stamina = 100;
      let en = 100;
      let staminaCooldown = false;
      let staminaCooldownEnd = 0;
      let energyLock = false;
      let frameNow = 0;
    let cameraRoll = 0;
    let dashTiltPulse = 0;
    let paused = false;
    let previewRotX = 0;
    let previewRotY = 0;
    let armRaiseL = false;
    let armRaiseR = false;
    let firingLeft = false;
    let firingRight = false;
    let fireCooldown = 0;
      const magMax = 1000;
    let magLeft = magMax;
    let magRight = magMax;
    let reserveLeft = Infinity;
    let reserveRight = Infinity;
    let reloadingLeft = false;
    let reloadingRight = false;
      let reloadEndLeft = 0;
      let reloadEndRight = 0;
      const reloadTime = 0.1;
      const apMax = 99999;
      let ap = apMax;
      const paMax = 9999;
      let pa = paMax;
      let paCooldown = false;
      let paCooldownEnd = 0;
      let paInvulnUntil = 0;
      let expansionHolding = false;
      let expansionHoldStart = null;
      let expansionCooldownEnd = 0;
      let expansionActiveUntil = 0;
      let expansionNextHeal = 0;
      let expansionShockDone = false;
      let apCriticalUntil = 0;
      let septiaFiring = false;
      let septiaFireCooldown = 0;
    let kitCount = Infinity;
    let kitHoldStart = null;
    let kitHolding = false;
      let repairCooldownEnd = 0;
      let repairHealStart = 0;
      let repairHealEnd = 0;
      let repairHealAmount = 0;
      let repairHealApplied = 0;
      let repairOverlayUntil = 0;
      let repairActiveStart = 0;
      let repairActiveUntil = 0;
      let damageScale = 1;
    const bullets = [];
    const dashCooldownEnd = { w: 0, a: 0, s: 0, d: 0 };

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function clampCameraPosition(pos) {
      const roomsHere = getRoomsForPos(pos);
      const epsilon = 0.2;
      if (roomsHere.length === 0) return pos;

      let best = null;
      let bestDist = Infinity;
      for (const room of roomsHere) {
        const minX = room.x - half + (room.openings.w ? -playerHalf : playerHalf) + epsilon;
        const maxX = room.x + half + (room.openings.e ? playerHalf : -playerHalf) - epsilon;
        const minZ = room.z - half + (room.openings.n ? -playerHalf : playerHalf) + epsilon;
        const maxZ = room.z + half + (room.openings.s ? playerHalf : -playerHalf) - epsilon;
        const clamped = new THREE.Vector3(
          clamp(pos.x, minX, maxX),
          clamp(pos.y, floorY + epsilon, ceilingY - epsilon),
          clamp(pos.z, minZ, maxZ)
        );
        const dist = clamped.distanceToSquared(pos);
        if (dist < bestDist) {
          bestDist = dist;
          best = clamped;
        }
      }
      return best ?? pos;
    }

    function updateCamera() {
      if (paused) return;
      const eyeHeight = playerSize * 0.8;
      dummy.position.set(player.position.x, player.position.y - playerHalf, player.position.z);
      dummy.rotation.y = yaw;
      dummy.rotation.z = cameraRoll;
      dashTiltPulse += (0 - dashTiltPulse) * Math.min(1, 6 * (1 / 60));
      const tiltStrength = 0.12;
      const strafe = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
      const targetRoll = -tiltStrength * strafe;
      const rollSpeed = 3;
      cameraRoll += (targetRoll - cameraRoll) * Math.min(1, rollSpeed * (1 / 60));
      const roll = cameraRoll + dashTiltPulse;
      const armBase = 0;
      const armTargetL = armRaiseL ? (Math.PI / 4 + pitch) : armBase;
      const armTargetR = armRaiseR ? (Math.PI / 4 + pitch) : armBase;
      const armSpeed = 8;
      armL.rotation.x += (armTargetL - armL.rotation.x) * Math.min(1, armSpeed * (1 / 60));
      armR.rotation.x += (armTargetR - armR.rotation.x) * Math.min(1, armSpeed * (1 / 60));
      const forearmRest = Math.PI / 4;
      forearmL.rotation.x = reloadingLeft ? 0 : forearmRest;
      forearmR.rotation.x = reloadingRight ? 0 : forearmRest;

      if (keys.shift) {
        const distance = 0.3 * cellSize;
        const height = 0.12 * cellSize;
        camera.fov = 60;
        camera.updateProjectionMatrix();
        const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const desired = new THREE.Vector3(
          player.position.x,
          player.position.y + height,
          player.position.z
        ).addScaledVector(back, -distance);
        const clamped = clampCameraPosition(desired);
        camera.position.copy(clamped);
        camera.rotation.set(pitch, yaw, roll, "YXZ");
      } else {
        camera.fov = 75;
        camera.updateProjectionMatrix();
        const desired = new THREE.Vector3(
          player.position.x,
          player.position.y + (eyeHeight - playerHalf),
          player.position.z
        );
        const clamped = clampCameraPosition(desired);
        camera.position.copy(clamped);
        camera.rotation.set(pitch, yaw, roll, "YXZ");
      }
    }

    function isInsideAnyRoom(pos) {
      for (const room of rooms) {
        const minX = room.x - half + (room.openings.w ? -playerHalf : playerHalf);
        const maxX = room.x + half + (room.openings.e ? playerHalf : -playerHalf);
        const minZ = room.z - half + (room.openings.n ? -playerHalf : playerHalf);
        const maxZ = room.z + half + (room.openings.s ? playerHalf : -playerHalf);
        if (pos.x >= minX && pos.x <= maxX && pos.z >= minZ && pos.z <= maxZ) {
          return true;
        }
      }
      return false;
    }

    function getRoomsForPos(pos) {
      const result = [];
      for (const room of rooms) {
        const minX = room.x - half + (room.openings.w ? -playerHalf : playerHalf);
        const maxX = room.x + half + (room.openings.e ? playerHalf : -playerHalf);
        const minZ = room.z - half + (room.openings.n ? -playerHalf : playerHalf);
        const maxZ = room.z + half + (room.openings.s ? playerHalf : -playerHalf);
        if (pos.x >= minX && pos.x <= maxX && pos.z >= minZ && pos.z <= maxZ) {
          result.push(room);
        }
      }
      return result;
    }

    function collidesWithBlocks(pos) {
      const roomsHere = getRoomsForPos(pos);
      if (roomsHere.length === 0) return true;

      const epsilon = 0.0001;
      const minX = pos.x - playerHalf + epsilon;
      const maxX = pos.x + playerHalf - epsilon;
      const minZ = pos.z - playerHalf + epsilon;
      const maxZ = pos.z + playerHalf - epsilon;
      const minY = pos.y - playerHalf + epsilon;
      const maxY = pos.y + playerHalf - epsilon;

      for (const room of roomsHere) {
        for (const box of room.blockBoxes) {
          const overlapX = maxX >= box.minX && minX <= box.maxX;
          const overlapY = maxY >= box.minY && minY <= box.maxY;
          const overlapZ = maxZ >= box.minZ && minZ <= box.maxZ;
          if (overlapX && overlapY && overlapZ) {
            return true;
          }
        }
      }
      return false;
    }

    function resolveVertical(nextY) {
      if (nextY > ceilingY) {
        player.position.y = ceilingY;
        player.velocity.y = 0;
        return;
      }
      if (nextY < floorY) {
        player.position.y = floorY;
        player.velocity.y = 0;
        player.grounded = true;
        return;
      }

      const testPos = new THREE.Vector3(player.position.x, nextY, player.position.z);
      if (!collidesWithBlocks(testPos)) {
        player.position.y = nextY;
        return;
      }

      if (player.velocity.y <= 0) {
        const roomsHere = getRoomsForPos(player.position);
        let highestTop = floorY;
        for (const room of roomsHere) {
          for (const box of room.blockBoxes) {
            const overlapX = (player.position.x + playerHalf) >= box.minX &&
              (player.position.x - playerHalf) <= box.maxX;
            const overlapZ = (player.position.z + playerHalf) >= box.minZ &&
              (player.position.z - playerHalf) <= box.maxZ;
            if (!overlapX || !overlapZ) continue;
            const topY = box.maxY + playerHalf;
            if (topY > highestTop) highestTop = topY;
          }
        }
        player.position.y = highestTop;
        player.velocity.y = 0;
        player.grounded = true;
      } else {
        player.velocity.y = 0;
      }
    }

      function applyMovement(delta) {
        if (paused) return;
        const now = frameNow || performance.now() / 1000;
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const forwardFly = new THREE.Vector3(
          -Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          -Math.cos(yaw) * Math.cos(pitch)
        ).normalize();
      const right = new THREE.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2));
      const direction = new THREE.Vector3();
        const dashingInput = keys.shift && keys.space;
        const expansionActive = now < expansionActiveUntil;
        const energyAvailable = expansionActive ? true : (staminaCooldown ? en > 0 : stamina > 0);
        const flyingInput = keys.shift && keys.w && !dashingInput && energyAvailable;

      if (keys.w) direction.add(forward);
      if (keys.s) direction.sub(forward);
      if (keys.d) direction.add(right);
      if (keys.a) direction.sub(right);

        if (direction.lengthSq() > 0) {
          const sprinting = keys.shift && energyAvailable && !energyLock;
          const expansionBoost = expansionActive ? 2 : 1;
          const criticalSlow = now < apCriticalUntil ? 0.5 : 1;
          const speed = moveSpeed * (sprinting ? 1.5 : 1) * expansionBoost * (energyLock ? 0.5 : 1) * criticalSlow;
          direction.normalize().multiplyScalar(speed);
          player.velocity.x = direction.x;
          player.velocity.z = direction.z;
        } else {
          player.velocity.x = 0;
          player.velocity.z = 0;
        }

      if (flyingInput) {
        player.velocity.addScaledVector(forwardFly, flyAccel * delta);
        player.grounded = false;
      }

      const jumpCost = 4;
      const jumpSpeed = baseJumpSpeed;

        if (!flyingInput && !energyLock && keys.space && !dashingInput && energyAvailable && player.position.y < ceilingY) {
          const cost = jumpCost * delta * 10;
          consumeEnergy(cost, now);
          if (!staminaCooldown || en > 0) {
            player.velocity.y = Math.max(player.velocity.y, jumpSpeed);
          }
        } else if (!flyingInput) {
          player.velocity.y -= gravity * delta;
        }

        if (keys.shift && !player.grounded && !keys.w) {
          if (energyAvailable) {
            player.velocity.y = Math.max(0, player.velocity.y);
          }
        }

      const next = player.position.clone().addScaledVector(player.velocity, delta);

      const tryX = new THREE.Vector3(next.x, player.position.y, player.position.z);
      if (isInsideAnyRoom(tryX) && !collidesWithBlocks(tryX)) {
        player.position.x = tryX.x;
      }

      const tryZ = new THREE.Vector3(player.position.x, player.position.y, next.z);
      if (isInsideAnyRoom(tryZ) && !collidesWithBlocks(tryZ)) {
        player.position.z = tryZ.z;
      }

      resolveVertical(next.y);

      player.position.x = clamp(player.position.x, -worldHalf + playerHalf, worldHalf - playerHalf);
      player.position.z = clamp(player.position.z, -worldHalf + playerHalf, worldHalf - playerHalf);

      if (player.position.y <= floorY) {
        player.position.y = floorY;
        player.velocity.y = 0;
        player.grounded = true;
      } else if (player.position.y >= ceilingY) {
        player.position.y = ceilingY;
        player.velocity.y = Math.min(0, player.velocity.y);
      }
    }

      function startJump() {
        if (!player.grounded) return;
        const energyAvailable = frameNow < expansionActiveUntil ? true : (staminaCooldown ? en > 0 : stamina > 0);
        if (!energyAvailable || energyLock) return;
        player.velocity.y = 0;
        player.grounded = false;
      }

      function consumeEnergy(amount, now) {
        if (amount <= 0) return;
        if (now < expansionActiveUntil) return;
        if (staminaCooldown) {
          en = Math.max(0, en - amount);
          return;
        }
        stamina = Math.max(0, stamina - amount);
        if (stamina <= 0) {
          stamina = 0;
          staminaCooldown = true;
          staminaCooldownEnd = now + 10;
        }
      }

      function applyDamage(amount) {
        if (amount <= 0) return;
        let dmg = amount * damageScale;
        if (dmg <= 0) return;
        const now = performance.now() / 1000;
        if (now < expansionActiveUntil) {
          return;
        }
        if (now < paInvulnUntil) {
          return;
        }
        if (!paCooldown && pa > 0) {
          const used = Math.min(pa, dmg);
          pa -= used;
          dmg -= used;
          if (pa <= 0) {
            pa = 0;
            paCooldown = true;
            paCooldownEnd = now + 50;
          }
        }
        if (dmg > 0) {
          ap = Math.max(1, ap - dmg);
        }
        if (ap <= 1) {
          ap = 1;
          player.position.set(0, floorY, 0);
          player.velocity.set(0, 0, 0);
          apCriticalUntil = now + 10;
        }
      }

      function applyEnemyDamage(enemy, amount) {
        let dmg = amount;
        if (enemy.pa > 0) {
          const usePa = Math.min(enemy.pa, dmg);
          enemy.pa -= usePa;
          dmg -= usePa;
          if (usePa > 0) spawnFloatingText(enemy.mesh.position, `-PA ${Math.ceil(usePa)}`, "#7ad7ff");
        }
        if (dmg > 0) {
          enemy.ap = Math.max(0, enemy.ap - dmg);
          spawnFloatingText(enemy.mesh.position, `-AP ${Math.ceil(dmg)}`, "#ff8a8a");
        }
        if (enemy.ap <= 0) {
          scene.remove(enemy.mesh);
          if (enemy.label) enemy.label.remove();
          const idx = enemies.indexOf(enemy);
          if (idx >= 0) enemies.splice(idx, 1);
        }
      }

      function createExplosionField(center, radius, dps, color) {
        const fxGeo = new THREE.SphereGeometry(0.6, 16, 16);
        const fxMat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.9 });
        const fx = new THREE.Mesh(fxGeo, fxMat);
        fx.position.copy(center);
        fx.userData.life = 3;
        fx.userData.startLife = 3;
        fx.userData.radius = radius;
        fx.userData.dps = dps;
        explosionFields.push(fx);
        scene.add(fx);
      }

      function spawnFloatingText(pos, text, color) {
        const el = document.createElement("div");
        el.className = "floatText";
        el.style.color = color;
        el.textContent = text;
        document.body.appendChild(el);
        floatingTexts.push({
          el,
          pos: pos.clone(),
          life: 0.8,
          startLife: 0.8,
          velocity: new THREE.Vector3(0, 0.8, 0)
        });
      }

      function findSeptiaTarget(pos, range) {
        let best = null;
        let bestDist = range * range;
        let bestAp = Infinity;
        let bestSpawn = Infinity;
        for (const enemy of enemies) {
          const d2 = enemy.mesh.position.distanceToSquared(pos);
          if (d2 > bestDist) continue;
          const ap = enemy.ap;
          const spawn = enemy.spawnTime || 0;
          if (!best || ap < bestAp || (ap === bestAp && spawn < bestSpawn)) {
            best = enemy;
            bestAp = ap;
            bestSpawn = spawn;
            bestDist = d2;
          }
        }
        return best;
      }

    function setActiveTab(name) {
      menuTabs.forEach((tab) => {
        const active = tab.dataset.tab === name;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      menuSections.forEach((section) => {
        section.classList.toggle("active", section.id === `tab-${name}`);
      });
      if (name === "assembly") {
        previewRotX = 0;
        previewRotY = 0;
      }
    }

    function toggleMenu() {
      paused = !paused;
      menuOverlay.classList.toggle("active", paused);
      menuOverlay.setAttribute("aria-hidden", paused ? "false" : "true");
      if (paused) {
        setActiveTab("controls");
      }
      if (paused) {
        if (document.pointerLockElement === document.body) {
          document.exitPointerLock();
        }
      }
    }

      document.addEventListener("keydown", (event) => {
        if (event.code === "KeyE") {
          toggleMenu();
          return;
        }
        if (event.code === "KeyQ") {
          if (!expansionHolding) {
            expansionHolding = true;
            expansionHoldStart = performance.now();
          }
        }
        if (event.code === "Digit2") {
          septiaFiring = true;
        }
        if (event.code === "Digit1") {
          if (!kitHolding) {
            kitHolding = true;
            kitHoldStart = performance.now();
          }
      }
      if (event.code === "KeyW") keys.w = true;
      if (event.code === "KeyA") keys.a = true;
      if (event.code === "KeyS") keys.s = true;
      if (event.code === "KeyD") keys.d = true;
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") keys.shift = true;
      if (event.code === "Space") {
        keys.space = true;
        startJump();
      }
      const dashKeyMap = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d" };
      const dashKey = dashKeyMap[event.code];
      if (
        dashKey &&
        keys.shift && keys.space &&
        ((staminaCooldown && en >= 8) || (!staminaCooldown && stamina >= 8)) &&
        !energyLock &&
        performance.now() / 1000 >= dashCooldownEnd[dashKey]
      ) {
        const dashForward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const dashRight = new THREE.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2));
        const dashDir = new THREE.Vector3();
        if (keys.w) dashDir.add(dashForward);
        if (keys.s) dashDir.sub(dashForward);
        if (keys.d) dashDir.add(dashRight);
        if (keys.a) dashDir.sub(dashRight);
        if (dashDir.lengthSq() > 0) {
          dashDir.normalize();
          const expansionBoost = performance.now() / 1000 < expansionActiveUntil ? 3 : 1;
          const step = dashDir.clone().multiplyScalar(dashDistance * expansionBoost);
          const dashTryX = new THREE.Vector3(player.position.x + step.x, player.position.y, player.position.z);
          if (isInsideAnyRoom(dashTryX) && !collidesWithBlocks(dashTryX)) {
            player.position.x = dashTryX.x;
          }
          const dashTryZ = new THREE.Vector3(player.position.x, player.position.y, player.position.z + step.z);
          if (isInsideAnyRoom(dashTryZ) && !collidesWithBlocks(dashTryZ)) {
            player.position.z = dashTryZ.z;
          }
          if (dashKey === "a") dashTiltPulse = 0.2;
          if (dashKey === "d") dashTiltPulse = -0.2;
          consumeEnergy(8, performance.now() / 1000);
          dashCooldownEnd[dashKey] = performance.now() / 1000 + dashCooldown;
        }
      }
    });

      document.addEventListener("keyup", (event) => {
        if (event.code === "KeyE") return;
        if (event.code === "KeyQ") {
          expansionHolding = false;
          expansionHoldStart = null;
        }
        if (event.code === "Digit2") {
          septiaFiring = false;
        }
        if (event.code === "Digit1") {
          kitHolding = false;
          kitHoldStart = null;
        }
      if (event.code === "KeyW") keys.w = false;
      if (event.code === "KeyA") keys.a = false;
      if (event.code === "KeyS") keys.s = false;
      if (event.code === "KeyD") keys.d = false;
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") keys.shift = false;
      if (event.code === "Space") keys.space = false;
    });

    document.addEventListener("mousedown", (event) => {
      if (event.button === 0) armRaiseL = true;
      if (event.button === 2) armRaiseR = true;
    });

    document.addEventListener("mouseup", (event) => {
      if (event.button === 0) armRaiseL = false;
      if (event.button === 2) armRaiseR = false;
    });

    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    document.addEventListener("mousedown", (event) => {
      if (event.button === 0) firingLeft = true;
      if (event.button === 2) firingRight = true;
    });
    document.addEventListener("mouseup", (event) => {
      if (event.button === 0) firingLeft = false;
      if (event.button === 2) firingRight = false;
    });

    function onMouseMove(event) {
      const sensitivity = 0.002;
      yaw -= event.movementX * sensitivity;
      pitch -= event.movementY * sensitivity;
      pitch = clamp(pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    }

    document.body.addEventListener("click", () => {
      if (paused) return;
      if (document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
      }
    });

    menuClose.addEventListener("click", () => {
      if (paused) toggleMenu();
    });

    menuTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        setActiveTab(tab.dataset.tab);
      });
    });

    const equipped = {};

    assemblyItems.forEach((item) => {
      const labelEl = item.querySelector(".assemblyLabel");
      const slotName = item.dataset.slot || labelEl.textContent.trim();
      item.dataset.slot = slotName;
      item.dataset.defaultName = slotName;
      const currentName = labelEl.textContent.trim();
      if (currentName !== slotName) {
        equipped[slotName] = currentName;
      }
    });

    function isHandSlot(slotName) {
      return slotName.includes("우측 손") || slotName.includes("좌측 손");
    }

    function renderAssemblyDetail(slotName) {
      assemblyDetailTitle.textContent = slotName;
      assemblyDetail.classList.add("active");
      assemblyDetailCurrent.innerHTML = "";
      assemblyDetailInventory.innerHTML = "";

      const current = document.createElement("div");
      current.className = "detailIcon";
      current.title = "현재 착용";
      assemblyDetailCurrent.appendChild(current);

      const inventory = document.createElement("div");
      inventory.className = "detailIcon";
      inventory.title = "테스트용 머신핸드건";
      inventory.innerHTML = "<div class=\"assemblyLabel\">테스트용 머신핸드건</div>";
      assemblyDetailInventory.appendChild(inventory);

      const equippedName = equipped[slotName];
      if (!equippedName) {
        current.style.opacity = "0.2";
      }

      if (isHandSlot(slotName)) {
        inventory.addEventListener("click", () => {
          equipped[slotName] = "테스트용 머신핸드건";
          current.style.opacity = "1";
          const slotItem = assemblyItems.find((i) => i.dataset.slot === slotName);
          if (slotItem) {
            const icon = slotItem.querySelector(".assemblyIcon");
            const label = slotItem.querySelector(".assemblyLabel");
            icon.classList.add("machinehandgun");
            label.textContent = "테스트용 머신핸드건";
          }
        });
      }
    }

    assemblyItems.forEach((item) => {
      item.addEventListener("click", () => {
        const name = item.dataset.assembly || "파츠";
        renderAssemblyDetail(name);
      });
    });

    assemblyDetailClose.addEventListener("click", () => {
      assemblyDetail.classList.remove("active");
    });

    assemblyUnequip.addEventListener("click", () => {
      const name = assemblyDetailTitle.textContent || "";
      equipped[name] = null;
      const slotItem = assemblyItems.find((i) => i.dataset.slot === name);
      if (slotItem) {
        const icon = slotItem.querySelector(".assemblyIcon");
        const label = slotItem.querySelector(".assemblyLabel");
        icon.classList.remove("machinehandgun");
        label.textContent = slotItem.dataset.defaultName || name;
      }
      renderAssemblyDetail(name);
    });

    const previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x0f0f12);
    const previewCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    previewCamera.position.set(0, 0.6, 5.6);
    const previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, antialias: true, alpha: true });
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const previewLight = new THREE.DirectionalLight(0xffffff, 0.9);
    previewLight.position.set(2, 4, 3);
    previewScene.add(new THREE.AmbientLight(0xffffff, 0.4), previewLight);

    const previewDummy = new THREE.Group();
    const previewPivot = new THREE.Group();
    const previewMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.7, metalness: 0.0 });
    const pHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), previewMat);
    pHead.position.set(0, 1.8, 0);
    const pTorso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.35), previewMat);
    pTorso.position.set(0, 1.2, 0);
    const pArmL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), previewMat);
    pArmL.position.set(-0.55, 1.2, 0);
    const pArmR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), previewMat);
    pArmR.position.set(0.55, 1.2, 0);
    const pLegL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), previewMat);
    pLegL.position.set(-0.18, 0.45, 0);
    const pLegR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), previewMat);
    pLegR.position.set(0.18, 0.45, 0);
      previewDummy.add(pHead, pTorso, pArmL, pArmR, pLegL, pLegR);
      previewDummy.position.set(0, -1.1, 0);
      previewPivot.add(previewDummy);
      previewScene.add(previewPivot);
      const expansionSphere = new THREE.Mesh(
        new THREE.SphereGeometry(playerSize * 0.7, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.2 })
      );
      expansionSphere.visible = false;
      scene.add(expansionSphere);
      const expansionParticles = [];
      let expansionParticleTimer = 0;
      const expansionParticleGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      const expansionParticleMat = new THREE.MeshStandardMaterial({
        color: 0xff4a4a,
        transparent: true,
        opacity: 0.8
      });

      const septiaGroup = new THREE.Group();
      scene.add(septiaGroup);
      const septiaDiamonds = [];
      const septiaTotal = 72;
      for (let i = 0; i < septiaTotal; i += 1) {
        const hue = i / septiaTotal;
        const color = new THREE.Color().setHSL(hue, 0.75, 0.6);
        const mat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.6,
          roughness: 0.35,
          metalness: 0.2
        });
        const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), mat);
        d.userData.state = "idle";
        d.userData.timer = 0;
        d.userData.hitCount = 0;
        d.userData.nextHit = 1;
        d.userData.target = null;
        septiaGroup.add(d);
        septiaDiamonds.push(d);
      }
    function resizePreview() {
      const rect = previewCanvas.getBoundingClientRect();
      const size = Math.max(200, Math.floor(Math.min(rect.width, rect.height)));
      previewRenderer.setSize(size, size, false);
      previewCamera.aspect = 1;
      previewCamera.updateProjectionMatrix();
    }
    resizePreview();

    let previewDragging = false;
    let previewLastX = 0;
    let previewLastY = 0;
    previewCanvas.addEventListener("mousedown", (e) => {
      previewDragging = true;
      previewCanvas.classList.add("dragging");
      previewLastX = e.clientX;
      previewLastY = e.clientY;
    });
    window.addEventListener("mouseup", () => {
      previewDragging = false;
      previewCanvas.classList.remove("dragging");
    });
    previewCanvas.addEventListener("mousemove", (e) => {
      if (!previewDragging) return;
      const dx = e.clientX - previewLastX;
      const dy = e.clientY - previewLastY;
      previewLastX = e.clientX;
      previewLastY = e.clientY;
      previewRotY += dx * 0.01;
      previewRotX += dy * 0.01;
      previewRotX = clamp(previewRotX, -0.8, 0.8);
    });

    function populateGrid(container, prefix) {
      const total = 50;
      for (let i = 1; i <= total; i += 1) {
        const item = document.createElement("div");
        item.className = "gridItem";
        item.dataset.name = `${prefix} ${i}`;
        item.innerHTML = `
          <div class="gridIcon"></div>
          <div class="gridLabel">${prefix} ${i}</div>
        `;
        container.appendChild(item);
      }
    }

    populateGrid(codexGridWrap, "도감");
    populateGrid(itemGridWrap, "아이템");
    populateGrid(shopGridWrap, "상점");

    function bindGrid(gridEl, nameEl, descEl) {
      gridEl.addEventListener("click", (event) => {
        const target = event.target.closest(".gridItem");
        if (!target) return;
        const name = target.dataset.name || "항목";
        nameEl.textContent = name;
        descEl.textContent = `${name}의 설명이 이 영역에 표시됩니다.`;
      });
    }

    bindGrid(codexGrid, codexDetailName, codexDetailDesc);
    bindGrid(itemGrid, itemDetailName, itemDetailDesc);
    bindGrid(shopGrid, shopDetailName, shopDetailDesc);

    function enableDragScroll(container) {
      let isDown = false;
      let startY = 0;
      let scrollTop = 0;

      container.addEventListener("mousedown", (e) => {
        isDown = true;
        container.classList.add("dragging");
        startY = e.pageY - container.offsetTop;
        scrollTop = container.scrollTop;
      });
      window.addEventListener("mouseup", () => {
        isDown = false;
        container.classList.remove("dragging");
      });
      container.addEventListener("mouseleave", () => {
        isDown = false;
        container.classList.remove("dragging");
      });
      container.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        e.preventDefault();
        const y = e.pageY - container.offsetTop;
        const walk = (y - startY) * 1.2;
        container.scrollTop = scrollTop - walk;
      });
    }

    enableDragScroll(codexGrid);
    enableDragScroll(itemGrid);
    enableDragScroll(shopGrid);

    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === document.body) {
        hint.textContent = "WASD로 이동";
        document.addEventListener("mousemove", onMouseMove);
      } else {
        hint.textContent = "클릭해서 시작";
        document.removeEventListener("mousemove", onMouseMove);
      }
    });

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      resizePreview();
    });

      function updateStamina(delta) {
        if (paused) return;
        const movingInput = keys.w || keys.a || keys.s || keys.d;
        const sprintingInput = keys.shift && movingInput;
        const dashingInput = keys.shift && keys.space;
        const flyingInput = keys.shift && keys.w && !dashingInput;
        const now = performance.now() / 1000;

        if (flyingInput && ((staminaCooldown && en > 0) || (!staminaCooldown && stamina > 0))) {
          consumeEnergy(10 * delta, now);
        } else if (keys.shift && !player.grounded && !flyingInput) {
          if ((staminaCooldown && en > 0) || (!staminaCooldown && stamina > 0)) {
            consumeEnergy(0.4 * delta, now);
          }
        } else if (staminaCooldown) {
          stamina = Math.min(100, stamina + 40 * delta);
          if (stamina >= 100) {
            staminaCooldown = false;
          } else if (now >= staminaCooldownEnd && stamina >= 100) {
            staminaCooldown = false;
          }
        } else {
          if (sprintingInput && stamina > 0) {
            consumeEnergy(8 * delta, now);
          } else {
            stamina = Math.min(100, stamina + 25.6 * delta);
          }
        }

        staminaFill.style.width = `${stamina.toFixed(1)}%`;
        staminaFill.style.background = staminaCooldown ? "#ff4b4b" : "#ffd93d";
        if (enFill) {
          en = Math.min(100, en + 25.6 * delta);
          enFill.style.width = `${en.toFixed(1)}%`;
        }
        if (!energyLock && staminaCooldown && en <= 0) {
          energyLock = true;
        }
        if (energyLock && (stamina >= 100 || en >= 100)) {
          energyLock = false;
        }
        if (frameNow < expansionActiveUntil) {
          energyLock = false;
        }
        if (energyWarning) {
          energyWarning.style.display = energyLock ? "block" : "none";
        }
        if (apWarning) {
          apWarning.style.display = frameNow < apCriticalUntil ? "block" : "none";
        }
      }

      const clock = new THREE.Clock();
      function animate() {
        const delta = Math.min(clock.getDelta(), 0.033);
        const now = performance.now() / 1000;
        frameNow = now;
        applyMovement(delta);
        updateStamina(delta);
        updateCamera();

        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2));
        const up = new THREE.Vector3(0, 1, 0);
        const back = forward.clone().multiplyScalar(-1);
        const septiaAnchors = [
          back.clone().multiplyScalar(1.1).addScaledVector(right, -0.9).addScaledVector(up, 0.7),
          back.clone().multiplyScalar(1.2).addScaledVector(right, 0).addScaledVector(up, 0.5),
          back.clone().multiplyScalar(1.1).addScaledVector(right, -0.9).addScaledVector(up, -0.6),
          back.clone().multiplyScalar(1.1).addScaledVector(right, 0.9).addScaledVector(up, 0.7),
          back.clone().multiplyScalar(1.2).addScaledVector(right, 0).addScaledVector(up, 0.1),
          back.clone().multiplyScalar(1.1).addScaledVector(right, 0.9).addScaledVector(up, -0.6)
        ];
        septiaGroup.position.copy(player.position);
        septiaFireCooldown -= delta;
        if (septiaFiring && septiaFireCooldown <= 0 && en > 0 && !energyLock) {
          const available = septiaDiamonds.find((d) => d.userData.state === "idle");
          if (available) {
            en = Math.max(0, en - 1);
            septiaFireCooldown = 0.2;
            available.userData.state = "attack";
            available.userData.timer = 0;
            available.userData.hitCount = 0;
            available.userData.nextHit = 1;
            available.userData.target = findSeptiaTarget(player.position, 10);
            available.userData.dir = new THREE.Vector3(
              -Math.sin(yaw) * Math.cos(pitch),
              Math.sin(pitch),
              -Math.cos(yaw) * Math.cos(pitch)
            ).normalize();
          }
        }
        let idleCount = 0;
        for (let i = 0; i < septiaDiamonds.length; i += 1) {
          const d = septiaDiamonds[i];
          const wing = Math.floor(i / 12);
          const idx = i % 12;
          const wingDir = septiaAnchors[wing].clone().normalize();
          const row = Math.floor(idx / 4);
          const col = idx % 4;
          const offset = septiaAnchors[wing]
            .clone()
            .addScaledVector(wingDir, 0.14 * row)
            .addScaledVector(right, (col - 1.5) * 0.14 * (wing < 3 ? -1 : 1))
            .addScaledVector(up, (col - 1.5) * 0.08)
            .addScaledVector(up, (row % 2) * 0.03);
          const basePos = player.position.clone().add(offset);
          if (d.userData.state === "idle") {
            d.position.copy(basePos);
            idleCount += 1;
          } else {
            d.userData.timer += delta;
            const t = d.userData.timer;
            const forwardDir = d.userData.dir || forward;
            const outPhase = Math.min(1, t / 0.9);
            const backPhase = Math.max(0, (t - 0.9) / 0.6);
            const forwardDist = 1.6 * outPhase;
            const attackPos = basePos.clone().addScaledVector(forwardDir, forwardDist);
            const blended = attackPos.lerp(basePos, backPhase);
            d.position.copy(blended);
            if (t >= d.userData.nextHit && d.userData.hitCount < 3) {
              const target = d.userData.target || findSeptiaTarget(d.position, 10);
              if (target) applyEnemyDamage(target, 500);
              d.userData.hitCount += 1;
              d.userData.nextHit += 1;
            }
            if (t >= 3) {
              d.userData.state = "idle";
            }
          }
        }
        if (septiaCountEl) septiaCountEl.textContent = `${idleCount}`;
        if (septiaGaugeEl) {
          septiaGaugeEl.style.transform = `scaleY(${idleCount / septiaTotal})`;
        }

        const playerRoomIndex = getRoomIndexForPos(player.position);
        enemyTypes.forEach((type) => {
          const roomEnemies = enemies.filter((e) => e.roomIndex === type.roomIndex);
          if (roomEnemies.length >= 30) return;
          const nextSpawn = enemySpawnTimers.get(type.roomIndex) || 0;
          if (now >= nextSpawn) {
            spawnEnemy(type);
            enemySpawnTimers.set(type.roomIndex, now + 10 + Math.random() * 10);
          }
        });

        for (const enemy of enemies) {
          const enemyPos = enemy.mesh.position;
          const dist = enemyPos.distanceTo(player.position);
          const targeting = playerRoomIndex === enemy.roomIndex && dist <= 7.5;
          if (now >= enemy.nextMoveUpdate) {
            if (targeting) {
              enemy.moveTarget = player.position.clone();
            } else {
              enemy.moveTarget = randomPointInRoom(enemy.roomIndex);
            }
            enemy.nextMoveUpdate = now + 0.3 + Math.random() * 0.4;
          }
          const desired = enemy.moveTarget.clone();
          const toTarget = desired.sub(enemyPos);
          if (toTarget.lengthSq() > 0.0001) {
            const moveStep = Math.min(enemyMoveSpeed * delta, toTarget.length());
            toTarget.normalize().multiplyScalar(moveStep);
            enemyPos.add(toTarget);
          }
          if (targeting && dist < enemyAvoidRadius) {
            const pushDir = enemyPos.clone().sub(player.position).normalize();
            enemyPos.copy(player.position.clone().addScaledVector(pushDir, enemyAvoidRadius));
          }
          const bounds = getRoomBounds(enemy.roomIndex);
          enemyPos.x = clamp(enemyPos.x, bounds.minX, bounds.maxX);
          enemyPos.z = clamp(enemyPos.z, bounds.minZ, bounds.maxZ);
          enemyPos.y = floorY + enemyRadius;

          if (enemy.label) {
            enemy.label.textContent = `AP ${Math.ceil(enemy.ap)} / PA ${Math.ceil(enemy.pa)}`;
            const labelPos = enemyPos.clone().add(new THREE.Vector3(0, enemyRadius + 0.4, 0));
            labelPos.project(camera);
            const x = (labelPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-labelPos.y * 0.5 + 0.5) * window.innerHeight;
            enemy.label.style.left = `${x}px`;
            enemy.label.style.top = `${y}px`;
            enemy.label.style.transform = "translate(-50%, -100%)";
            enemy.label.style.display = labelPos.z < 1 ? "block" : "none";
          }

          if (now >= enemy.chargeStart && now < enemy.nextBeam) {
            const t = (now - enemy.chargeStart) / 10;
            const whiteT = Math.min(1, t / 0.8);
            const color = enemy.baseColor.clone().lerp(new THREE.Color(0xffffff), whiteT);
            enemy.mesh.material.color.copy(color);
          } else {
            enemy.mesh.material.color.copy(enemy.baseColor);
          }

          if (targeting && now >= enemy.nextBall && dist <= 10) {
            const dir = player.position.clone().sub(enemyPos).normalize();
            const ball = new THREE.Mesh(
              new THREE.SphereGeometry(0.12, 12, 12),
              new THREE.MeshStandardMaterial({ color: enemy.baseColor, emissive: enemy.baseColor, emissiveIntensity: 0.5 })
            );
            ball.position.copy(enemyPos).addScaledVector(dir, enemyRadius + 0.2);
            ball.userData.velocity = dir.clone().multiplyScalar(6);
            ball.userData.life = 5;
            const dmg = Math.max(500, 1000 - (dist / 10) * 500);
            ball.userData.damage = dmg;
            scene.add(ball);
            enemyProjectiles.push(ball);
            enemy.nextBall = now + 5;
          }

          if (targeting && now >= enemy.nextBeam) {
            applyDamage(7500);
            const beamMat = new THREE.LineBasicMaterial({ color: 0xffffff });
            const beamGeo = new THREE.BufferGeometry().setFromPoints([enemyPos.clone(), player.position.clone()]);
            const beam = new THREE.Line(beamGeo, beamMat);
            beam.userData.life = 0.3;
            scene.add(beam);
            enemyBeams.push(beam);
            enemy.nextBeam = now + 50;
            enemy.chargeStart = enemy.nextBeam - 10;
          }
        }

        if (!paused) {
          fireCooldown -= delta;
          if ((firingLeft || firingRight) && fireCooldown <= 0) {
            fireCooldown = 0.1;
            const dirBase = new THREE.Vector3(
              -Math.sin(yaw) * Math.cos(pitch),
              Math.sin(pitch),
              -Math.cos(yaw) * Math.cos(pitch)
            ).normalize();
            const right = new THREE.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2));
            const sides = [];
            if (firingLeft && !reloadingLeft && magLeft > 0) sides.push(-0.34);
            if (firingRight && !reloadingRight && magRight > 0) sides.push(0.34);
            const rainbow = [0xff3b3b, 0xff9f1c, 0xffe66d, 0x8cff6b, 0x4ecdc4, 0x5f9bff, 0x8a6bff, 0xff6bd4, 0xff5d5d, 0xffb45d, 0xfff05d, 0x7aff9e, 0x4dd6ff];
            for (const side of sides) {
              const pelletCount = 13;
              const isLeft = side < 0;
              const origin = new THREE.Vector3();
              if (isLeft) {
                gunLeft.getWorldPosition(origin);
                magLeft = Math.max(0, magLeft - 1);
              } else {
                gunRight.getWorldPosition(origin);
                magRight = Math.max(0, magRight - 1);
              }
              const pelletSpeed = 80;
              const pelletLife = 125;
              const pelletSize = isLeft ? 0.02 : 0.64;
              for (let i = 0; i < pelletCount; i += 1) {
                const spreadYaw = (Math.random() - 0.5) * 0.08;
                const spreadPitch = (Math.random() - 0.5) * 0.08;
                const dir = new THREE.Vector3(
                  -Math.sin(yaw + spreadYaw) * Math.cos(pitch + spreadPitch),
                  Math.sin(pitch + spreadPitch),
                  -Math.cos(yaw + spreadYaw) * Math.cos(pitch + spreadPitch)
                ).normalize();
                const bulletGeo = isLeft
                  ? new THREE.CylinderGeometry(0.02, 0.02, 2.4, 8)
                  : new THREE.BoxGeometry(pelletSize, pelletSize, 0.08);
                const color = isLeft ? rainbow[i % rainbow.length] : 0x111111;
                const bulletMat = isLeft
                  ? new THREE.MeshStandardMaterial({
                    color,
                    emissive: color,
                    emissiveIntensity: 1.2,
                    transparent: true,
                    opacity: 0.75
                  })
                  : new THREE.MeshStandardMaterial({ color });
                const bullet = new THREE.Mesh(bulletGeo, bulletMat);
                if (isLeft) {
                  const up = new THREE.Vector3(0, 1, 0);
                  bullet.quaternion.setFromUnitVectors(up, dir);
                }
                const spawn = origin.clone().addScaledVector(dir, -0.05);
                bullet.position.copy(spawn);
                bullet.userData.velocity = dir.clone().multiplyScalar(pelletSpeed);
                bullet.userData.life = pelletLife;
                bullet.userData.range = 10000;
                bullet.userData.travel = 0;
                bullet.userData.damage = 1000;
                bullet.userData.explosionDamage = 500;
                bullet.userData.explosionRadius = 2;
                bullet.userData.color = color;
                bullet.userData.isBeam = isLeft;
                bullet.userData.hitRadius = isLeft ? 0.2 : pelletSize * 0.6;
                scene.add(bullet);
                bullets.push(bullet);
              }
            }
            if (magLeft === 0 && !reloadingLeft && firingLeft) {
              reloadingLeft = true;
              reloadEndLeft = performance.now() / 1000 + reloadTime;
            }
            if (magRight === 0 && !reloadingRight && firingRight) {
              reloadingRight = true;
              reloadEndRight = performance.now() / 1000 + reloadTime;
            }
          }
        }

        for (let i = bullets.length - 1; i >= 0; i -= 1) {
          const b = bullets[i];
          const stepDist = b.userData.velocity.length() * delta;
          b.position.addScaledVector(b.userData.velocity, delta);
          b.userData.life -= delta;
          b.userData.travel = (b.userData.travel || 0) + stepDist;
          let hit = false;
          const roomsHere = getRoomsForPos(b.position);
          if (roomsHere.length === 0) {
            hit = true;
          } else {
            for (const room of roomsHere) {
              for (const box of room.blockBoxes) {
                if (
                  b.position.x >= box.minX && b.position.x <= box.maxX &&
                  b.position.y >= box.minY && b.position.y <= box.maxY &&
                  b.position.z >= box.minZ && b.position.z <= box.maxZ
                ) {
                  hit = true;
                  break;
                }
              }
              if (hit) break;
            }
          }
          if (!hit) {
            const hitRadius = b.userData.hitRadius || 0.2;
            for (const enemy of enemies) {
              if (enemy.mesh.position.distanceTo(b.position) <= enemyRadius + hitRadius) {
                applyEnemyDamage(enemy, b.userData.damage || 0);
                hit = true;
                break;
              }
            }
          }
          if (hit) {
            const fxColor = b.userData.color || 0xffffff;
            createExplosionField(b.position.clone(), b.userData.explosionRadius || 2, b.userData.explosionDamage || 0, fxColor);
            scene.remove(b);
            bullets.splice(i, 1);
            continue;
          }
          if (b.userData.life <= 0 || (b.userData.range && b.userData.travel >= b.userData.range) || roomsHere.length === 0) {
            scene.remove(b);
            bullets.splice(i, 1);
          }
        }
        if (bullets.length > 2000) {
          const excess = bullets.length - 2000;
          for (let i = 0; i < excess; i += 1) {
            const b = bullets.shift();
            if (b) scene.remove(b);
          }
        }

        for (let i = enemyProjectiles.length - 1; i >= 0; i -= 1) {
          const p = enemyProjectiles[i];
          if (p.userData.velocity) {
            p.position.addScaledVector(p.userData.velocity, delta);
            p.userData.life -= delta;
            if (p.position.distanceTo(player.position) <= playerHalf + 0.12) {
              applyDamage(p.userData.damage || 500);
              scene.remove(p);
              enemyProjectiles.splice(i, 1);
              continue;
            }
            if (p.userData.life <= 0 || p.position.distanceTo(player.position) > 12) {
              scene.remove(p);
              enemyProjectiles.splice(i, 1);
            }
          } else {
            p.userData.life -= delta;
            p.userData.startLife = p.userData.startLife || 0.25;
            const ratio = Math.max(0, p.userData.life / p.userData.startLife);
            p.material.opacity = 0.6 * ratio;
            p.scale.setScalar(1 + (1 - ratio) * 1.8);
            if (p.userData.life <= 0) {
              scene.remove(p);
              enemyProjectiles.splice(i, 1);
            }
          }
        }

        for (let i = enemyBeams.length - 1; i >= 0; i -= 1) {
          const beam = enemyBeams[i];
          beam.userData.life -= delta;
          if (beam.userData.life <= 0) {
            scene.remove(beam);
            enemyBeams.splice(i, 1);
          }
        }

        for (let i = explosionFields.length - 1; i >= 0; i -= 1) {
          const fx = explosionFields[i];
          fx.userData.life -= delta;
          const ratio = Math.max(0, fx.userData.life / fx.userData.startLife);
          fx.material.opacity = 0.9 * ratio;
          fx.scale.setScalar(1 + (1 - ratio) * 2.5);
          const radius = fx.userData.radius || 2;
          const dps = fx.userData.dps || 0;
          if (dps > 0) {
            for (const enemy of enemies) {
              if (enemy.mesh.position.distanceTo(fx.position) <= radius) {
                applyEnemyDamage(enemy, dps * delta);
              }
            }
          }
          if (fx.userData.life <= 0) {
            scene.remove(fx);
            explosionFields.splice(i, 1);
          }
        }

        for (let i = floatingTexts.length - 1; i >= 0; i -= 1) {
          const f = floatingTexts[i];
          f.life -= delta;
          f.pos.addScaledVector(f.velocity, delta);
          const screen = f.pos.clone().project(camera);
          const x = (screen.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-screen.y * 0.5 + 0.5) * window.innerHeight;
          f.el.style.left = `${x}px`;
          f.el.style.top = `${y}px`;
          f.el.style.opacity = `${Math.max(0, f.life / f.startLife)}`;
          if (f.life <= 0) {
            f.el.remove();
            floatingTexts.splice(i, 1);
          }
        }

        if (reloadingLeft && now >= reloadEndLeft) {
          reloadingLeft = false;
          magLeft = magMax;
        }
        if (reloadingRight && now >= reloadEndRight) {
          reloadingRight = false;
          magRight = magMax;
        }
      const reserveLeftText = reserveLeft === Infinity ? "∞" : reserveLeft;
      const reserveRightText = reserveRight === Infinity ? "∞" : reserveRight;
      if (ammoLeft) {
        ammoLeft.textContent = reloadingLeft
          ? "0 장전중"
          : `장전 ${magLeft} / 잔탄 ${reserveLeftText}`;
        ammoLeft.style.color = reloadingLeft ? "#ff4b4b" : "#ffffff";
      }
      if (ammoRight) {
        ammoRight.textContent = reloadingRight
          ? "0 장전중"
          : `장전 ${magRight} / 잔탄 ${reserveRightText}`;
        ammoRight.style.color = reloadingRight ? "#ff4b4b" : "#ffffff";
      }

        if (apPanel && apFill) {
          apPanel.querySelector(".label").textContent = `AP ${ap} / ${apMax}`;
          apFill.style.width = `${(ap / apMax) * 100}%`;
          apFill.style.background = now < repairHealEnd ? "#6bff6b" : "#ffffff";
        }
        if (paPanel && paFill) {
          paPanel.querySelector(".label").textContent = `PA ${pa} / ${paMax}`;
          paFill.style.width = `${(pa / paMax) * 100}%`;
          paFill.style.background = paCooldown ? "#ff4b4b" : "#59ff7a";
        }

        if (expansionHolding && expansionHoldStart && performance.now() - expansionHoldStart >= 1000) {
          expansionHoldStart = performance.now();
          if (now >= expansionCooldownEnd) {
            expansionCooldownEnd = now + 50;
            expansionActiveUntil = now + 30;
            expansionNextHeal = now + 0.2;
            expansionShockDone = false;
          }
        }
        if (now < expansionActiveUntil && now >= expansionNextHeal) {
          const roll = 1 + Math.floor(Math.random() * 10);
          ap = Math.min(apMax, ap + roll);
          expansionNextHeal = now + 0.2;
        }
        if (now < expansionActiveUntil) {
          if (!expansionShockDone) {
            for (const enemy of enemies) {
              if (enemy.mesh.position.distanceTo(player.position) <= 10) {
                enemy.pa = Math.max(0, enemy.pa - 10000);
                if (enemy.pa === 0) {
                  enemy.ap = Math.max(0, enemy.ap - 10000);
                }
              }
            }
            expansionShockDone = true;
          }
          const dps = (dist) => {
            if (dist < 2) return 1000;
            if (dist < 4) return 500;
            if (dist < 6) return 250;
            if (dist < 8) return 125;
            return 0;
          };
          for (const enemy of enemies) {
            const dist = enemy.mesh.position.distanceTo(player.position);
            const damagePerSecond = dps(dist);
            if (damagePerSecond > 0) {
              let dmg = damagePerSecond * delta;
              const usePa = Math.min(enemy.pa, dmg);
              enemy.pa -= usePa;
              dmg -= usePa;
              if (dmg > 0) {
                enemy.ap = Math.max(0, enemy.ap - dmg);
              }
            }
          }
        }

        if (kitHolding && kitHoldStart && performance.now() - kitHoldStart >= 1000) {
          kitHoldStart = performance.now();
          if (now >= repairCooldownEnd && (kitCount === Infinity || kitCount > 0)) {
            if (kitCount !== Infinity) kitCount -= 1;
            repairCooldownEnd = now + 10;
            repairHealStart = now;
            repairHealEnd = now + 1;
            repairHealAmount = Math.floor(apMax / 4 + ap / 3);
            repairHealApplied = 0;
            repairOverlayUntil = now + 0.2;
            repairActiveStart = now;
            repairActiveUntil = now + 6;
            pa = paMax;
            paCooldown = false;
            paCooldownEnd = 0;
            paInvulnUntil = now + 1.5;
          }
        }

        if (repairHealEnd > now) {
          const t = (now - repairHealStart) / (repairHealEnd - repairHealStart);
          const ratio = Math.max(0, Math.min(1, t));
          const target = Math.floor(repairHealAmount * ratio);
          const heal = Math.max(0, target - repairHealApplied);
          if (heal > 0) {
            ap = Math.min(apMax, ap + heal);
            repairHealApplied += heal;
          }
        }

        if (kitCooldownEl) {
          const cooldownLeft = Math.max(0, repairCooldownEnd - now);
          const ratio = Math.min(1, cooldownLeft / 10);
          kitCooldownEl.style.transform = `scaleY(${ratio})`;
        }

        if (repairOverlay) {
          const overlayActive = now < repairOverlayUntil;
          repairOverlay.style.opacity = overlayActive ? "1" : "0";
        }

        if (damageShield) {
          const remaining = Math.max(0, repairActiveUntil - now);
          const elapsed = Math.max(0, now - repairActiveStart);
          const stage = Math.floor(elapsed / 1.5);
          const alpha = remaining > 0 ? Math.max(0, 0.8 - stage * 0.2) : 0;
          damageShield.style.borderColor = `rgba(140, 255, 140, ${alpha})`;
        }
        if (expansionOverlay) {
          expansionOverlay.style.opacity = now < expansionActiveUntil ? "1" : "0";
        }
        if (expansionCooldownEl) {
          const cooldownLeft = Math.max(0, expansionCooldownEnd - now);
          const ratio = Math.min(1, cooldownLeft / 50);
          expansionCooldownEl.style.transform = `scaleY(${ratio})`;
        }
        if (now < repairActiveUntil) {
          const elapsed = now - repairActiveStart;
          if (elapsed < 1.5) damageScale = 0;
          else if (elapsed < 3) damageScale = 0.25;
          else if (elapsed < 4.5) damageScale = 0.5;
          else damageScale = 0.75;
        } else {
          damageScale = 1;
        }

        if (!paCooldown && pa <= 0) {
          pa = 0;
          paCooldown = true;
          paCooldownEnd = now + 50;
        }
        if (paCooldown) {
          pa = Math.min(paMax, pa + 33 * delta);
          if (now >= paCooldownEnd && pa >= paMax) {
            paCooldown = false;
          }
        } else {
          pa = Math.min(paMax, pa + 33 * delta);
        }

        if (now < expansionActiveUntil) {
          const base = new THREE.Vector3(player.position.x, player.position.y + playerHalf, player.position.z);
          expansionSphere.visible = true;
          expansionSphere.position.copy(base);
        } else {
          expansionSphere.visible = false;
        }

        if (now < expansionCooldownEnd) {
          expansionParticleTimer += delta;
          const spawnInterval = 0.05;
          const right = new THREE.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2));
          const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
          while (expansionParticleTimer >= spawnInterval) {
            expansionParticleTimer -= spawnInterval;
            for (const side of [-1, 1]) {
              const p = new THREE.Mesh(expansionParticleGeo, expansionParticleMat.clone());
              const base = new THREE.Vector3(player.position.x, player.position.y + playerHalf, player.position.z);
              const lateral = right.clone().multiplyScalar(0.35 * side);
              const origin = base.add(lateral).addScaledVector(back, 0.1);
              p.position.copy(origin);
              p.userData.velocity = right.clone().multiplyScalar(0.6 * side)
                .add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.2));
              p.userData.life = 0.9 + Math.random() * 0.6;
              p.userData.startLife = p.userData.life;
              scene.add(p);
              expansionParticles.push(p);
            }
          }
        }

        for (let i = expansionParticles.length - 1; i >= 0; i -= 1) {
          const p = expansionParticles[i];
          p.position.addScaledVector(p.userData.velocity, delta);
          p.userData.life -= delta;
          p.material.opacity = Math.max(0, 0.8 * (p.userData.life / p.userData.startLife));
          if (p.userData.life <= 0) {
            scene.remove(p);
            expansionParticles.splice(i, 1);
          }
        }

      renderer.render(scene, camera);
      previewPivot.rotation.y = previewRotY;
      previewPivot.rotation.x = previewRotX;
      previewCamera.lookAt(0, 0, 0);
      previewRenderer.render(previewScene, previewCamera);
      requestAnimationFrame(animate);
    }
    animate();
  
