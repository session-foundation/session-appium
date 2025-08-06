"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var dispatcher_exports = {};
__export(dispatcher_exports, {
  Dispatcher: () => Dispatcher
});
module.exports = __toCommonJS(dispatcher_exports);
var import_utils = require("playwright-core/lib/utils");
var import_utils2 = require("playwright-core/lib/utils");
var import_rebase = require("../../node_modules/playwright/lib/runner/rebase");
var import_workerHost = require("../../node_modules/playwright/lib/runner/workerHost");
var import_ipc = require("../../node_modules/playwright/lib/common/ipc");
const Redis = require('redis');

// Redis connection singleton
let redisClient = null;
let redisInitPromise = null;

async function getRedis() {
  if (redisClient) return redisClient;
  
  if (!redisInitPromise) {
    redisInitPromise = (async () => {
      redisClient = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      
      redisClient.on('error', (err) => console.error('Redis Client Error', err));
      await redisClient.connect();
      console.log('✅ [REDIS] Connected to Redis');
      
      return redisClient;
    })();
  }
  
  return await redisInitPromise;
}

class Dispatcher {
  constructor(config, reporter, failureTracker) {
    this._workerSlots = [];
    this._queue = [];
    this._workerLimitPerProjectId = /* @__PURE__ */ new Map();
    this._queuedOrRunningHashCount = /* @__PURE__ */ new Map();
    this._finished = new import_utils.ManualPromise();
    this._isStopped = true;
    this._extraEnvByProjectId = /* @__PURE__ */ new Map();
    this._producedEnvByProjectId = /* @__PURE__ */ new Map();
    this._config = config;
    this._reporter = reporter;
    this._failureTracker = failureTracker;
    this._devicePoolMinAvailable = [];
    this._statusLogInterval = null;

    
    // Dynamic worker configuration
    this._maxWorkers = this._config.config.workers || 12;
    this._minWorkers = 1;
    this._workerIdleTimeout = 10000;
    this._lastWorkerActivity = new Map();
    this._dynamicWorkerScaling = this._config.config.dynamicWorkerScaling !== false;
    
    console.log(`🎯 [WORKERS] Dynamic scaling enabled: ${this._minWorkers}-${this._maxWorkers} workers`);
    
    for (const project of config.projects) {
      if (project.workers)
        this._workerLimitPerProjectId.set(project.id, project.workers);
    }
    
    // Device pool configuration
    const configuredPoolSize = this._config.config.devicePoolSize || 
                              parseInt(process.env.PLAYWRIGHT_DEVICE_POOL_SIZE) || 
                              12;
    
    const actualDeviceCount = this._detectIosDeviceCount();
    const devicePoolSize = Math.min(configuredPoolSize, actualDeviceCount);
    
    if (actualDeviceCount < configuredPoolSize) {
      console.warn(
        `⚠️  [DEVICE_POOL] Configured pool size (${configuredPoolSize}) exceeds actual available devices (${actualDeviceCount}). ` +
        `Using ${devicePoolSize} devices.`
      );
    }
    
    this._completedTests = 0;
    
    this._devicePoolSize = devicePoolSize;
    this._devicePool = {
      total: devicePoolSize,
      available: devicePoolSize,
      stats: {
        totalAllocated: 0,
        totalQueued: 0,
        maxQueueSize: 0,
        totalWaitTime: 0,
        waitCounts: 0,
      }
    };

    // Redis keys
    this._redisKeys = {
      devicesAvailable: 'playwright:devices:available',
      devicesAllocations: 'playwright:devices:allocations',
      staggerLock: 'playwright:stagger:lock',
      stats: 'playwright:stats'
    };
  }

    // Fix 3: Debug why only 1 device is available
    async _initializeRedis() {
      this._redis = await getRedis();
      
      // Clean up any previous state
      try {
        const keysToDelete = [
          this._redisKeys.devicesAvailable,
          this._redisKeys.devicesAllocations,
          this._redisKeys.staggerLock,
          this._redisKeys.stats
        ];
        
    // Also clean up any cooldown keys from previous runs
    for (let i = 0; i < this._devicePoolSize; i++) {
      keysToDelete.push(`playwright:cooldown:${i}`);
    }

        if (keysToDelete.every(key => key !== undefined)) {
          await this._redis.del(...keysToDelete);
        }
      } catch (err) {
        console.error('❌ Error deleting keys:', err);
      }
      
      // Initialize device pool in Redis
      
      if (!this._devicePoolSize || this._devicePoolSize <= 0) {
        console.error('❌ Invalid device pool size:', this._devicePoolSize);
        return;
      }
      
      const devices = Array.from({ length: this._devicePoolSize }, (_, i) => String(i));
      
      if (devices.length > 0 && this._redisKeys.devicesAvailable) {
        // Try without spread operator
        await this._redis.rPush(this._redisKeys.devicesAvailable, devices);
      }

      // Verify what we actually have
      const finalCount = await this._redis.lLen(this._redisKeys.devicesAvailable);
      console.log(`🎮 [DEVICE_POOL] Initialized ${this._devicePoolSize} devices in Redis (verified: ${finalCount})`);
      
      if (finalCount !== this._devicePoolSize) {
        console.error(`❌ [DEVICE_POOL] Mismatch! Expected ${this._devicePoolSize} but have ${finalCount}`);
      }
    }


  _detectIosDeviceCount() {
    console.log('🔍 [DEVICE_DETECT] Checking iOS devices...');
    let actualCount = 0;
    
    for (let i = 1; i <= 12; i++) {
      const envVar = `IOS_${i}_SIMULATOR`;
      const udid = process.env[envVar];
      
      if (udid && this._isValidIosUdid(udid)) {
        actualCount++;
      }
    }
    
    console.log(`🔍 [DEVICE_POOL] Detected ${actualCount} actual iOS devices`);
    return actualCount;
  }

  _isValidIosUdid(udid) {
    return /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(udid);
  }

async _scheduleJob() {
  console.log('🔍 [DEBUG] Entering _scheduleJob');
  
  if (this._isStopped) {
    console.log('🔍 [DEBUG] Stopped, returning');
    return;
  }
  
  try {
    const availableDevices = await this._redis.lLen(this._redisKeys.devicesAvailable);
    console.log(`\n🔄 [SCHEDULER] Running scheduler (${availableDevices}/${this._devicePoolSize} devices available)`);
    
    // Check if we have any jobs in queue
    if (this._queue.length === 0) {
      console.log('📭 [SCHEDULER] No jobs in queue');
      return;
    }
    
    // Process the queue - this should handle scheduling
    await this._processLocalQueue();
    
  } catch (err) {
    console.error('❌ Error in _scheduleJob:', err);
    throw err;
  }
}


