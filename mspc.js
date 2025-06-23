require('dotenv').config();
const { spawn } = require('child_process');

const scripts = [
  { name: 'Burn Energy', path: 'burn.js', alwaysRun: true },
  { name: 'Maps Event', path: 'maps.js', envKey: 'LP_MAPS_URL' },
  { name: 'Slots Event', path: 'slots.js', envKey: 'LP_SLOTS_URL' },
  { name: 'Memory Event', path: 'memory.js', envKey: 'LP_MEMORY_URL' },
];

(async () => {
  for (const script of scripts) {
    const shouldRun =
      script.alwaysRun || (process.env[script.envKey] && process.env[script.envKey] !== '0');

    if (!shouldRun) {
      console.log(`⏭️ ${script.name} skipped (not active or URL = 0)`);
      continue;
    }

    console.log(`\n🚀 Starting: ${script.name}`);

    await new Promise((resolve) => {
      const proc = spawn('node', [script.path], { stdio: 'inherit' });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${script.name} finished successfully.`);
        } else {
          console.log(`❌ ${script.name} exited with error code ${code}`);
        }
        resolve();
      });
    });
  }

  console.log(`\n🎉 All scripts done.`);
})();
