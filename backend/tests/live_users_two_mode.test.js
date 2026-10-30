import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { liveUsersService, LiveUsersService } from '../services/liveUsersService.js';
import { metricsService } from '../services/metrics.js';
import LiveUsersConfig from '../models/LiveUsersConfig.js';

test('Mode A: Real Live Users reflects genuine deduplicated sessions', async () => {
  const service = new LiveUsersService();
  const mockMetrics = {
    getSnapshot: () => ({ activeVisitors: 7, activeAuthenticatedUsers: 3 })
  };
  service.init({ io: null, metricsService: mockMetrics });

  await service.updateConfig({ mode: 'real' });
  assert.equal(service.mode, 'real');

  const publicDisplay = service.getPublicDisplayCount();
  assert.equal(publicDisplay.count, 7, 'Mode A must display the genuine live visitor count');

  const adminConfig = service.getAdminConfig();
  assert.equal(adminConfig.realLiveCount, 7);
  assert.equal(adminConfig.currentDisplayCount, 7);
  assert.equal(adminConfig.mode, 'real');

  service.destroy();
});

test('Mode B: Validation of Minimum and Maximum user range', async () => {
  const service = new LiveUsersService();
  service.init({ io: null, metricsService: null });

  // 1. Rejects maxUsers < minUsers
  await assert.rejects(
    async () => {
      await service.updateConfig({ mode: 'manual', minUsers: 1000, maxUsers: 200 });
    },
    /greater than or equal to minimum users/i
  );

  // 2. Rejects negative numbers
  await assert.rejects(
    async () => {
      await service.updateConfig({ mode: 'manual', minUsers: -5, maxUsers: 100 });
    },
    /non-negative/i
  );

  // 3. Rejects invalid mode
  await assert.rejects(
    async () => {
      await service.updateConfig({ mode: 'invalid_mode' });
    },
    /must be either 'real' or 'manual'/i
  );

  // 4. Accepts valid range
  const validConfig = await service.updateConfig({
    mode: 'manual',
    minUsers: 300,
    maxUsers: 600
  });

  assert.equal(validConfig.mode, 'manual');
  assert.equal(validConfig.minUsers, 300);
  assert.equal(validConfig.maxUsers, 600);
  assert.ok(
    validConfig.currentDisplayCount >= 300 && validConfig.currentDisplayCount <= 600,
    `Display count ${validConfig.currentDisplayCount} must be within [300, 600]`
  );

  service.destroy();
});

test('Mode B: Public display hides admin configuration and stays in range', async () => {
  const service = new LiveUsersService();
  const mockMetrics = {
    getSnapshot: () => ({ activeVisitors: 2 })
  };
  service.init({ io: null, metricsService: mockMetrics });

  await service.updateConfig({
    mode: 'manual',
    minUsers: 800,
    maxUsers: 1200
  });

  const publicOutput = service.getPublicDisplayCount();
  assert.ok(typeof publicOutput.count === 'number');
  assert.equal(publicOutput.mode, undefined, 'Public output must NEVER expose mode');
  assert.equal(publicOutput.minUsers, undefined, 'Public output must NEVER expose minUsers');
  assert.equal(publicOutput.maxUsers, undefined, 'Public output must NEVER expose maxUsers');
  assert.equal(publicOutput.realLiveCount, undefined, 'Public output must NEVER expose realLiveCount');

  assert.ok(
    publicOutput.count >= 800 && publicOutput.count <= 1200,
    `Count ${publicOutput.count} must be within [800, 1200]`
  );

  service.destroy();
});

test('Mode B: Realistic natural drift avoids sudden wild fluctuations', async () => {
  const service = new LiveUsersService();
  service.init({ io: null, metricsService: null });

  await service.updateConfig({
    mode: 'manual',
    minUsers: 500,
    maxUsers: 550
  });

  let previous = service.getPublicDisplayCount().count;

  // Run 15 ticks to test drift
  for (let i = 0; i < 15; i++) {
    service.applySmoothManualDrift();
    const current = service.getPublicDisplayCount().count;

    assert.ok(
      current >= 500 && current <= 550,
      `Drifted count ${current} must remain strictly within [500, 550]`
    );

    const stepDelta = Math.abs(current - previous);
    assert.ok(
      stepDelta <= 20,
      `Step fluctuation ${stepDelta} between ${previous} and ${current} should be gradual, not wild`
    );
    previous = current;
  }

  service.destroy();
});