  async _processLocalQueue() {
  if (this._processingQueue) {
    return;
  }
  
  this._processingQueue = true;
  
  try {
    if (this._queue.length === 0) {
      return;
    }
    
    const availableDevices = await this._redis.lLen(this._redisKeys.devicesAvailable);
    
    console.log(`📋 [QUEUE] Processing ${this._queue.length} jobs, ${availableDevices} devices available`);
    
    // Debug: Show what's at the front of the queue
    if (this._queue.length > 0) {
      const firstJob = this._queue[0];
      const firstDevices = this._getJobDeviceRequirement(firstJob);
      console.log(`   First job needs ${firstDevices} devices: "${firstJob.tests?.[0]?.title?.substring(0, 40)}..."`);
    }
    
    const minDevicesNeeded = Math.min(...this._queue.map(job => this._getJobDeviceRequirement(job) || 1));
    
    if (availableDevices < minDevicesNeeded) {
      if (!this._lastNoDevicesLog || Date.now() - this._lastNoDevicesLog > 5000) {
        console.log(`⏸️  [QUEUE] Skipping - need at least ${minDevicesNeeded} devices, have ${availableDevices}`);
        this._lastNoDevicesLog = Date.now();
      }
      return;
    }
    
    // Find ONE job to schedule
    let scheduledIndex = -1;
    let hitCooldown = false;
    
    for (let i = 0; i < this._queue.length; i++) {
      const job = this._queue[i];
      const devices = this._getJobDeviceRequirement(job);
      
      // Skip if not enough devices
      if (devices > availableDevices) {
        continue;
      }
      
      // Skip if project limits exceeded
      if (!this._canRunBasedOnProjectLimits(job)) {
        continue;
      }
      
      // Try to schedule this job
      const result = await this._tryScheduleJob(job, devices);
      
      if (result === 'cooldown') {
        // Hit cooldown, stop trying other jobs
        hitCooldown = true;
        console.log(`🧊 [QUEUE] Devices in cooldown, stopping queue processing`);
        break;
      } else if (result === true) {
        console.log(`✅ [SCHEDULER] Scheduled job ${i + 1}/${this._queue.length} (${devices} devices)`);
        scheduledIndex = i;
        break;
      }
    }
    
    // Update queue by removing the scheduled job
    if (scheduledIndex >= 0) {
      this._queue.splice(scheduledIndex, 1);
    }
    
  } finally {
    this._processingQueue = false;
  }
}
// Separate method to process queue with known device count
async _processQueueWithDevices(availableDevices) {
  const minDevicesNeeded = Math.min(...this._queue.map(job => this._getJobDeviceRequirement(job) || 1));
  
  if (availableDevices < minDevicesNeeded) {
    if (!this._lastNoDevicesLog || Date.now() - this._lastNoDevicesLog > 5000) {
      console.log(`⏸️  [QUEUE] Skipping - need at least ${minDevicesNeeded} devices, have ${availableDevices}`);
      this._lastNoDevicesLog = Date.now();
    }
    return;
  }
  
  // Find ONE job to schedule
  let scheduledIndex = -1;
  
  for (let i = 0; i < this._queue.length; i++) {
    const job = this._queue[i];
    const devices = this._getJobDeviceRequirement(job);
    
    // Skip if not enough devices
    if (devices > availableDevices) {
      continue;
    }
    
    // Skip if project limits exceeded
    if (!this._canRunBasedOnProjectLimits(job)) {
      continue;
    }
    
    // Try to schedule this job
    if (await this._tryScheduleJob(job, devices)) {
      console.log(`✅ [SCHEDULER] Scheduled job ${i + 1}/${this._queue.length} (${devices} devices)`);
      scheduledIndex = i;
      break;
    }
  }
  
  // Update queue by removing the scheduled job
  if (scheduledIndex >= 0) {
    this._queue.splice(scheduledIndex, 1);
  }
}

// Also optimize the early exit check to be more efficient
async _scheduleJob() {
  if (this._isStopped) return;
  
  // Prevent concurrent scheduling
  if (this._scheduling) {
    return;
  }
  
  this._scheduling = true;
  
  try {
    // Quick check if we have any free workers
    const hasIdleWorker = this._workerSlots.some(w => !w.busy);
    if (!hasIdleWorker) {
      return;
    }
    
    const availableDevices = await this._redis.lLen(this._redisKeys.devicesAvailable);
    
    if (availableDevices === 0 && this._queue.length > 0) {
      if (!this._lastNoDevicesLog || Date.now() - this._lastNoDevicesLog > 5000) {
        console.log('🔄 [SCHEDULER] No devices available');
        this._lastNoDevicesLog = Date.now();
      }
      return;
    }
    
    // Process the queue
    await this._processLocalQueue();
    
  } catch (err) {
    console.error('❌ Error in _scheduleJob:', err);
  } finally {
    this._scheduling = false;
  }
}



