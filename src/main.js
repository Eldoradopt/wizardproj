const discordSdk = new window.DiscordSDK("1486773167891415251");

async function startApp() {
    const status = document.getElementById('status-text');

    try {
        if (discordSdk) {
            await discordSdk.ready();
            console.log("SDK READY");
        } else {
            console.warn("No Discord SDK found");
        }
    } catch (e) {
        console.error("SDK ERROR:", e);
    }

    if (status) status.style.display = 'none';
    new Phaser.Game(config);
}

const config = {
    type: Phaser.AUTO,
    width: 800, height: 600,
    parent: 'game-container',
    backgroundColor: '#0f172a',
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: { preload, create, update }
};

let wizards = [], healthBars = [], currentTurn = 0, isFired = false;
let terrainTexture, collisionMap, projectiles, turnText, turnArrow, selectedSpell = 'fireball';
let spellIcons = {}, cursors;

function preload() {
    // Generate ALL textures programmatically for 100% reliability

    // 1. Wizards
    const colors = [0x8b5cf6, 0xef4444]; // Purple, Red
    colors.forEach((color, i) => {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        // Body (Robes)
        g.fillStyle(color);
        g.fillTriangle(16, 4, 4, 32, 28, 32);
        // Beards/Face
        g.fillStyle(0xffffff); g.fillCircle(16, 16, 4);
        // Hat
        g.fillStyle(0x1e293b); g.fillTriangle(16, 0, 8, 8, 24, 8);
        g.generateTexture(`wizard${i}`, 32, 32);
    });

    // 2. Projectiles
    const prj = [
        { name: 'fireball', color: 0xf59e0b, r: 8 },
        { name: 'meteor', color: 0xd97706, r: 12 }
    ];
    prj.forEach(p => {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(p.color); g.fillCircle(p.r, p.r, p.r);
        g.lineStyle(2, 0xffffff, 0.5); g.strokeCircle(p.r, p.r, p.r);
        g.generateTexture(p.name, p.r * 2, p.r * 2);
    });

    // 3. UI Icons
    const sp = [
        { id: 'fireball', c: 0xf59e0b }, { id: 'blink', c: 0x06b6d4 },
        { id: 'shield', c: 0x3b82f6 }, { id: 'meteor', c: 0x7c3aed }
    ];
    sp.forEach(s => {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(s.c); g.fillRoundedRect(2, 2, 36, 36, 8);
        g.lineStyle(2, 0xffffff, 0.8); g.strokeRoundedRect(2, 2, 36, 36, 8);
        g.generateTexture(`icon_${s.id}`, 40, 40);
    });
}

function create() {
    const { width, height } = this.scale;

    // --- Procedural Terrain Generation ---
    terrainTexture = this.add.renderTexture(0, 0, width, height);
    const tg = this.add.graphics();
    // Sky gradient
    tg.fillGradientStyle(0x1e293b, 0x1e293b, 0x0f172a, 0x0f172a, 1);
    tg.fillRect(0, 0, width, height);

    // Terrain Shape
    tg.fillStyle(0x334155); // Deep dirt
    tg.beginPath();
    tg.moveTo(0, height);
    for (let x = 0; x <= width; x += 20) {
        const y = 400 + Math.sin(x * 0.02) * 40 + Math.sin(x * 0.005) * 80;
        tg.lineTo(x, y);
    }
    tg.lineTo(width, height);
    tg.closePath(); tg.fill();

    // Grass Top
    tg.lineStyle(6, 0x10b981, 1);
    tg.beginPath();
    for (let x = 0; x <= width; x += 10) {
        const y = 400 + Math.sin(x * 0.02) * 40 + Math.sin(x * 0.005) * 80;
        if (x === 0) tg.moveTo(x, y); else tg.lineTo(x, y);
    }
    tg.strokePath();

    terrainTexture.draw(tg);
    tg.destroy();

    // Collision Map
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width; tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    ctx.fillStyle = '#000';
    // Re-draw the same shape into the canvas for physics
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 5) {
        const y = 400 + Math.sin(x * 0.02) * 40 + Math.sin(x * 0.005) * 80;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height); ctx.fill();
    this.collisionMap = ctx.getImageData(0, 0, width, height).data;

    // --- Entities ---
    for (let i = 0; i < 2; i++) {
        wizards[i] = this.physics.add.sprite(i === 0 ? 100 : 700, 100, `wizard${i}`);
        wizards[i].setData({ hp: 100, id: i, shield: 0 });
        wizards[i].body.setGravityY(1000);

        healthBars[i] = {
            bg: this.add.rectangle(0, 0, 50, 6, 0x1e293b).setStrokeStyle(1, 0xffffff, 0.2),
            val: this.add.rectangle(0, 0, 50, 6, 0x10b981)
        };
    }

    turnText = this.add.text(width / 2, 50, 'PLAYER 1', {
        fontFamily: 'Orbitron, sans-serif', fontSize: '32px', color: '#8b5cf6', fontWeight: 'bold'
    }).setOrigin(0.5).setShadow(2, 2, '#000', 4);

    // Spell Bar
    const spellNames = ['fireball', 'blink', 'shield', 'meteor'];
    spellNames.forEach((s, i) => {
        const icon = this.add.image(280 + i * 80, 540, `icon_${s}`).setInteractive();
        icon.on('pointerdown', () => { selectedSpell = s; updateSpellUI(); });
        spellIcons[s] = icon;
    });

    const updateSpellUI = () => {
        spellNames.forEach(s => spellIcons[s].setAlpha(s === selectedSpell ? 1 : 0.4).setScale(s === selectedSpell ? 1.2 : 1));
    };
    updateSpellUI();

    projectiles = this.physics.add.group();
    cursors = this.input.keyboard.createCursorKeys();
    turnArrow = this.add.triangle(0, 0, -10, -50, 10, -50, 0, -30, 0x10b981);

    this.input.on('pointerdown', p => {
        if (isFired) return;
        const wiz = wizards[currentTurn];
        if (selectedSpell === 'blink') {
            if (Phaser.Math.Distance.Between(wiz.x, wiz.y, p.x, p.y) < 400) {
                this.cameras.main.flash(300, 0, 255, 255);
                wiz.setPosition(p.x, p.y).setVelocity(0); finishTurn.call(this);
            }
        } else if (selectedSpell === 'shield') {
            wiz.setData('shield', 3); wiz.setAlpha(0.6); finishTurn.call(this);
        } else {
            const pr = projectiles.create(wiz.x, wiz.y - 20, selectedSpell);
            const ang = Phaser.Math.Angle.Between(wiz.x, wiz.y - 20, p.x, p.y);
            pr.setVelocity(Math.cos(ang) * 800, Math.sin(ang) * 800);
            pr.setGravityY(selectedSpell === 'meteor' ? 1200 : 600);
            pr.setData('radius', selectedSpell === 'meteor' ? 80 : 40);
            isFired = true;
        }
    });
}