test('Immediate synchronization when toggling between Mode A and Mode B', async () => {
  const service = new LiveUsersService();
  const mockMetrics = {
    getSnapshot: () => ({ activeVisitors: 14 })
  };
  service.init({ io: null, metricsService: mockMetrics });

  // 1. Activate manual mode
  await service.updateConfig({ mode: 'manual', minUsers: 900, maxUsers: 1100 });
  const manualCount = service.getPublicDisplayCount().count;
  assert.ok(manualCount >= 900 && manualCount <= 1100);

  // 2. Switch back to Real Live Users immediately
  await service.updateConfig({ mode: 'real' });
  const realCount = service.getPublicDisplayCount().count;
  assert.equal(realCount, 14, 'Switching to real mode must immediately yield genuine count 14');

  service.destroy();
});

test('Internal analytics metrics purity: manual mode does not alter metricsService', async () => {
  const snapshotBefore = metricsService.getSnapshot();
  const service = new LiveUsersService();
  service.init({ io: null, metricsService });

  await service.updateConfig({ mode: 'manual', minUsers: 10000, maxUsers: 20000 });

  const snapshotAfter = metricsService.getSnapshot();
  assert.equal(
    snapshotAfter.activeVisitors,
    snapshotBefore.activeVisitors,
    'Internal active visitors count in metricsService must remain unchanged'
  );
  assert.equal(
    snapshotAfter.requestsTotal,
    snapshotBefore.requestsTotal,
    'Total request counts must remain authentic and unpolluted'
  );

  service.destroy();
});


test('Mode A: Strict immunity against random drift across time ticks (never changes to 100 or random value)', async () => {
  const service = new LiveUsersService();
  let liveCount = 3;
  const mockMetrics = {
    getSnapshot: () => ({ activeVisitors: liveCount })
  };
  service.init({ io: null, metricsService: mockMetrics });

  await service.updateConfig({ mode: 'real' });
  assert.equal(service.timer, null, 'Periodic drift timer must be null in Real mode');

  // Simulate 20 tick cycles (equivalent to 15+ minutes)
  for (let i = 0; i < 20; i++) {
    service.tick();
    assert.equal(
      service.getPublicDisplayCount().count,
      3,
      `Tick ${i}: Count must remain strictly at genuine count 3, never 100 or drift`
    );
  }

  // Simulate dynamic session joins and leaves
  liveCount = 5; // +2 visitors
  assert.equal(service.getPublicDisplayCount().count, 5, 'Dynamic visitor increase must reflect immediately');

  liveCount = 1; // -4 visitors
  assert.equal(service.getPublicDisplayCount().count, 1, 'Dynamic visitor decrease must reflect immediately');

  service.destroy();
});

test('Switching from Manual to Real immediately halts timer and wipes manual display value', async () => {
  const service = new LiveUsersService();
  const mockMetrics = {
    getSnapshot: () => ({ activeVisitors: 2 })
  };
  service.init({ io: null, metricsService: mockMetrics });

  // 1. In manual mode, timer is active and display is generated in range
  await service.updateConfig({ mode: 'manual', minUsers: 500, maxUsers: 1000 });
  assert.ok(service.timer !== null, 'Timer must be active in manual mode');
  const manualVal = service.getPublicDisplayCount().count;
  assert.ok(manualVal >= 500 && manualVal <= 1000);

  // 2. Switch to Real mode
  await service.updateConfig({ mode: 'real' });
  assert.equal(service.timer, null, 'Timer must be stopped immediately upon switching to Real mode');
  assert.equal(service.getPublicDisplayCount().count, 2, 'Display value must immediately reset to verified count 2');

  service.destroy();
});