  _canRunBasedOnProjectLimits(job) {
    const projectIdWorkerLimit = this._workerLimitPerProjectId.get(job.projectId);
    if (!projectIdWorkerLimit) return true;
    
    const runningWorkersWithSameProjectId = this._workerSlots.filter(
      (w) => w.busy && w.worker && w.worker.projectId() === job.projectId
    ).length;
    
    return runningWorkersWithSameProjectId < projectIdWorkerLimit;
  }

async _tryScheduleJob(job, devices) {
  const firstTest = job.tests?.[0];
  
  // Validate device requirement
  if (devices > this._devicePoolSize) {
    console.error(`❌ [ERROR] Job requires ${devices} devices but only ${this._devicePoolSize} exist`);
    this._failJobWithErrors(job, [{ 
      message: `Test requires ${devices} devices but pool only has ${this._devicePoolSize}` 
    }]);
    return true;
  }
  
  // Check device availability
  const availableDevices = await this._redis.lLen(this._redisKeys.devicesAvailable);
  if (devices > availableDevices) {
    return false;
  }
  
  // Find available worker
  let workerIndex = this._workerSlots.findIndex(
    (w) => !w.busy && w.worker && w.worker.hash() === job.workerHash && !w.worker.didSendStop()
  );
  if (workerIndex === -1) {
    workerIndex = this._workerSlots.findIndex((w) => !w.busy);
  }
  
  if (workerIndex === -1) {
    return false;
  }
  
  console.log(`🎯 [SCHEDULE] Assigning "${firstTest?.title?.substring(0, 40)}..." (${devices} devices) to worker ${workerIndex}`);
  
  // Allocate devices from Redis
  if (devices > 0) {
    const allocatedIndices = await this._allocateDeviceIndices(devices);
    if (!allocatedIndices) return 'cooldown';
    
    // Update available count
    const availableNow = await this._redis.lLen(this._redisKeys.devicesAvailable);
    this._devicePool.available = availableNow;
    
    // Store allocation
    const allocationKey = `worker-${workerIndex}`;
    const allocationData = {
      devices: allocatedIndices,
      jobId: job.id || 'unknown'
    };
    
    await this._redis.hSet(
      this._redisKeys.devicesAllocations,
      allocationKey,
      JSON.stringify(allocationData)
    );
    
    job.allocatedDevices = allocatedIndices;
    console.log(`🔒 [DEVICES] Worker ${workerIndex} allocated devices: ${allocatedIndices.join(', ')}`);
    
    // Track stats
    this._devicePoolMinAvailable.push(this._devicePool.available);
    this._devicePool.stats.totalAllocated++;
  }
  
  // Set up job dispatcher
  const jobDispatcher = new JobDispatcher(
    job,
    this._reporter,
    this._failureTracker,
    () => this.stop().catch(() => {})
  );
  
  this._workerSlots[workerIndex].busy = true;
  this._workerSlots[workerIndex].jobDispatcher = jobDispatcher;
  
  // Run job
  void this._runJobInWorker(workerIndex, jobDispatcher).then(async () => {
    // Cleanup
    this._workerSlots[workerIndex].jobDispatcher = void 0;
    this._workerSlots[workerIndex].busy = false;
    
    // Release devices back to Redis
    await this._deallocateDevices(workerIndex);
    
    // Schedule next job after a small delay to avoid race conditions
    setTimeout(() => {
      if (!this._isStopped) {
        this._scheduleJob();
      }
    }, 100);
    
    this._checkFinished();
  });
  
  return true;
}


  async _checkStagger(devices) {
  const staggerKey = `${this._redisKeys.staggerLock}:${devices}`;
  const interval = devices === 4 ? 30000 : 20000;
  
  
  try {
    // Redis v4 syntax - use NX option object
    const result = await this._redis.set(
      staggerKey,
      String(Date.now()),
      {
        PX: interval,
        NX: true
      }
    );
    
    if (result === 'OK') {
      console.log(`✅ [STAGGER] Acquired lock for ${devices}-device test`);
      return true;
    }
    
    // Check TTL to see how long to wait
    const ttl = await this._redis.pTTL(staggerKey);
    if (ttl > 0) {
      console.log(`⏳ [STAGGER] Must wait ${(ttl/1000).toFixed(1)}s for ${devices}-device test`);
    }
    
    return false;
  } catch (err) {
    console.error('❌ Error in _checkStagger:', err);
    // If Redis syntax fails, try old syntax as fallback
    try {
      const result = await this._redis.setNX(staggerKey, String(Date.now()));
      if (result) {
        await this._redis.pExpire(staggerKey, interval);
        console.log(`✅ [STAGGER] Acquired lock for ${devices}-device test (fallback)`);
        return true;
      }
    } catch (fallbackErr) {
      console.error('❌ Fallback also failed:', fallbackErr);
    }
    return false;
  }
}

async _deallocateDevices(workerIndex) {
  const allocationKey = `worker-${workerIndex}`;
  const allocation = await this._redis.hGet(this._redisKeys.devicesAllocations, allocationKey);
  
  if (allocation) {
    const data = JSON.parse(allocation);
    const devices = data.devices || data;
    
    if (devices.length > 0) {
      // Quarantine ALL devices for 2 seconds to ensure Appium cleanup
      const cooldownTime = 2;
      console.log(`🧊 [COOLDOWN] Devices ${devices.join(', ')} entering ${cooldownTime}s cooldown period`);
      
      // Set quarantine flags with TTL
      const cooldownPromises = devices.map(device => 
        this._redis.setEx(`playwright:cooldown:${device}`, cooldownTime, `from-worker-${workerIndex}`)
      );
      await Promise.all(cooldownPromises);
      
      // Add back to available pool (they're available but cooling down)
      await this._redis.rPush(this._redisKeys.devicesAvailable, devices.map(String));
    }
    
    await this._redis.hDel(this._redisKeys.devicesAllocations, allocationKey);
    
    const availableNow = await this._redis.lLen(this._redisKeys.devicesAvailable);
    this._devicePool.available = availableNow;
    
    console.log(`🔓 [DEVICES] Worker ${workerIndex} released ${devices.length} devices: ${devices.join(', ')} (pool now has ${availableNow})`);
  }
}


async _allocateDeviceIndices(count) {
  const allocated = [];
  const attempted = new Set(); // Track what we've tried to avoid infinite loops
  
  while (allocated.length < count) {
    // Get all available devices at once to see our options
    const availableCount = await this._redis.lLen(this._redisKeys.devicesAvailable);
    
    if (availableCount === 0) {
      // No devices at all
      if (allocated.length > 0) {
        await this._redis.rPush(this._redisKeys.devicesAvailable, allocated.map(String));
      }
      return null;
    }
    
    // Try to find a device not in cooldown
    let foundDevice = null;
    let skippedDevices = [];
    
    // Pop devices until we find one not in cooldown
    for (let i = 0; i < availableCount && !foundDevice; i++) {
      const device = await this._redis.lPop(this._redisKeys.devicesAvailable);
      if (!device) break;
      
      // Check if we've already tried this device
      if (attempted.has(device)) {
        skippedDevices.push(device);
        continue;
      }
      
      attempted.add(device);
      
      // Check cooldown
      const cooldownKey = `playwright:cooldown:${device}`;
      const inCooldown = await this._redis.exists(cooldownKey);
      
      if (inCooldown) {
        const ttl = await this._redis.ttl(cooldownKey);
        console.log(`🧊 [ALLOC] Device ${device} in cooldown for ${ttl}s more`);
        skippedDevices.push(device);
      } else {
        foundDevice = device;
      }
    }
    
    // Put skipped devices back
    if (skippedDevices.length > 0) {
      await this._redis.rPush(this._redisKeys.devicesAvailable, skippedDevices);
    }
    
    if (!foundDevice) {
      // All devices are in cooldown
      console.log(`⏳ [ALLOC] All available devices in cooldown, waiting...`);
      
      // Return what we have so far
      if (allocated.length > 0) {
        await this._redis.rPush(this._redisKeys.devicesAvailable, allocated.map(String));
      }
      return null;
    }
    
    allocated.push(parseInt(foundDevice));
  }
  
  console.log(`✅ [ALLOC] Allocated devices: [${allocated.join(', ')}]`);
  return allocated;
}
  _isDeviceHealthy(deviceIndex) {
    // For iOS devices, check if the simulator UDID is still valid
    const udid = process.env[`IOS_${deviceIndex + 1}_SIMULATOR`];
    
    if (!udid || !this._isValidIosUdid(udid)) {
      console.warn(`⚠️  [DEVICE] Device ${deviceIndex} appears unhealthy (invalid UDID)`);
      return false;
    }
    
    return true;
  }

