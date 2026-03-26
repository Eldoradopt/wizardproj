# Wizard Worms - Discord Activity

A Worms-like turn-based game featuring wizards, built with Phaser 3 and the Discord Embedded App SDK.

## Phase 1: Basic Features
- Turn-based movement and firing.
- Wizard characters with health bars.
- Fireball projectile with physics.
- Simple environment platforms.

## How to Run Locally

Since this project uses ES modules and CDNs, you can run it using a simple local web server.

1.  Open a terminal in the project directory.
2.  Run the following command (requires Python):
    ```bash
    python -m http.server 8080
    ```
3.  Open your browser and navigate to `http://localhost:8080`.

## Controls
- **Arrows / WASD**: Move and Jump.
- **Left Click**: Fire fireball at mouse cursor.
- **Goal**: Reduce the other wizard's health to zero!

## Coming in Phase 2
- **Destructible Terrain**: Use spells to blast holes in the map!
- **More Spells**: Blink, Shield, Meteor, and more.
- **Discord Integration**: Real multiplayer using Discord's networking.
- **Better Visuals**: Wizard sprites, particle effects for fireballs, and varied maps.
