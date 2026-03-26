// Wizard Worms - Discord Activity Game
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 600 },
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
let platforms;
let fireballs;
let turnText;
let turnArrow;

function preload() {
    // Graphics generated programmatically
    const wizard1Graphics = this.make.graphics({ x: 0, y: 0, add: false });
    wizard1Graphics.fillStyle(0x6a5acd); // Purple wizard
    wizard1Graphics.fillCircle(16, 16, 16);
    wizard1Graphics.generateTexture('wizard1', 32, 32);

    const wizard2Graphics = this.make.graphics({ x: 0, y: 0, add: false });
    wizard2Graphics.fillStyle(0xcd5c5c); // Red wizard
    wizard2Graphics.fillCircle(16, 16, 16);
    wizard2Graphics.generateTexture('wizard2', 32, 32);

    const fireballGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    fireballGraphics.fillStyle(0xffe066); 
    fireballGraphics.fillCircle(8, 8, 8);
    fireballGraphics.lineStyle(2, 0xff4500);
    fireballGraphics.strokeCircle(8, 8, 8);
    fireballGraphics.generateTexture('fireball', 16, 16);

    const groundGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    groundGraphics.fillStyle(0x2f4f4f);
    groundGraphics.fillRect(0, 0, 800, 32);
    groundGraphics.generateTexture('ground', 800, 32);
}

function create() {
    // UI
    turnText = this.add.text(400, 30, 'Wizard 1\'s Turn', {
        fontSize: '32px',
        fontWeight: 'bold',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6
    }).setOrigin(0.5);

    // Platforms
    platforms = this.physics.add.staticGroup();
    platforms.create(400, 584, 'ground').refreshBody();
    platforms.create(150, 480, 'ground').setScale(0.2, 1).refreshBody();
    platforms.create(650, 480, 'ground').setScale(0.2, 1).refreshBody();
    platforms.create(400, 400, 'ground').setScale(0.2, 1).refreshBody();

    // Wizards
    for (let i = 0; i < 2; i++) {
        wizards[i] = this.physics.add.sprite(i === 0 ? 100 : 700, 400, i === 0 ? 'wizard1' : 'wizard2');
        wizards[i].setBounce(0.1);
        wizards[i].setCollideWorldBounds(true);
        wizards[i].setData('id', i);
        wizards[i].setData('hp', 100);
        this.physics.add.collider(wizards[i], platforms);

        // Graphics for health bar background
        const barBg = this.add.rectangle(0, 0, 40, 6, 0x000000);
        const barValue = this.add.rectangle(0, 0, 40, 6, 0x00ff00);
        healthBars[i] = { bg: barBg, value: barValue };
    }

    fireballs = this.physics.add.group();
    
    // Collisions
    this.physics.add.collider(fireballs, platforms, (f) => f.destroy());
    this.physics.add.overlap(fireballs, wizards, (f, w) => {
        if (isFired && w.getData('id') !== currentTurn) {
            f.destroy();
            updateHP(w, 25);
        }
    });

    cursors = this.input.keyboard.createCursorKeys();
    turnArrow = this.add.triangle(0, 0, -10, -40, 10, -40, 0, -20, 0x00ff00);
    
    this.input.on('pointerdown', (pointer) => {
        if (!isFired) {
            const wizard = wizards[currentTurn];
            const fireball = fireballs.create(wizard.x, wizard.y - 10, 'fireball');
            const angle = Phaser.Math.Angle.Between(wizard.x, wizard.y - 10, pointer.x, pointer.y);
            const speed = 600;
            
            fireball.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            fireball.setGravityY(400);
            
            isFired = true;
            wizard.setVelocityX(0);

            // Timeout if it goes off screen or gets stuck
            this.time.delayedCall(4000, () => {
                if (fireball.active) fireball.destroy();
            });
        }
    });
}

function update() {
    const activeWizard = wizards[currentTurn];
    
    // Update Arrow and Health Bars
    turnArrow.x = activeWizard.x;
    turnArrow.y = activeWizard.y - 20;

    for (let i = 0; i < 2; i++) {
        const w = wizards[i];
        const bar = healthBars[i];
        bar.bg.x = w.x;
        bar.bg.y = w.y - 30;
        bar.value.x = w.x;
        bar.value.y = w.y - 30;
        bar.value.width = (w.getData('hp') / 100) * 40;
        bar.value.fillColor = w.getData('hp') > 30 ? 0x00ff00 : 0xff0000;
    }

    if (!isFired) {
        if (cursors.left.isDown) activeWizard.setVelocityX(-140);
        else if (cursors.right.isDown) activeWizard.setVelocityX(140);
        else activeWizard.setVelocityX(0);

        if (cursors.up.isDown && activeWizard.body.touching.down) activeWizard.setVelocityY(-350);
    } else {
        activeWizard.setVelocityX(0);
        if (fireballs.countActive(true) === 0) {
            switchTurn();
        }
    }
}

function updateHP(wizard, damage) {
    let hp = wizard.getData('hp');
    hp = Math.max(0, hp - damage);
    wizard.setData('hp', hp);
    
    if (hp === 0) {
        wizard.setTint(0x333333);
        console.log('Wizard ' + (wizard.getData('id') + 1) + ' defeated!');
    }
}

function switchTurn() {
    currentTurn = (currentTurn + 1) % wizards.length;
    isFired = false;
    turnText.setText('Wizard ' + (currentTurn + 1) + '\'s Turn');
}

const gameInstance = new Phaser.Game(config);