  async _getDeviceCooldownStatus() {
  const status = {};
  for (let i = 0; i < this._devicePoolSize; i++) {
    const cooldownKey = `playwright:cooldown:${i}`;
    const ttl = await this._redis.ttl(cooldownKey);
    if (ttl > 0) {
      status[i] = ttl;
    }
  }
  return status;
}
    _startTestTimeout(workerIndex, job) {
    // Longer timeout for CI and tests with multiple devices
    const devices = this._getJobDeviceRequirement(job);
    const baseTimeout = process.env.CI ? 600000 : 300000; // 10 min CI, 5 min local
    const deviceMultiplier = devices > 2 ? 1.5 : 1;
    const TEST_TIMEOUT = baseTimeout * deviceMultiplier;
    
    if (!this._timeouts) this._timeouts = new Map();
    
    const timeoutId = setTimeout(() => {
      console.error(`⏱️ [TIMEOUT] Test on worker ${workerIndex} exceeded ${TEST_TIMEOUT/1000}s`);
      this._handleTestTimeout(workerIndex);
    }, TEST_TIMEOUT);
    
    this._timeouts.set(workerIndex, timeoutId);
  }

  _clearTestTimeout(workerIndex) {
    if (this._timeouts && this._timeouts.has(workerIndex)) {
      clearTimeout(this._timeouts.get(workerIndex));
      this._timeouts.delete(workerIndex);
    }
  }

  _handleTestTimeout(workerIndex) {
    console.log(`🔥 [TIMEOUT] Handling timeout for worker ${workerIndex}`);
    
    const slot = this._workerSlots[workerIndex];
    if (slot && slot.worker) {
      void slot.worker.stop(true);
    }
    
    if (slot && slot.jobDispatcher) {
      slot.jobDispatcher.onExit({ 
        unexpectedly: true, 
        code: -1, 
        signal: 'TIMEOUT' 
      });
    }
    
    this._deallocateDevices(workerIndex);
    
    if (workerIndex < this._workerSlots.length && this._workerSlots[workerIndex]) {
      this._workerSlots[workerIndex].busy = false;
      this._workerSlots[workerIndex].jobDispatcher = void 0;
    }
    
    this._scheduleJob();
  }

_getJobDeviceRequirement(job) {
  const test = job.tests?.[0];
  if (!test) {
    console.warn('⚠️  [DEVICE] Job has no tests:', job);
    return 0;
  }
  
  const deviceMatch = test.title?.match(/@(\d+)-devices/);
  const devices = deviceMatch ? parseInt(deviceMatch[1]) : 0;
  
  // Debug log for first few calls
  if (!this._deviceReqLogCount) this._deviceReqLogCount = 0;
  if (this._deviceReqLogCount++ < 5) {
    console.log(`🔍 [DEVICE] Test "${test.title?.substring(0, 50)}..." requires ${devices} devices`);
  }
  
  return devices;
}

  _failJobWithErrors(job, errors) {
    for (const test of job.tests) {
      const result = test._appendTestResult();
      this._reporter.onTestBegin?.(test, result);
      result.errors = [...errors];
      result.error = result.errors[0];
      result.status = "failed";
      this._reporter.onTestEnd?.(test, result);
    }
  }

  async _runJobInWorker(index, jobDispatcher) {
  this._lastWorkerActivity.set(index, Date.now());
  const job = jobDispatcher.job;
  
  if (jobDispatcher.skipWholeJob()) return;
  
  let worker = this._workerSlots[index].worker;
  
  // Check if device allocation has changed for this worker
  const deviceAllocationChanged = worker && 
    JSON.stringify(worker.allocatedDevices || []) !== JSON.stringify(job.allocatedDevices || []);
  
  // Check if this is a new worker that needs creating
  const needsNewWorker = !worker || 
    worker.hash() !== job.workerHash || 
    worker.didSendStop() ||
    deviceAllocationChanged;
  
  if (needsNewWorker) {
    // Log why we're creating a new worker
    if (deviceAllocationChanged) {
      console.log(`🔄 [WORKER] Restarting worker ${index} due to device allocation change: ` +
        `${JSON.stringify(worker.allocatedDevices || [])} -> ${JSON.stringify(job.allocatedDevices || [])}`);
    }
    
    // Only apply stagger for initial workers on CI
    if (process.env.CI && !this._workerSlots[index].hasStarted && index < this._initialWorkerCount) {
      const staggerDelay = index * 30000; // 30s per worker
      if (staggerDelay > 0) {
        console.log(`⏳ [STAGGER] Worker ${index} waiting ${staggerDelay/1000}s before starting (CI simulator stagger)`);
        await new Promise(resolve => setTimeout(resolve, staggerDelay));
      }
    }
    this._workerSlots[index].hasStarted = true;
    
    if (worker) {
      await worker.stop();
      worker = void 0;
      if (this._isStopped) return;
    }
    
    worker = this._createWorker(job, index, (0, import_ipc.serializeConfig)(this._config, true));
    this._workerSlots[index].worker = worker;
    
    // Track allocated devices on the worker for comparison
    worker.allocatedDevices = job.allocatedDevices;
    
    worker.on("exit", () => this._workerSlots[index].worker = void 0);
    const startError = await worker.start();
    if (this._isStopped) return;
    
    if (startError) {
      jobDispatcher.onExit(startError);
      return;
    }
  }
  
  // Start timeout for the job
  this._startTestTimeout(index, job);
  
  jobDispatcher.runInWorker(worker);
  
  const result = await jobDispatcher.jobResult;
  console.log(`🔍 [RETRY_DEBUG] Job result: didFail=${result.didFail}, hasNewJob=${!!result.newJob}`);
  if (result.newJob) {
    console.log(`🔍 [RETRY_DEBUG] New retry job has ${result.newJob.tests.length} tests`);
  }
  
  // Clear timeout after job completes
  this._clearTestTimeout(index);
  
  this._updateCounterForWorkerHash(job.workerHash, -1);
  
  if (result.didFail) {
    void worker.stop(true);
  } else if (this._isWorkerRedundant(worker)) {
    void worker.stop();
  }
  
  if (!this._isStopped && result.newJob) {
    console.log(`➕ [RETRY_DEBUG] Adding retry job to queue for ${result.newJob.tests.length} tests`);
    this._queue.unshift(result.newJob);
    this._updateCounterForWorkerHash(result.newJob.workerHash, 1);
  } else if (result.newJob) {
    console.log(`❌ [RETRY_DEBUG] NOT adding retry job because _isStopped=${this._isStopped}`);
  }
  
  this._lastWorkerActivity.set(index, Date.now());
  
  // Cleanup
  this._workerSlots[index].jobDispatcher = void 0;
  this._workerSlots[index].busy = false;
  
  // Release devices back to Redis
  await this._deallocateDevices(index);
  
  // Wait a bit to ensure devices are properly released
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Schedule next job
  if (!this._isStopped) {
    this._scheduleJob();
  }
  
  this._checkFinished();
}

