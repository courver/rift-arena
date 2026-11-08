import Phaser from 'phaser';
import { H, SIM, W } from './config';
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
  scene: [BootScene, MenuScene, GameScene, UpgradeScene, PauseScene, EndScene],
});

// ?bot&sim: drive the game with fixed 60 Hz headless steps instead of requestAnimationFrame,
// so balance simulations run as fast as the CPU allows, even in a background tab.
if (SIM) {
  game.events.once('ready', () => {
    game.loop.stop();
    game.loop.resume = () => {};
    game.loop.wake = () => {};
    let t = performance.now();
    setInterval(() => {
      const until = performance.now() + 40;
      while (performance.now() < until) {
        t += 1000 / 60;
        game.headlessStep(t, 1000 / 60);
      }
    }, 0);
  });
}
