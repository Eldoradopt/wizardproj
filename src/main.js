// Wizard Worms - Discord Activity Game
let discordSdk;

// Only initialize if we're in a Discord environment (or CDN loaded correctly)
if (window.discordSdk && window.discordSdk.DiscordSDK) {
    discordSdk = new window.discordSdk.DiscordSDK({
        clientId: "1486773167891415251" // The user must replace this or it will fail in prod
    });
} else {
    console.warn("Discord SDK not found. Running in local/web mode.");
}

async function startApp() {
    const status = document.getElementById('status-text');
    
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("SDK Timeout")), 2500)
    );

    try {
        if (discordSdk) {
            status.innerText = "Syncing with Discord...";
            await Promise.race([discordSdk.ready(), timeout]);
            console.log("Discord SDK is ready!");
        } else {
            status.innerText = "Web Debug Mode...";
        }
    } catch (error) {
        console.warn("Discord SDK connection skipped or timed out:", error);
        status.innerText = "Running in Lite Mode...";
    } finally {
        status.innerText = "Starting Magic...";
        setTimeout(() => {
            new Phaser.Game(config);
        }, 200);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#0a0a1a',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let wizards = [];
let healthBars = [];
let currentTurn = 0;
let cursors;
let isFired = false;
let terrainTexture;
let projectiles;
let turnText;
let turnArrow;
let selectedSpell = 'fireball';
let spellIndicators = {};

function preload() {
    // Load local assets
    this.load.spritesheet('wizard_sprites', 'assets/wizard_sprites.png', { frameWidth: 32, frameHeight: 32 });
    this.load.image('terrain_base', 'assets/terrain.png');

    // Spell icons generated programmatically
    const spells = [
        { name: 'fireball', color: 0xffa500 },
        { name: 'blink', color: 0x00ffff },
        { name: 'shield', color: 0x4169e1 },
        { name: 'meteor', color: 0xff4500 }
    ];

    spells.forEach(s => {
        const icon = this.make.graphics({ x: 0, y: 0, add: false });
        icon.fillStyle(s.color); icon.fillCircle(16, 16, 14);
        icon.lineStyle(2, 0xffffff, 0.8); icon.strokeCircle(16, 16, 14);
        icon.generateTexture(`icon_${s.name}`, 32, 32);
    });

    // Projectile textures
    const fireballG = this.make.graphics({ x: 0, y: 0, add: false });
    fireballG.fillStyle(0xffe066); fireballG.fillCircle(8, 8, 8);
    fireballG.generateTexture('fireball', 16, 16);

    const meteorG = this.make.graphics({ x: 0, y: 0, add: false });
    meteorG.fillStyle(0xff4500); meteorG.fillCircle(12, 12, 12);
    meteorG.generateTexture('meteor', 24, 24);
}

function create() {
    const { width, height } = this.scale;
    const status = document.getElementById('status-text');
    if (status) status.style.display = 'none';

    console.log("Initializing Scene...");

    // --- Asset Fallbacks (Invincibility) ---
    // 1. Terrain Fallback
    terrainTexture = this.add.renderTexture(0, 0, width, height);
    if (this.textures.exists('terrain_base')) {
        terrainTexture.draw('terrain_base', 0, 0);
    } else {
        console.warn("Terrain image missing! Drawing survival ground.");
        terrainTexture.fill(0x1a1a2e);
        const g = this.add.graphics().fillStyle(0x2f4f4f).fillRect(0, 450, 800, 150);
        terrainTexture.draw(g);
        g.destroy();
    }
    
    // 2. Wizard Sprite Fallback
    if (!this.textures.exists('wizard_sprites')) {
         console.warn("Wizard sprites missing! Generating programmatic textures.");
         const g = this.make.graphics({ x: 0, y: 0, add: false });
         g.fillStyle(0xffffff); g.fillRect(0, 0, 32, 32); 
         g.fillStyle(0x000000); g.fillRect(8, 8, 4, 4); g.fillRect(20, 8, 4, 4);
         g.generateTexture('wizard_sprites', 32, 32);
    }
    
    // 3. Animation Safety
    if (!this.anims.exists('idle')) {
        this.anims.create({
            key: 'idle',
            frames: this.textures.get('wizard_sprites').frameTotal > 1 
                ? this.anims.generateFrameNumbers('wizard_sprites', { start: 0, end: 1 })
                : [{ key: 'wizard_sprites', frame: 0 }],
            frameRate: 4,
            repeat: -1
        });
    }

    // --- Physics Map ---
    try {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        this.terrainCtx = canvas.getContext('2d');
        
        const source = this.textures.get('terrain_base').getSourceImage();
        if (source && source.width > 0) {
            this.terrainCtx.drawImage(source, 0, 0);
        } else {
             this.terrainCtx.fillStyle = '#2f4f4f';
             this.terrainCtx.fillRect(0, 450, 800, 150);
        }
        this.collisionMap = this.terrainCtx.getImageData(0, 0, width, height).data;
    } catch (e) {
        console.error("Collision building failed:", e);
        this.collisionMap = new Uint8Array(width * height * 4);
    }

    // --- UI ---
    turnText = this.add.text(width / 2, 40, 'Ready Player 1', {
        fontSize: '32px', color: '#fff', stroke: '#000', strokeThickness: 6, fontStyle: 'bold'
    }).setOrigin(0.5);

    createSpellUI.call(this);

    // --- Wizards ---
    for (let i = 0; i < 2; i++) {
        const x = i === 0 ? 150 : 650;
        wizards[i] = this.physics.add.sprite(x, 100, 'wizard_sprites')
            .setScale(2)
            .setTint(i === 0 ? 0x9b59b6 : 0xe74c3c)
            .play('idle');

        wizards[i].setData({ id: i, hp: 100, shield: 0 });
        wizards[i].body.setGravityY(800);
        wizards[i].setCollideWorldBounds(true);

        healthBars[i] = {
            bg: this.add.rectangle(0, 0, 60, 10, 0x000000),
            value: this.add.rectangle(0, 0, 60, 10, 0x2ecc71)
        };
    }

    projectiles = this.physics.add.group();
    cursors = this.input.keyboard.createCursorKeys();
    turnArrow = this.add.triangle(0, 0, -12, -50, 12, -50, 0, -30, 0x2ecc71);

    this.input.on('pointerdown', handleInput, this);
}

function createSpellUI() {
    const spells = ['fireball', 'blink', 'shield', 'meteor'];
    spells.forEach((spell, i) => {
        const btn = this.add.image(60 + i * 60, 540, `icon_${spell}`).setInteractive();
        btn.on('pointerdown', () => {
            selectedSpell = spell;
            updateSpellIcons.call(this);
        });
        spellIndicators[spell] = btn;
    });
    updateSpellIcons.call(this);
}

function updateSpellIcons() {
    Object.keys(spellIndicators).forEach(k => {
        const active = k === selectedSpell;
        spellIndicators[k].setAlpha(active ? 1 : 0.5).setScale(active ? 1.3 : 1);
    });
}

function handleInput(pointer) {
    if (isFired) return;
    const wizard = wizards[currentTurn];

    switch (selectedSpell) {
        case 'fireball': launchProjectile.call(this, wizard, pointer, 'fireball', 700, 40); break;
        case 'meteor': launchProjectile.call(this, wizard, pointer, 'meteor', 600, 80); break;
        case 'blink':
            if (Phaser.Math.Distance.Between(wizard.x, wizard.y, pointer.x, pointer.y) < 350) {
                this.cameras.main.flash(200, 0, 255, 255);
                wizard.setPosition(pointer.x, pointer.y).setVelocity(0);
                finishTurn.call(this);
            }
            break;
        case 'shield':
            wizard.setData('shield', 3);
            wizard.setTint(0x3498db);
            finishTurn.call(this);
            break;
    }
}

function launchProjectile(wizard, pointer, type, speed, radius) {
    const p = projectiles.create(wizard.x, wizard.y - 20, type);
    const angle = Phaser.Math.Angle.Between(wizard.x, wizard.y - 20, pointer.x, pointer.y);
    p.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    p.setGravityY(type === 'meteor' ? 800 : 500);
    p.setData('radius', radius);
    isFired = true;
}

function update() {
    const activeWizard = wizards[currentTurn];
    turnArrow.setPosition(activeWizard.x, activeWizard.y - 50);

    wizards.forEach((w, i) => {
        healthBars[i].bg.setPosition(w.x, w.y - 60);
        healthBars[i].value.setPosition(w.x - (60 - (w.getData('hp') / 100 * 60)) / 2, w.y - 60);
        healthBars[i].value.width = (w.getData('hp') / 100) * 60;
        healthBars[i].value.fillColor = w.getData('hp') < 30 ? 0xe74c3c : 0x2ecc71;
        handleTerrainCollision.call(this, w);
    });

    projectiles.getChildren().forEach(p => {
        if (checkPixelCollision.call(this, p.x, p.y)) {
            explodeAt.call(this, p.x, p.y, p.getData('radius'));
            p.destroy();
        }
    });

    if (!isFired) {
        activeWizard.setVelocityX(cursors.left.isDown ? -180 : cursors.right.isDown ? 180 : 0);
        if (cursors.up.isDown && activeWizard.isOnGround) activeWizard.setVelocityY(-450);
    } else {
        activeWizard.setVelocityX(0);
        if (projectiles.countActive(true) === 0) {
            this.time.delayedCall(1000, finishTurn, [], this);
        }
    }
}

function handleTerrainCollision(e) {
    e.isOnGround = checkPixelCollision.call(this, e.x, e.y + 20);
    if (e.isOnGround) {
        e.body.setGravityY(0).setVelocityY(0);
        let push = 0;
        while (checkPixelCollision.call(this, e.x, e.y + 20 - push) && push < 30) push++;
        e.y -= push;
    } else {
        e.body.setGravityY(1000);
    }
}

function checkPixelCollision(x, y) {
    if (x < 0 || x >= 800 || y < 0 || y >= 600) return false;
    return this.collisionMap[(Math.floor(y) * 800 + Math.floor(x)) * 4 + 3] > 128;
}

function explodeAt(x, y, radius) {
    this.cameras.main.shake(200, 0.015);
    const circle = this.add.graphics().fillStyle(0, 1).fillCircle(x, y, radius);
    terrainTexture.erase(circle);
    circle.destroy();

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            if (dx * dx + dy * dy <= radius * radius) {
                const px = Math.floor(x + dx), py = Math.floor(y + dy);
                if (px >= 0 && px < 800 && py >= 0 && py < 600) this.collisionMap[(py * 800 + px) * 4 + 3] = 0;
            }
        }
    }

    wizards.forEach(w => {
        const dist = Phaser.Math.Distance.Between(x, y, w.x, w.y);
        if (dist < radius + 30) {
            let dmg = Math.floor((1 - dist / (radius + 30)) * (radius === 80 ? 80 : 40));
            applyDamage(w, dmg);
        }
    });
}

function applyDamage(w, amount) {
    if (w.getData('shield') > 0) {
        amount = Math.floor(amount / 3);
        w.setData('shield', w.getData('shield') - 1);
        if (w.getData('shield') <= 0) w.clearTint().setTint(w.getData('id') === 0 ? 0x9b59b6 : 0xe74c3c);
    }
    const hp = Math.max(0, w.getData('hp') - amount);
    w.setData('hp', hp);
    if (hp === 0) w.setTint(0x333333).setAlpha(0.7);
}

function finishTurn() {
    if (!isFired && (selectedSpell === 'fireball' || selectedSpell === 'meteor')) return;
    currentTurn = (currentTurn + 1) % wizards.length;
    isFired = false;
    turnText.setText(`Wizard ${currentTurn + 1}'s Turn`);
    const next = wizards[currentTurn];
    if (next.getData('shield') <= 0) next.setTint(currentTurn === 0 ? 0x9b59b6 : 0xe74c3c);
}

startApp().catch(err => {
    console.error("Critical error starting the application:", err);
    // Even if startApp fails, try to boot Phaser as last resort
    new Phaser.Game(config);
});