  async _checkFinished() {
    if (this._finished.isDone()) return;
    
    // Remove the undefined queueLength variable
    if (this._queue.length && !this._isStopped) return;
    if (this._workerSlots.some((w) => w.busy)) return;
    
    // Cleanup
    if (this._statusLogInterval) {
      clearInterval(this._statusLogInterval);
      this._statusLogInterval = null;
    }
    
    if (this._workerManagementInterval) {
      clearInterval(this._workerManagementInterval);
      this._workerManagementInterval = null;
    }
    
    // Log final stats
    console.log("\n📊 [STATS] Final Statistics:");
    console.log(`    Total device allocations: ${this._devicePool.stats.totalAllocated || 0}`);
    console.log(`    Device pool size: ${this._devicePoolSize}`);
    if (this._devicePoolMinAvailable.length > 0) {
      console.log(`    Min available devices during run: ${Math.min(...this._devicePoolMinAvailable)}`);
    }
    console.log(`    Total tests completed: ${this._completedTests || 0}`);
    console.log(`    Final worker count: ${this._workerSlots.length}`);
    
    console.log("\n✅ [DISPATCHER] All tests completed successfully!");
    
    this._finished.resolve();
  }

  _isWorkerRedundant(worker) {
    let workersWithSameHash = 0;
    for (const slot of this._workerSlots) {
      if (slot.worker && !slot.worker.didSendStop() && slot.worker.hash() === worker.hash())
        workersWithSameHash++;
    }
    return workersWithSameHash > this._queuedOrRunningHashCount.get(worker.hash());
  }

  _updateCounterForWorkerHash(hash, delta) {
    this._queuedOrRunningHashCount.set(hash, delta + (this._queuedOrRunningHashCount.get(hash) || 0));
  }

  async run(testGroups, extraEnvByProjectId) {
  // Initialize Redis
  await this._initializeRedis();
  
  this._extraEnvByProjectId = extraEnvByProjectId;
  
  // Sort test groups by device requirement (First Fit Decreasing)
  const sortedGroups = this._optimizeTestOrder(testGroups);
  this._queue = [...sortedGroups];
  
  // Verify the queue order
  console.log('\n🔍 [QUEUE] Initial queue order verification:');
  this._queue.slice(0, 10).forEach((group, idx) => {
    const devices = this._getJobDeviceRequirement(group);
    const title = group.tests?.[0]?.title || 'Unknown';
    console.log(`    ${idx + 1}. ${devices}d: "${title.substring(0, 50)}..."`);
  });
  
  // Log summary
  console.log('\n🎬 [DISPATCHER] Starting run with test groups');
  const deviceCounts = {};
  this._queue.forEach(group => {
    const devices = this._getJobDeviceRequirement(group);
    deviceCounts[devices] = (deviceCounts[devices] || 0) + 1;
  });
  
  console.log(`📊 [SUMMARY] Device requirements:`);
  Object.entries(deviceCounts).forEach(([devices, count]) => {
    if (count > 0) {
      console.log(`    ${devices} devices: ${count} tests`);
    }
  });
  
  for (const group of testGroups) {
    this._updateCounterForWorkerHash(group.workerHash, 1);
  }
  
  this._isStopped = false;
  this._workerSlots = [];
  this._scheduling = false;
  this._processingQueue = false;
  this._adjustingWorkers = false;
  
  if (this._failureTracker.hasReachedMaxFailures()) {
    void this.stop();
  }
  
  // Calculate optimal initial workers
  const maxDeviceTest = Math.max(...this._queue.map(g => this._getJobDeviceRequirement(g)));
  const optimalInitialWorkers = Math.floor(this._devicePoolSize / maxDeviceTest) || 1;
  const initialWorkers = Math.min(this._maxWorkers, testGroups.length, optimalInitialWorkers);
  
  // Store initial worker count for stagger logic
  this._initialWorkerCount = initialWorkers;
  
  console.log(`🚀 [WORKERS] Starting with ${initialWorkers} workers (pool: ${this._devicePoolSize} devices, max test needs: ${maxDeviceTest} devices)`);
  
  if (process.env.CI) {
    console.log(`🎯 [CI] Simulator startup will be staggered for first ${initialWorkers} workers: Worker 0 starts immediately, then 30s delay per additional worker`);
  }
  
  // Create initial workers
  for (let i = 0; i < initialWorkers; i++) {
    this._workerSlots.push({ busy: false, hasStarted: false });
  }
  
  // Schedule initial jobs one by one
  for (let i = 0; i < initialWorkers; i++) {
    await this._scheduleJob();
    // Small delay between initial scheduling to avoid race conditions
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Start worker management after initial scheduling
  if (this._dynamicWorkerScaling) {
    setTimeout(() => {
      this._startWorkerManagement();
    }, 5000); // Give initial jobs time to start
  }
  
  this._checkFinished();
  await this._finished;
  
  // Cleanup Redis connection
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisInitPromise = null;
  }
}