function update() {
    const wiz = wizards[currentTurn];
    turnArrow.setPosition(wiz.x, wiz.y - 40);

    wizards.forEach((w, i) => {
        healthBars[i].bg.setPosition(w.x, w.y - 50);
        healthBars[i].val.setPosition(w.x, w.y - 50);
        healthBars[i].val.width = (w.getData('hp') / 100) * 50;
        healthBars[i].val.fillColor = w.getData('hp') < 30 ? 0xef4444 : 0x10b981;

        // Physics logic: walk up slopes
        const gnd = isSolid.call(this, w.x, w.y + 16);
        if (gnd) {
            w.body.setGravityY(0); w.setVelocityY(0);
            let push = 0; while (isSolid.call(this, w.x, w.y + 16 - push) && push < 32) push++;
            w.y -= push;
        } else { w.body.setGravityY(1000); }
    });

    projectiles.getChildren().forEach(p => {
        if (isSolid.call(this, p.x, p.y)) {
            explode(p.x, p.y, p.getData('radius'), this);
            p.destroy();
        }
    });

    if (!isFired) {
        if (cursors.left.isDown) wiz.setVelocityX(-160);
        else if (cursors.right.isDown) wiz.setVelocityX(160);
        else wiz.setVelocityX(0);
        if (cursors.up.isDown && isSolid.call(this, wiz.x, wiz.y + 17)) wiz.setVelocityY(-450);
    } else {
        wiz.setVelocityX(0);
        if (projectiles.countActive(true) === 0) this.time.delayedCall(1200, finishTurn, [], this);
    }
}

function isSolid(x, y) {
    if (x < 0 || x >= 800 || y < 0 || y >= 600) return false;
    return this.collisionMap ? this.collisionMap[(Math.floor(y) * 800 + Math.floor(x)) * 4 + 3] > 128 : false;
}

function explode(x, y, rad, scene) {
    scene.cameras.main.shake(200, 0.02);
    const circle = scene.add.graphics().fillStyle(0, 1).fillCircle(x, y, rad);
    terrainTexture.erase(circle);
    circle.destroy();

    for (let dx = -rad; dx <= rad; dx++) {
        for (let dy = -rad; dy <= rad; dy++) {
            if (dx * dx + dy * dy <= rad * rad) {
                const px = Math.floor(x + dx), py = Math.floor(y + dy);
                if (px >= 0 && px < 800 && py >= 0 && py < 600) scene.collisionMap[(py * 800 + px) * 4 + 3] = 0;
            }
        }
    }

    wizards.forEach(w => {
        const d = Phaser.Math.Distance.Between(x, y, w.x, w.y);
        if (d < rad + 20) {
            let dmg = Math.floor((1 - d / (rad + 20)) * (rad === 80 ? 70 : 35));
            if (w.getData('shield') > 0) {
                dmg = Math.floor(dmg / 3); w.setData('shield', w.getData('shield') - 1);
                if (w.getData('shield') <= 0) w.setAlpha(1);
            }
            w.setData('hp', Math.max(0, w.getData('hp') - dmg));
            if (w.getData('hp') === 0) w.setTint(0x1e293b).setActive(false);
        }
    });
}

function finishTurn() {
    currentTurn = (currentTurn + 1) % 2; isFired = false;
    turnText.setText(`PLAYER ${currentTurn + 1}`).setColor(currentTurn === 0 ? '#8b5cf6' : '#ef4444');
}

startApp();
