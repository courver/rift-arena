import Phaser from 'phaser';
import { H, LAB, SIM, W } from './config';
import { startLab } from './lab';
import { BootScene } from './scenes/BootScene';
import { EndScene } from './scenes/EndScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { UpgradeScene } from './scenes/UpgradeScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#0b0d16',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // joystick + skill button at the same time
  input: { activePointers: 3 },
  scene: [BootScene, MenuScene, GameScene, UpgradeScene, PauseScene, EndScene],
});

// exposed for debugging and automated checks
(window as unknown as { __phaser: Phaser.Game }).__phaser = game;

// ?bot&sim: drive the game with fixed 60 Hz headless steps instead of requestAnimationFrame,
// so balance simulations run as fast as the CPU allows, even in a background tab.
if (SIM) {
  game.events.once('ready', () => {
    game.loop.stop();
    game.loop.resume = () => {};
    game.loop.wake = () => {};
    let t = performance.now();
    const w = window as unknown as { __simPaused?: boolean };
    setInterval(() => {
      if (w.__simPaused) return;
      const until = performance.now() + 40;
      while (performance.now() < until) {
        t += 1000 / 60;
        game.headlessStep(t, 1000 / 60);
      }
    }, 0);
  });
}

if (LAB) startLab();