  _optimizeTestOrder(testGroups) {
  // First Fit Decreasing - properly handle 0-device tests
  const testsWithDevices = testGroups.map(group => ({
    group,
    devices: this._getJobDeviceRequirement(group) || 0
  }));
  
  // Sort by devices needed (descending) - ensure stable sort
  testsWithDevices.sort((a, b) => {
    // Primary sort by device count (descending)
    if (b.devices !== a.devices) {
      return b.devices - a.devices;
    }
    // Secondary sort by test count for same device requirements
    return (b.group.tests?.length || 0) - (a.group.tests?.length || 0);
  });
  
  // Log the sorted order for debugging
  console.log('📋 [SORT] Test order after FFD:');
  testsWithDevices.slice(0, 10).forEach((item, idx) => {
    console.log(`    ${idx + 1}. ${item.devices} devices - ${item.group.tests?.length || 0} tests`);
  });
  if (testsWithDevices.length > 10) {
    console.log(`    ... and ${testsWithDevices.length - 10} more`);
  }
  
  return testsWithDevices.map(item => item.group);
}


_startWorkerManagement() {
  this._workerManagementInterval = setInterval(async () => {
    await this._adjustWorkerPool();
    
    // Log cooldown status
    const cooldowns = await this._getDeviceCooldownStatus();
    const cooldownCount = Object.keys(cooldowns).length;
    if (cooldownCount > 0) {
      console.log(`🧊 [COOLDOWN] ${cooldownCount} devices cooling down:`, cooldowns);
    }
    
    // Trigger scheduling if needed
    const hasIdleWorker = this._workerSlots.some(w => !w.busy);
    if (hasIdleWorker && this._queue.length > 0) {
      this._scheduleJob();
    }
  }, 10000);
}

  async _adjustWorkerPool() {
  if (this._isStopped || this._adjustingWorkers) return;
  
  this._adjustingWorkers = true;
  
  try {
    const activeWorkers = this._workerSlots.filter(w => w.busy).length;
    const idleWorkers = this._workerSlots.length - activeWorkers;
    const queueLength = this._queue.length;
    const availableDevices = await this._redis.lLen(this._redisKeys.devicesAvailable);
    
    console.log(`🔍 [WORKER_POOL] Workers: ${activeWorkers} active, ${idleWorkers} idle | Queue: ${queueLength} | Devices: ${availableDevices}/${this._devicePoolSize} available`);
    
    // Only scale up if we have idle devices AND queued jobs AND no idle workers
    if (queueLength > 0 && availableDevices > 0 && idleWorkers === 0 && this._workerSlots.length < this._maxWorkers) {
      // Find the smallest job we can run
      const jobsWithDevices = this._queue.map(job => ({
        job,
        devices: this._getJobDeviceRequirement(job)
      })).filter(item => item.devices <= availableDevices);
      
      if (jobsWithDevices.length > 0) {
        // Add ONE worker at a time
        console.log(`📈 [WORKERS] Scaling up: adding 1 worker`);
        this._addWorker();
        // Trigger scheduling for the new worker
        setTimeout(() => this._scheduleJob(), 100);
      }
    }
    
    // Scale down if too many idle
    if (idleWorkers > 1 && queueLength === 0 && this._workerSlots.length > this._minWorkers) {
      console.log(`📉 [WORKERS] Scaling down: removing 1 idle worker`);
      this._removeIdleWorkers(1);
    }
  } finally {
    this._adjustingWorkers = false;
  }
}


  _addWorker() {
    const newIndex = this._workerSlots.length;
    this._workerSlots.push({ busy: false });
    this._lastWorkerActivity.set(newIndex, Date.now());
  }

  _removeIdleWorkers(count) {
    let removed = 0;
    
    for (let i = this._workerSlots.length - 1; i >= 0 && removed < count; i--) {
      if (!this._workerSlots[i].busy) {
        const worker = this._workerSlots[i].worker;
        if (worker) {
          worker.removeAllListeners('exit');
          worker.stop();
        }
        this._workerSlots.splice(i, 1);
        removed++;
      }
    }
    
    console.log(`✅ [WORKERS] Removed ${removed} idle workers`);
  }

 _createWorker(testGroup, parallelIndex, loaderData) {
  const projectConfig = this._config.projects.find((p) => p.id === testGroup.projectId);
  const outputDir = projectConfig.project.outputDir;
  
  // Include allocated devices in the environment for this worker
  const allocatedDevicesStr = testGroup.allocatedDevices ? testGroup.allocatedDevices.join(',') : '';
  
  const extraEnv = {
    ...(this._extraEnvByProjectId.get(testGroup.projectId) || {}),
    ALLOCATED_DEVICES: allocatedDevicesStr,
    TEST_WORKER_INDEX: String(parallelIndex)
  };
  
  const worker = new import_workerHost.WorkerHost(
    testGroup, 
    parallelIndex, 
    loaderData, 
    extraEnv,
    outputDir
  );
  
  const handleOutput = (params) => {
    const chunk = chunkFromParams(params);
    if (worker.didFail()) {
      return { chunk };
    }
    const workerSlot = this._workerSlots[parallelIndex];
    const currentlyRunning = workerSlot?.jobDispatcher?.currentlyRunning();
    
    if (!currentlyRunning) return { chunk };
    
    return { chunk, test: currentlyRunning.test, result: currentlyRunning.result };
  }
  
  worker.on("stdOut", (params) => {
    const { chunk, test, result } = handleOutput(params);
    result?.stdout.push(chunk);
    this._reporter.onStdOut?.(chunk, test, result);
  });
  
  worker.on("stdErr", (params) => {
    const { chunk, test, result } = handleOutput(params);
    result?.stderr.push(chunk);
    this._reporter.onStdErr?.(chunk, test, result);
  });
  
  worker.on("teardownErrors", (params) => {
    this._failureTracker.onWorkerError();
    for (const error of params.fatalErrors)
      this._reporter.onError?.(error);
  });
  
  worker.on("exit", () => {
    const producedEnv = this._producedEnvByProjectId.get(testGroup.projectId) || {};
    this._producedEnvByProjectId.set(testGroup.projectId, { ...producedEnv, ...worker.producedEnv() });
  });
  
  return worker;
}

  producedEnvByProjectId() {
    return this._producedEnvByProjectId;
  }

  async stop() {
    if (this._isStopped) return;
    this._isStopped = true;
    await Promise.all(this._workerSlots.map(({ worker }) => worker?.stop()));
    this._checkFinished();
  }
}

// Keep the original JobDispatcher class exactly as is
class JobDispatcher {
  constructor(job, reporter, failureTracker, stopCallback) {
    this.jobResult = new import_utils.ManualPromise();
    this._listeners = [];
    this._failedTests = /* @__PURE__ */ new Set();
    this._failedWithNonRetriableError = /* @__PURE__ */ new Set();
    this._remainingByTestId = /* @__PURE__ */ new Map();
    this._dataByTestId = /* @__PURE__ */ new Map();
    this._parallelIndex = 0;
    this._workerIndex = 0;
    this.job = job;
    this._reporter = reporter;
    this._failureTracker = failureTracker;
    this._stopCallback = stopCallback;
    this._remainingByTestId = new Map(this.job.tests.map((e) => [e.id, e]))
      this._processingQueue = false;
    this._scheduling = false;
    this._adjustingWorkers = false;
    this._completedTests = 0;
    this._initialWorkerCount = 0; // Add this

  }
  
  _onTestBegin(params) {
    const test = this._remainingByTestId.get(params.testId);
    if (!test) {
      return;
    }
    const result = test._appendTestResult();
    this._dataByTestId.set(test.id, { test, result, steps: /* @__PURE__ */ new Map() });
    result.parallelIndex = this._parallelIndex;
    result.workerIndex = this._workerIndex;
    result.startTime = new Date(params.startWallTime);
    this._reporter.onTestBegin?.(test, result);
    this._currentlyRunning = { test, result };
  }
  
  _onTestEnd(params) {
    if (this._failureTracker.hasReachedMaxFailures()) {
      params.status = "interrupted";
      params.errors = [];
    }
    const data = this._dataByTestId.get(params.testId);
    if (!data) {
      return;
    }
    this._dataByTestId.delete(params.testId);
    this._remainingByTestId.delete(params.testId);
    const { result, test } = data;
    result.duration = params.duration;
    result.errors = params.errors;
    result.error = result.errors[0];
    result.status = params.status;
    result.annotations = params.annotations;
    test.annotations = [...params.annotations];
    test.expectedStatus = params.expectedStatus;
    test.timeout = params.timeout;
    const isFailure = result.status !== "skipped" && result.status !== test.expectedStatus;
    if (isFailure)
      this._failedTests.add(test);
    if (params.hasNonRetriableError)
      this._addNonretriableTestAndSerialModeParents(test);
    this._reportTestEnd(test, result);
    this._currentlyRunning = void 0;
  }
  
  _addNonretriableTestAndSerialModeParents(test) {
    this._failedWithNonRetriableError.add(test);
    for (let parent = test.parent; parent; parent = parent.parent) {
      if (parent._parallelMode === "serial")
        this._failedWithNonRetriableError.add(parent);
    }
  }
  
  _onStepBegin(params) {
    const data = this._dataByTestId.get(params.testId);
    if (!data) {
      return;
    }
    const { result, steps, test } = data;
    const parentStep = params.parentStepId ? steps.get(params.parentStepId) : void 0;
    const step = {
      title: params.title,
      titlePath: () => {
        const parentPath = parentStep?.titlePath() || [];
        return [...parentPath, params.title];
      },
      parent: parentStep,
      category: params.category,
      startTime: new Date(params.wallTime),
      duration: -1,
      steps: [],
      attachments: [],
      annotations: [],
      location: params.location
    };
    steps.set(params.stepId, step);
    (parentStep || result).steps.push(step);
    this._reporter.onStepBegin?.(test, result, step);
  }
  
  _onStepEnd(params) {
    const data = this._dataByTestId.get(params.testId);
    if (!data) {
      return;
    }
    const { result, steps, test } = data;
    const step = steps.get(params.stepId);
    if (!step) {
      this._reporter.onStdErr?.("Internal error: step end without step begin: " + params.stepId, test, result);
      return;
    }
    step.duration = params.wallTime - step.startTime.getTime();
    if (params.error)
      step.error = params.error;
    if (params.suggestedRebaseline)
      (0, import_rebase.addSuggestedRebaseline)(step.location, params.suggestedRebaseline);
    step.annotations = params.annotations;
    steps.delete(params.stepId);
    this._reporter.onStepEnd?.(test, result, step);
  }
  
  _onAttach(params) {
    const data = this._dataByTestId.get(params.testId);
    if (!data) {
      return;
    }
    const attachment = {
      name: params.name,
      path: params.path,
      contentType: params.contentType,
      body: params.body !== void 0 ? Buffer.from(params.body, "base64") : void 0
    };
    data.result.attachments.push(attachment);
    if (params.stepId) {
      const step = data.steps.get(params.stepId);
      if (step)
        step.attachments.push(attachment);
      else
        this._reporter.onStdErr?.("Internal error: step id not found: " + params.stepId);
    }
  }
  
  _failTestWithErrors(test, errors) {
    const runData = this._dataByTestId.get(test.id);
    let result;
    if (runData) {
      result = runData.result;
    } else {
      result = test._appendTestResult();
      this._reporter.onTestBegin?.(test, result);
    }
    result.errors = [...errors];
    result.error = result.errors[0];
    result.status = errors.length ? "failed" : "skipped";
    this._reportTestEnd(test, result);
    this._failedTests.add(test);
  }
  
  _massSkipTestsFromRemaining(testIds, errors) {
    for (const test of this._remainingByTestId.values()) {
      if (!testIds.has(test.id))
        continue;
      if (!this._failureTracker.hasReachedMaxFailures()) {
        this._failTestWithErrors(test, errors);
        errors = [];
      }
      this._remainingByTestId.delete(test.id);
    }
    if (errors.length) {
      this._failureTracker.onWorkerError();
      for (const error of errors)
        this._reporter.onError?.(error);
    }
  }
  
  _onDone(params) {
    console.log(`🔍 [RETRY_DEBUG] _onDone called for ${this.job.tests.length} tests`);
    
    if (!this._remainingByTestId.size && !this._failedTests.size && !params.fatalErrors.length && !params.skipTestsDueToSetupFailure.length && !params.fatalUnknownTestIds && !params.unexpectedExitError) {
      console.log(`✅ [RETRY_DEBUG] All tests passed, no retries needed`);
      this._finished({ didFail: false });
      return;
    }
    for (const testId of params.fatalUnknownTestIds || []) {
      const test = this._remainingByTestId.get(testId);
      if (test) {
        this._remainingByTestId.delete(testId);
        this._failTestWithErrors(test, [{ message: `Test not found in the worker process. Make sure test title does not change.` }]);
      }
    }
    if (params.fatalErrors.length) {
      this._massSkipTestsFromRemaining(new Set(this._remainingByTestId.keys()), params.fatalErrors);
    }
    this._massSkipTestsFromRemaining(new Set(params.skipTestsDueToSetupFailure), []);
    if (params.unexpectedExitError) {
      if (this._currentlyRunning)
        this._massSkipTestsFromRemaining(/* @__PURE__ */ new Set([this._currentlyRunning.test.id]), [params.unexpectedExitError]);
      else
        this._massSkipTestsFromRemaining(new Set(this._remainingByTestId.keys()), [params.unexpectedExitError]);
    }
    const retryCandidates = /* @__PURE__ */ new Set();
    const serialSuitesWithFailures = /* @__PURE__ */ new Set();

    console.log(`🔍 [RETRY_DEBUG] Failed tests: ${this._failedTests.size}`);
    console.log(`🔍 [RETRY_DEBUG] Failed with non-retriable error: ${this._failedWithNonRetriableError.size}`);
    
    for (const failedTest of this._failedTests) {
      if (this._failedWithNonRetriableError.has(failedTest)) {
        console.log(`❌ [RETRY_DEBUG] Test "${failedTest.title}" has non-retriable error, skipping retry`);
        continue;
      }
      console.log(`➕ [RETRY_DEBUG] Adding "${failedTest.title}" to retry candidates`);
      retryCandidates.add(failedTest);
      let outermostSerialSuite;
      for (let parent = failedTest.parent; parent; parent = parent.parent) {
        if (parent._parallelMode === "serial")
          outermostSerialSuite = parent;
      }
      if (outermostSerialSuite && !this._failedWithNonRetriableError.has(outermostSerialSuite))
        serialSuitesWithFailures.add(outermostSerialSuite);
    }
    const testsBelongingToSomeSerialSuiteWithFailures = [...this._remainingByTestId.values()].filter((test) => {
      let parent = test.parent;
      while (parent && !serialSuitesWithFailures.has(parent))
        parent = parent.parent;
      return !!parent;
    });
    this._massSkipTestsFromRemaining(new Set(testsBelongingToSomeSerialSuiteWithFailures.map((test) => test.id)), []);
    for (const serialSuite of serialSuitesWithFailures) {
      serialSuite.allTests().forEach((test) => retryCandidates.add(test));
    }
    const remaining = [...this._remainingByTestId.values()];
    console.log(`🔍 [RETRY_DEBUG] Remaining tests from remainingByTestId: ${remaining.length}`);
    for (const test of retryCandidates) {
      console.log(`🔍 [RETRY_DEBUG] Checking retry for "${test.title}": results=${test.results.length}, retries=${test.retries}`);
      if (test.results.length < test.retries + 1) {
        console.log(`✅ [RETRY_DEBUG] Will retry "${test.title}" (attempt ${test.results.length + 1}/${test.retries + 1})`);
        remaining.push(test);
      } else {
        console.log(`❌ [RETRY_DEBUG] Max retries reached for "${test.title}"`);
      }
    }
    
    const newJob = remaining.length ? { ...this.job, tests: remaining } : void 0;
    console.log(`🔍 [RETRY_DEBUG] Creating newJob with ${remaining.length} tests: ${newJob ? 'YES' : 'NO'}`);
    
    this._finished({ didFail: true, newJob });
  }
  
  onExit(data) {
    const unexpectedExitError = data.unexpectedly ? {
      message: `Error: worker process exited unexpectedly (code=${data.code}, signal=${data.signal})`
    } : void 0;
    this._onDone({ skipTestsDueToSetupFailure: [], fatalErrors: [], unexpectedExitError });
  }
  
  _finished(result) {
    import_utils.eventsHelper.removeEventListeners(this._listeners);
    this.jobResult.resolve(result);
  }
  
  runInWorker(worker) {
    this._parallelIndex = worker.parallelIndex;
    this._workerIndex = worker.workerIndex;
    
    // Set allocated devices as environment variable for this specific job
    if (this.job.allocatedDevices) {
      const allocatedDevicesStr = this.job.allocatedDevices.join(',');
      // This needs to be passed to the worker, not set in the dispatcher process
      worker.env = {
        ...worker.env,
        ALLOCATED_DEVICES: allocatedDevicesStr
      };
    }
    
    const runPayload = {
      file: this.job.requireFile,
      entries: this.job.tests.map((test) => {
        return { testId: test.id, retry: test.results.length };
      }),
      // Pass allocated devices in the payload
      allocatedDevices: this.job.allocatedDevices
    };
    
    worker.runTestGroup(runPayload);
    this._listeners = [
      import_utils.eventsHelper.addEventListener(worker, "testBegin", this._onTestBegin.bind(this)),
      import_utils.eventsHelper.addEventListener(worker, "testEnd", this._onTestEnd.bind(this)),
      import_utils.eventsHelper.addEventListener(worker, "stepBegin", this._onStepBegin.bind(this)),
      import_utils.eventsHelper.addEventListener(worker, "stepEnd", this._onStepEnd.bind(this)),
      import_utils.eventsHelper.addEventListener(worker, "attach", this._onAttach.bind(this)),
      import_utils.eventsHelper.addEventListener(worker, "done", this._onDone.bind(this)),
      import_utils.eventsHelper.addEventListener(worker, "exit", this.onExit.bind(this))
    ];
  }
  
  skipWholeJob() {
    const allTestsSkipped = this.job.tests.every((test) => test.expectedStatus === "skipped");
    if (allTestsSkipped && !this._failureTracker.hasReachedMaxFailures()) {
      for (const test of this.job.tests) {
        const result = test._appendTestResult();
        this._reporter.onTestBegin?.(test, result);
        result.status = "skipped";
        this._reportTestEnd(test, result);
      }
      return true;
    }
    return false;
  }
  
  currentlyRunning() {
    return this._currentlyRunning;
  }
  
  _reportTestEnd(test, result) {
    this._reporter.onTestEnd?.(test, result);
    const hadMaxFailures = this._failureTracker.hasReachedMaxFailures();
    this._failureTracker.onTestEnd(test, result);
    if (this._failureTracker.hasReachedMaxFailures()) {
      this._stopCallback();
      if (!hadMaxFailures)
        this._reporter.onError?.({ message: import_utils2.colors.red(`Testing stopped early after ${this._failureTracker.maxFailures()} maximum allowed failures.`) });
    }
  }
}

function chunkFromParams(params) {
  if (typeof params.text === "string")
    return params.text;
  return Buffer.from(params.buffer, "base64");
}

// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Dispatcher
});