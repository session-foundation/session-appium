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
    this._maxWorkers = this._config.config.workers || 12; // Max workers allowed
    this._minWorkers = 1; // Minimum workers to keep alive
    this._workerIdleTimeout = 10000; // 10s before killing idle worker
    this._lastWorkerActivity = new Map(); // Track when workers were last busy
    this._dynamicWorkerScaling = this._config.config.dynamicWorkerScaling !== false; // Default on
    
    console.log(`🎯 [WORKERS] Dynamic scaling enabled: ${this._minWorkers}-${this._maxWorkers} workers`);
    
    for (const project of config.projects) {
      if (project.workers)
        this._workerLimitPerProjectId.set(project.id, project.workers);
    }
    
// ADD: Device pool management with iOS device detection
    const configuredPoolSize = this._config.config.devicePoolSize || 
                              parseInt(process.env.PLAYWRIGHT_DEVICE_POOL_SIZE) || 
                              12; // Default max if not specified
    
    // Detect actual available iOS devices
    const actualDeviceCount = this._detectIosDeviceCount();
    const devicePoolSize = Math.min(configuredPoolSize, actualDeviceCount);
    
    if (actualDeviceCount < configuredPoolSize) {
      console.warn(
        `⚠️  [DEVICE_POOL] Configured pool size (${configuredPoolSize}) exceeds actual available devices (${actualDeviceCount}). ` +
        `Using ${devicePoolSize} devices.`
      );
    }
    
    this._devicePool = {
      total: devicePoolSize,
      available: devicePoolSize,
      configured: configuredPoolSize,
      actual: actualDeviceCount,
      allocations: new Map(),
      waitQueue: [],
      deviceStates: new Array(devicePoolSize).fill(false),
      stats: {
        totalAllocated: 0,
        totalQueued: 0,
        maxQueueSize: 0,
        totalWaitTime: 0,
        waitCounts: 0,
      },
    };
    
    console.log(`🎮 [DEVICE_POOL] Initialized with ${devicePoolSize} devices`);
    console.log(`    Configured: ${configuredPoolSize}, Actual available: ${actualDeviceCount}, Using: ${devicePoolSize}`);

        // ADD THIS: Global stagger tracking
    this._globalStagger = {
      lastAllocationTime: 0,
      minimumInterval: 5000, // 5s base, will multiply by device count
    };
  }

  _detectActualDeviceCount() {
    // Check if we're running iOS or Android tests based on projects
    const hasIosTests = this._config.projects.some(p => 
      p.name?.toLowerCase().includes('ios') || 
      p.use?.defaultBrowserType === 'webkit' // or however you identify iOS projects
    );
    
    const hasAndroidTests = this._config.projects.some(p => 
      p.name?.toLowerCase().includes('android') ||
      p.use?.defaultBrowserType === 'chromium' // or however you identify Android projects
    );
    
    if (hasIosTests) {
      return this._detectIosDeviceCount();
    } else if (hasAndroidTests) {
      return this._detectAndroidDeviceCount();
    }
    
    // Default to checking iOS devices
    return this._detectIosDeviceCount();
  }

  _detectIosDeviceCount() {
    let actualCount = 0;
    
    // Check iOS simulator environment variables
    for (let i = 1; i <= 12; i++) {
      const udid = process.env[`IOS_${i}_SIMULATOR`];
      
      // Check if it's a valid UUID (not placeholder)
      if (udid && this._isValidIosUdid(udid)) {
        actualCount++;
      }
    }
    
    console.log(`🔍 [DEVICE_POOL] Detected ${actualCount} actual iOS devices`);
    return actualCount;
  }

  _detectAndroidDeviceCount() {
    let actualCount = 0;
    
    // For Android, you might check differently
    // This is a placeholder - implement based on your Android setup
    for (let i = 1; i <= 12; i++) {
      // Check if Android emulator exists
      // You might check ANDROID_${i}_EMULATOR or use adb devices
      actualCount = i; // Placeholder
    }
    
    return Math.min(actualCount, 12);
  }

  _isValidIosUdid(udid) {
    // UUID format check
    const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
    
    // Check against known placeholders
    const placeholders = ['just_not_empty', 'placeholder', 'dummy', 'not_set'];
    
    return uuidRegex.test(udid) && !placeholders.includes(udid.toLowerCase());
  }

  _isDeviceHealthy(deviceIndex) {
  // For iOS devices, check if the simulator UDID is still valid
  const udid = process.env[`IOS_${deviceIndex + 1}_SIMULATOR`];
  
  if (!udid || !this._isValidIosUdid(udid)) {
    console.warn(`⚠️  [DEVICE] Device ${deviceIndex} appears unhealthy (invalid UDID)`);
    return false;
  }
  
  // Could add more health checks here (e.g., ping simulator)
  return true;
}

  _findFirstJobToRun() {
    // REPLACED: This method is no longer used - we use smarter scheduling
    return -1;
  }

  _scheduleJob() {
  if (this._isStopped)
    return;
  
  console.log(`\n🔄 [SCHEDULER] Running scheduler (${this._devicePool.available}/${this._devicePool.total} devices available)`);
  
  // First, try to run jobs from the wait queue
  this._processWaitQueue();
  
  // Then, try to schedule new jobs from the main queue
  this._processMainQueue();
  
  // Log queue status summary (not every job!)
  if (this._devicePool.waitQueue.length > 0) {
    const summary = {};
    this._devicePool.waitQueue.forEach(item => {
      const key = `${item.devices}-device`;
      summary[key] = (summary[key] || 0) + 1;
    });
    
    console.log(`⏳ [QUEUE] ${this._devicePool.waitQueue.length} jobs waiting:`);
    Object.entries(summary).forEach(([type, count]) => {
      console.log(`    ${count} ${type} tests`);
    });
    
    // Show wait times for first few
    const firstFew = this._devicePool.waitQueue.slice(0, 3);
    firstFew.forEach((item, i) => {
      const waitTime = Math.round((Date.now() - item.timestamp) / 1000);
      const test = item.job.tests?.[0]?.title || 'Unknown';
      console.log(`    ${i + 1}. "${test}" (${item.devices} devices, ${waitTime}s)`);
    });
    
    if (this._devicePool.waitQueue.length > 3) {
      console.log(`    ... and ${this._devicePool.waitQueue.length - 3} more`);
    }
  }
}

  _processWaitQueue() {
  if (this._devicePool.waitQueue.length === 0) return;
  
  console.log(`🔍 [QUEUE] Processing wait queue with ${this._devicePool.waitQueue.length} jobs`);
  
  // Smart sorting: prioritize jobs that best utilize available devices
  const availableDevices = this._devicePool.available;
  
  this._devicePool.waitQueue.sort((a, b) => {
    // First priority: jobs that exactly match available devices
    const aExactMatch = a.devices === availableDevices ? 0 : 1;
    const bExactMatch = b.devices === availableDevices ? 0 : 1;
    if (aExactMatch !== bExactMatch) return aExactMatch - bExactMatch;
    
    // Second priority: jobs that use the most devices (without exceeding)
    if (a.devices <= availableDevices && b.devices <= availableDevices) {
      return b.devices - a.devices; // Larger first
    }
    
    // Third priority: smaller jobs if both exceed available
    if (a.devices > availableDevices && b.devices > availableDevices) {
      return a.devices - b.devices; // Smaller first
    }
    
    // Finally: by timestamp (FIFO)
    return a.timestamp - b.timestamp;
  });
  
  const stillWaiting = [];
  let stopChecking = false;
  
  for (const item of this._devicePool.waitQueue) {
    // If we already know we can't schedule this size, skip the rest
    if (stopChecking || item.devices > this._devicePool.available) {
      stillWaiting.push(item);
      // Once we hit a job we can't run, all larger jobs also can't run
      stopChecking = true;
      continue;
    }
    
    console.log(`   Trying to schedule job needing ${item.devices} devices...`);
    if (this._tryScheduleJob(item.job, item.devices)) {
      const waitTime = Date.now() - item.timestamp;
      console.log(
        `✅ [QUEUE] Job waited ${Math.round(waitTime / 1000)}s before running`,
      );
      // UPDATE STATS
      this._devicePool.stats.totalWaitTime += waitTime;
      this._devicePool.stats.waitCounts++;
      // Don't add to stillWaiting - it's been scheduled!
    } else {
      console.log(`   Still not enough devices (need ${item.devices}, have ${this._devicePool.available})`);
      stillWaiting.push(item);
      // If we can't run this job, we can't run any larger jobs either
      stopChecking = true;
    }
  }
  
  this._devicePool.waitQueue = stillWaiting;
  
  // Log a summary instead of listing every waiting job
  if (stillWaiting.length > 0) {
    const deviceCounts = {};
    stillWaiting.forEach(item => {
      deviceCounts[item.devices] = (deviceCounts[item.devices] || 0) + 1;
    });
    
    console.log(`⏳ [QUEUE] ${stillWaiting.length} jobs waiting:`);
    Object.entries(deviceCounts).forEach(([devices, count]) => {
      console.log(`    ${count} jobs need ${devices} devices`);
    });
  }
}

 _processMainQueue() {
  const remainingJobs = [];
  
  // Track the minimum devices needed that we've already queued
  let minDevicesQueued = Infinity;
  
  for (const job of this._queue) {
    const devices = this._getJobDeviceRequirement(job);
    
    // Check project worker limits first
    if (!this._canRunBasedOnProjectLimits(job)) {
      remainingJobs.push(job);
      continue;
    }
    
    // If we already queued a job needing fewer devices than this one,
    // and it couldn't run, then this one definitely can't run either
    if (devices > 0 && devices >= minDevicesQueued && devices > this._devicePool.available) {
      // Skip the scheduling attempt and go straight to queue
      this._devicePool.waitQueue.push({
        job,
        devices,
        timestamp: Date.now()
      });
      this._devicePool.stats.totalQueued++;
      this._devicePool.stats.maxQueueSize = Math.max(
        this._devicePool.stats.maxQueueSize,
        this._devicePool.waitQueue.length
      );
      continue;
    }
    
    // Try to schedule immediately
    if (this._tryScheduleJob(job, devices)) {
      console.log(`🚀 [SCHEDULER] Immediately scheduled job needing ${devices} devices`);
    } else if (devices > 0) {
      // Add to wait queue and track minimum devices
      this._devicePool.waitQueue.push({
        job,
        devices,
        timestamp: Date.now()
      });
      this._devicePool.stats.totalQueued++;
      this._devicePool.stats.maxQueueSize = Math.max(
        this._devicePool.stats.maxQueueSize,
        this._devicePool.waitQueue.length
      );
      
      // Update minimum devices that couldn't run
      minDevicesQueued = Math.min(minDevicesQueued, devices);
      
      // Don't log every single queue addition
      if (this._devicePool.waitQueue.length === 1 || this._devicePool.waitQueue.length % 10 === 0) {
        console.log(`📋 [QUEUE] Queue size: ${this._devicePool.waitQueue.length} jobs`);
      }
    } else {
      // Jobs with 0 devices should wait for available worker
      remainingJobs.push(job);
    }
  }
  
  this._queue = remainingJobs;
}

  _canRunBasedOnProjectLimits(job) {
    const projectIdWorkerLimit = this._workerLimitPerProjectId.get(job.projectId);
    if (!projectIdWorkerLimit) return true;
    
    const runningWorkersWithSameProjectId = this._workerSlots.filter(
      (w) => w.busy && w.worker && w.worker.projectId() === job.projectId
    ).length;
    
    return runningWorkersWithSameProjectId < projectIdWorkerLimit;
  }

  _tryScheduleJob(job, devices) {
  if (devices === 4 && this._completedTests < 3) {
    const now = Date.now();
    const timeSinceLastAllocation = now - this._globalStagger.lastAllocationTime;
    const requiredInterval = devices * 5000; // 20s for 4-device tests
    
    if (timeSinceLastAllocation < requiredInterval) {
      // Check for idle workers
      const idleWorkers = this._workerSlots.filter(w => !w.busy).length;
      if (idleWorkers > 0) {
        console.log(`✅ [STAGGER] Skipping wait - ${idleWorkers} idle workers available`);
      } else {
        console.log(`⏳ [STAGGER] Need to wait ${((requiredInterval - timeSinceLastAllocation)/1000).toFixed(1)}s more before starting 4-device test`);
        return false;
      }
    }
  }
    console.log(`🔍 [TRY_SCHEDULE] Trying to schedule job needing ${devices} devices (${this._devicePool.available} available)`);
    
    // Validate device requirement against actual devices
    if (devices > this._devicePool.actual) {
      console.error(
        `❌ [ERROR] Job requires ${devices} devices but only ${this._devicePool.actual} actual devices exist`
      );
      
      // Provide helpful error message
      const errorMsg = this._devicePool.actual < this._devicePool.configured
        ? `Test requires ${devices} devices but only ${this._devicePool.actual} are actually available. ` +
          `Check your IOS_*_SIMULATOR environment variables - only ${this._devicePool.actual} have valid UDIDs.`
        : `Test requires ${devices} devices but pool only has ${this._devicePool.total} total`;
      
      this._failJobWithErrors(job, [{ message: errorMsg }]);
      return true; // Mark as "scheduled" so it's removed from queue
    }
    
    // Check device availability
    if (devices > this._devicePool.available) {
      console.log(`   ❌ Not enough devices`);
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
      console.log(`   ❌ No available workers (all ${this._workerSlots.length} are busy)`);
      console.log(`   Worker states:`, this._workerSlots.map((w, i) => `Worker ${i}: ${w.busy ? 'busy' : 'idle'}`));
      return false;
    }
    
    console.log(`   ✅ Found available worker ${workerIndex}`);
    
    if (devices > 0) {
        // Allocate specific device indices (not just count)
        const allocatedIndices = this._allocateDeviceIndices(devices);
        if (!allocatedIndices) return false;
        
        this._devicePool.available -= devices;
        this._devicePool.allocations.set(workerIndex, { 
          devices, 
          indices: allocatedIndices,
          job 
        });
        
        // Pass indices to the job so worker can access them
        job.allocatedDevices = allocatedIndices;
        
        console.log(`🔒 [DEVICES] Worker ${workerIndex} allocated devices: ${allocatedIndices.join(', ')} for job "${job.tests?.[0]?.title}"`);
        
        // ADD THIS: Verify the allocation matches what the job needs
        if (allocatedIndices.length !== devices) {
          console.error(`❌ [DEVICES] Allocation mismatch! Job needs ${devices} but got ${allocatedIndices.length}`);
        }
      
      // Track stats
      this._devicePoolMinAvailable.push(this._devicePool.available);
      this._devicePool.stats.totalAllocated++;
    }
    
    // Log what we're running
    const test = job.tests?.[0];
    if (test) {
      console.log(`📱 [RUNNING] "${test.title}" on worker ${workerIndex} with ${devices} devices`);
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
    console.log(`🔍 [DEBUG] About to run job with allocatedDevices:`, job.allocatedDevices);

      // 2. Update global stagger timestamp after allocation
    if (devices >= 1 && this._devicePool.stats.totalAllocated <= 30) {
      this._globalStagger.lastAllocationTime = Date.now();
      console.log(`🏃 [STAGGER] Allocated devices for "${job.tests?.[0]?.title}" - next ${devices}-device test must wait ${devices * 5}s`);
    }

    // 3. REMOVE the setTimeout stagger - just run the job normally
    void this._runJobInWorker(workerIndex, jobDispatcher).then(() => {
      // Clear timeout first
      this._clearTestTimeout(workerIndex);
      
      // Clean up worker IMMEDIATELY
      if (workerIndex < this._workerSlots.length && this._workerSlots[workerIndex]) {
        this._workerSlots[workerIndex].jobDispatcher = void 0;
        this._workerSlots[workerIndex].busy = false;
      }
      
      // Then deallocate devices
      this._deallocateDevices(workerIndex);
      
      // NOW the worker is available - try to schedule work
      this._scheduleJob();
      
      // Finally check if we're finished
      this._checkFinished();
    });
    
    // Start timeout monitoring
    this._startTestTimeout(workerIndex, job);

    return true;
  }

  _allocateDeviceIndices(count) {
  const available = [];
  
  // Track which device indices are in use
  if (!this._devicePool.deviceStates) {
    this._devicePool.deviceStates = new Array(this._devicePool.total).fill(false);
  }
  
  // Log current state for debugging
  const inUseDevices = this._devicePool.deviceStates
    .map((used, i) => used ? i : null)
    .filter(i => i !== null);
  console.log(`🔍 [ALLOC] Trying to allocate ${count} devices. In use: [${inUseDevices.join(', ')}]`);
  
  // Find available devices
  for (let i = 0; i < this._devicePool.total && available.length < count; i++) {
    if (!this._devicePool.deviceStates[i]) {
      // Check health
      const isHealthy = this._isDeviceHealthy(i);
      if (isHealthy) {
        available.push(i);
        this._devicePool.deviceStates[i] = true;
      } else {
        console.log(`⚠️ [ALLOC] Device ${i} is unhealthy, skipping`);
      }
    }
  }
  
  if (available.length < count) {
    console.error(`❌ [ALLOC] Could only find ${available.length} healthy devices, but need ${count}`);
    // Rollback
    available.forEach(i => this._devicePool.deviceStates[i] = false);
    return null;
  }
  
  console.log(`✅ [ALLOC] Allocated devices: [${available.join(', ')}]`);
  return available;
}

  _deallocateDevices(workerIndex) {
    const allocation = this._devicePool.allocations.get(workerIndex);
    if (allocation) {
      // Clear timeout if exists
      if (allocation.timeoutId) {
        clearTimeout(allocation.timeoutId);
      }
      
      // Free specific device indices
      allocation.indices.forEach(i => {
        this._devicePool.deviceStates[i] = false;
      });
      
      this._devicePool.available += allocation.devices;
      this._devicePool.allocations.delete(workerIndex);
      console.log(`🔓 [DEVICES] Worker ${workerIndex} released devices: ${allocation.indices.join(', ')}`);
    }
  }

_startTestTimeout(workerIndex, job) {
  // Longer timeout for CI and tests with multiple devices
  const devices = this._getJobDeviceRequirement(job);
  const baseTimeout = process.env.CI ? 600000 : 300000; // 10 min CI, 5 min local
  const deviceMultiplier = devices > 2 ? 1.5 : 1; // 50% more time for 3+ device tests
  const TEST_TIMEOUT = baseTimeout * deviceMultiplier;
  
  const allocation = this._devicePool.allocations.get(workerIndex);
  
  if (allocation) {
    allocation.timeoutId = setTimeout(() => {
      console.error(`⏱️ [TIMEOUT] Test "${job.tests?.[0]?.title}" on worker ${workerIndex} exceeded ${TEST_TIMEOUT/1000}s`);
      this._handleTestTimeout(workerIndex);
    }, TEST_TIMEOUT);
  }
}

_clearTestTimeout(workerIndex) {
  const allocation = this._devicePool.allocations.get(workerIndex);
  if (allocation && allocation.timeoutId) {
    clearTimeout(allocation.timeoutId);
    allocation.timeoutId = null;
  }
}

_handleTestTimeout(workerIndex) {
  console.log(`🔥 [TIMEOUT] Handling timeout for worker ${workerIndex}`);
  
  // Kill the worker
  const slot = this._workerSlots[workerIndex];
  if (slot && slot.worker) {
    void slot.worker.stop(true);
  }
  
  // Mark job as failed
  if (slot && slot.jobDispatcher) {
    slot.jobDispatcher.onExit({ 
      unexpectedly: true, 
      code: -1, 
      signal: 'TIMEOUT' 
    });
  }
  
  // Release devices
  this._deallocateDevices(workerIndex);
  
  // Clean up worker slot
  if (workerIndex < this._workerSlots.length && this._workerSlots[workerIndex]) {
    this._workerSlots[workerIndex].busy = false;
    this._workerSlots[workerIndex].jobDispatcher = void 0;
  }
  
  // Schedule more work
  this._scheduleJob();
}

  _getJobDeviceRequirement(job) {
    const test = job.tests?.[0];
    if (!test) return 0;
    
    const deviceMatch = test.title?.match(/@(\d+)-devices/);
    return deviceMatch ? parseInt(deviceMatch[1]) : 0;
  }

  _failJobWithErrors(job, errors) {
    // Helper method to fail a job before it runs
    for (const test of job.tests) {
      const result = test._appendTestResult();
      this._reporter.onTestBegin?.(test, result);
      result.errors = [...errors];
      result.error = result.errors[0];
      result.status = "failed";
      this._reporter.onTestEnd?.(test, result);
    }
  }

  getDevicePoolStatus() {
    const allocatedDevices = [];
    this._devicePool.allocations.forEach((allocation, workerIndex) => {
      allocatedDevices.push({
        worker: workerIndex,
        devices: allocation.indices,
        test: allocation.job.tests?.[0]?.title || 'Unknown',
      });
    });

    return {
      total: this._devicePool.total,
      available: this._devicePool.available,
      allocated: this._devicePool.total - this._devicePool.available,
      allocations: allocatedDevices,
      queueLength: this._devicePool.waitQueue.length,
      queuedJobs: this._devicePool.waitQueue.map(item => ({
        test: item.job.tests?.[0]?.title || 'Unknown',
        devicesNeeded: item.devices,
        waitingTime: Math.round((Date.now() - item.timestamp) / 1000),
      })),
    };
  }

  _canAcceptMoreWork() {
    // Check if we have any idle workers
    const hasIdleWorker = this._workerSlots.some(w => !w.busy);
    
    // Check if we have devices available
    const hasAvailableDevices = this._devicePool.available > 0;
    
    // Check if we have jobs that could run
    const hasRunnableJobs = this._queue.some(job => {
      const devices = this._getJobDeviceRequirement(job);
      return devices <= this._devicePool.available && this._canRunBasedOnProjectLimits(job);
    }) || this._devicePool.waitQueue.some(item => item.devices <= this._devicePool.available);
    
    return hasIdleWorker && hasAvailableDevices && hasRunnableJobs;
  }

  async _runJobInWorker(index, jobDispatcher) {
    console.log(`🔍 [DEBUG] _runJobInWorker job.allocatedDevices:`, jobDispatcher.job.allocatedDevices);
    // Add this safety check
    if (index >= this._workerSlots.length || !this._workerSlots[index]) {
      console.error(`❌ [WORKER] Invalid worker index ${index}, slot doesn't exist`);
      return;
    }

    this._lastWorkerActivity.set(index, Date.now());
    const job = jobDispatcher.job;
    if (jobDispatcher.skipWholeJob())
      return;
    let worker = this._workerSlots[index].worker;
    if (worker && (worker.hash() !== job.workerHash || worker.didSendStop())) {
      await worker.stop();
      worker = void 0;
      if (this._isStopped)
        return;
    }
    let startError;
    if (!worker) {
      worker = this._createWorker(job, index, (0, import_ipc.serializeConfig)(this._config, true));
      this._workerSlots[index].worker = worker;
      worker.on("exit", () => this._workerSlots[index].worker = void 0);
      startError = await worker.start();
      if (this._isStopped)
        return;
    }
    if (startError)
      jobDispatcher.onExit(startError);
    else
      jobDispatcher.runInWorker(worker);
    const result = await jobDispatcher.jobResult;
    this._updateCounterForWorkerHash(job.workerHash, -1);
    if (result.didFail)
      void worker.stop(true);
    else if (this._isWorkerRedundant(worker))
      void worker.stop();
    if (!this._isStopped && result.newJob) {
      this._queue.unshift(result.newJob);
      this._updateCounterForWorkerHash(result.newJob.workerHash, 1);
    }
    this._lastWorkerActivity.set(index, Date.now());
  }

  _checkFinished() {
    if (this._finished.isDone())
      return;
    
    // Not finished if we have jobs in main queue or wait queue
    if ((this._queue.length || this._devicePool.waitQueue.length) && !this._isStopped)
      return;
      
    if (this._workerSlots.some((w) => w.busy))
      return;
    
    // Clear status interval if running
    if (this._statusLogInterval) {
      clearInterval(this._statusLogInterval);
      this._statusLogInterval = null;
    }
    
    // Clean up worker management
    if (this._workerManagementInterval) {
      clearInterval(this._workerManagementInterval);
      this._workerManagementInterval = null;
    }

    // Log final stats
    if (this._devicePool.stats.totalQueued > 0 || this._devicePool.configured !== this._devicePool.actual) {
      const avgWaitTime = this._devicePool.stats.waitCounts > 0 
        ? this._devicePool.stats.totalWaitTime / this._devicePool.stats.waitCounts
        : 0;
      
      console.log("\n📊 [STATS] Device Pool Statistics:");
      console.log(`    Device pool configuration:`);
      console.log(`      - Configured size: ${this._devicePool.configured}`);
      console.log(`      - Actual available: ${this._devicePool.actual}`);
      console.log(`      - Used in pool: ${this._devicePool.total}`);
      console.log(`    Runtime statistics:`);
      console.log(`      - Total allocations: ${this._devicePool.stats.totalAllocated}`);
      console.log(`      - Jobs queued: ${this._devicePool.stats.totalQueued}`);
      console.log(`      - Max queue size: ${this._devicePool.stats.maxQueueSize}`);
      console.log(`      - Avg wait time: ${Math.round(avgWaitTime / 1000)}s`);
      console.log(`      - Peak device usage: ${this._devicePool.total - Math.min(...this._devicePoolMinAvailable || [this._devicePool.total])}`);
    }
    
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
  this._extraEnvByProjectId = extraEnvByProjectId;
  
  // Smart ordering for optimal device utilization
  this._queue = this._optimizeTestOrder(testGroups);
  
  // Log device requirements summary
  console.log('\n🎬 [DISPATCHER] Starting run with test groups:');
  const deviceCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  this._queue.forEach((group, i) => {
    const devices = this._getJobDeviceRequirement(group);
    deviceCounts[devices]++;
    if (i < 5) {  // Show first 5 for brevity
      group.tests.forEach(test => {
        console.log(`    - "${test.title}" (${devices} devices)`);
      });
    }
  });
    
    console.log(`\n📊 [SUMMARY] Device requirements:`);
    Object.entries(deviceCounts).forEach(([devices, count]) => {
      if (count > 0) {
        console.log(`    ${devices} devices: ${count} tests`);
      }
    });
    
    for (const group of testGroups)
      this._updateCounterForWorkerHash(group.workerHash, 1);
    
    this._isStopped = false;
    this._workerSlots = [];
    
    if (this._failureTracker.hasReachedMaxFailures())
      void this.stop();
    
    // Start with optimal number of workers based on initial queue
    const optimalWorkers = this._calculateOptimalWorkerCount();
    console.log(`🚀 [WORKERS] Starting with ${optimalWorkers} workers`);

    for (let i = 0; i < optimalWorkers; i++)
      this._workerSlots.push({ busy: false });
    
    // Start the scheduler for initial workers
    for (let i = 0; i < this._workerSlots.length; i++)
      this._scheduleJob();
    
    // Start worker management loop
    if (this._dynamicWorkerScaling) {
      this._startWorkerManagement();
    }
    
    this._checkFinished();
    await this._finished;
  }

_calculateOptimalWorkerCount() {
  if (!this._dynamicWorkerScaling) {
    return this._config.config.workers;
  }
  
  // Simulate the first wave to see how many workers we actually need
  const firstWaveJobs = [];
  let devicesUsed = 0;
  
  for (const job of this._queue) {
    const devices = this._getJobDeviceRequirement(job);
    if (devicesUsed + devices <= this._devicePool.total) {
      firstWaveJobs.push(job);
      devicesUsed += devices;
    } else {
      break; // Can't fit more in first wave
    }
  }
  
  // The optimal worker count is the number of jobs in first wave
  let optimalWorkers = firstWaveJobs.length;
  
  // But respect min/max bounds
  optimalWorkers = Math.max(this._minWorkers, Math.min(optimalWorkers, this._maxWorkers));
  
  console.log(`🧮 [WORKERS] First wave analysis: ${firstWaveJobs.length} jobs using ${devicesUsed}/${this._devicePool.total} devices`);
  
  return optimalWorkers;
}

  _analyzeQueue() {
    const deviceCounts = {};
    let totalTests = 0;
    
    [...this._queue, ...this._devicePool.waitQueue.map(item => item.job)].forEach(job => {
      const devices = this._getJobDeviceRequirement(job);
      deviceCounts[devices] = (deviceCounts[devices] || 0) + 1;
      totalTests++;
    });
    
    return { deviceCounts, totalTests };
  }

  _startWorkerManagement() {
    this._workerManagementInterval = setInterval(() => {
      this._adjustWorkerPool();
    }, 5000); // Check every 5 seconds
  }

  _adjustWorkerPool() {
    if (this._isStopped) return;
    
    const activeWorkers = this._workerSlots.filter(w => w.busy).length;
    const idleWorkers = this._workerSlots.length - activeWorkers;
    const queuedJobs = this._queue.length + this._devicePool.waitQueue.length;
    
    console.log(`\n⚙️  [WORKERS] Status: ${activeWorkers} active, ${idleWorkers} idle, ${queuedJobs} queued`);
    
    // Scale up if we have queued jobs and available devices
    if (queuedJobs > 0 && this._devicePool.available > 0 && this._workerSlots.length < this._maxWorkers) {
      const canAddWorkers = this._calculateWorkersToAdd();
      if (canAddWorkers > 0) {
        console.log(`📈 [WORKERS] Scaling up: adding ${canAddWorkers} workers`);
        for (let i = 0; i < canAddWorkers; i++) {
          this._addWorker();
        }
      }
    }
    
    // Scale down if we have too many idle workers
    if (idleWorkers > 1 && this._workerSlots.length > this._minWorkers) {
      const toRemove = this._calculateWorkersToRemove();
      if (toRemove > 0) {
        console.log(`📉 [WORKERS] Scaling down: removing ${toRemove} idle workers`);
        this._removeIdleWorkers(toRemove);
      }
    }
  }

_calculateWorkersToAdd() {
  const { deviceCounts } = this._analyzeQueue();
  const currentWorkers = this._workerSlots.length;
  const availableDevices = this._devicePool.available;
  
  if (availableDevices === 0) return 0;
  
  // Calculate how many workers we could theoretically use
  let possibleNewWorkers = 0;
  
  // Check each device requirement size
  for (let deviceReq = 1; deviceReq <= availableDevices; deviceReq++) {
    if (deviceCounts[deviceReq] > 0) {
      const testsOfThisSize = deviceCounts[deviceReq];
      const workersNeededForThisSize = Math.min(
        testsOfThisSize,
        Math.floor(availableDevices / deviceReq)
      );
      possibleNewWorkers = Math.max(possibleNewWorkers, workersNeededForThisSize);
    }
  }
  
  // ADD THIS PART - Calculate actual workers to add
  const workersToAdd = Math.min(
    possibleNewWorkers - currentWorkers,  // How many more we need
    this._maxWorkers - currentWorkers      // Don't exceed max
  );
  
  if (workersToAdd > 0) {
    console.log(`📊 [WORKERS] Can add ${workersToAdd} workers (target: ${possibleNewWorkers}, current: ${currentWorkers})`);
  }
  
  return Math.max(0, workersToAdd);
}

  _calculateWorkersToRemove() {
    const idleWorkers = this._workerSlots.filter((w, i) => {
      if (w.busy) return false;
      
      // Check how long this worker has been idle
      const lastActive = this._lastWorkerActivity.get(i) || Date.now();
      const idleTime = Date.now() - lastActive;
      
      return idleTime > this._workerIdleTimeout;
    });
    
    // Keep at least minWorkers
    const maxCanRemove = this._workerSlots.length - this._minWorkers;
    return Math.min(idleWorkers.length, maxCanRemove);
  }

  _addWorker() {
    const newIndex = this._workerSlots.length;
    this._workerSlots.push({ busy: false });
    this._lastWorkerActivity.set(newIndex, Date.now());
    
    // Immediately try to schedule work for the new worker
    this._scheduleJob();
  }

  _removeIdleWorkers(count) {
    let removed = 0;
    
    for (let i = this._workerSlots.length - 1; i >= 0 && removed < count; i--) {
      if (!this._workerSlots[i].busy) {
        const worker = this._workerSlots[i].worker;
        if (worker) {
          // Remove all listeners to prevent crashes
          worker.removeAllListeners('exit');
          worker.stop();
        }
        this._workerSlots.splice(i, 1);
        removed++;
      }
    }
    
    console.log(`✅ [WORKERS] Removed ${removed} idle workers, now have ${this._workerSlots.length} total`);
  }


_createWorker(testGroup, parallelIndex, loaderData) {
  const projectConfig = this._config.projects.find((p) => p.id === testGroup.projectId);
  const outputDir = projectConfig.project.outputDir;
  
  // ADD DEBUG LOGGING HERE
  console.log(`🔍 [DEBUG] Creating worker ${parallelIndex} with allocatedDevices:`, testGroup.allocatedDevices);
  
  const allocatedDevicesStr = testGroup.allocatedDevices ? testGroup.allocatedDevices.join(',') : '';
  console.log(`🔍 [DEBUG] ALLOCATED_DEVICES string will be: "${allocatedDevicesStr}"`);
  
  const extraEnv = {
    ...(this._extraEnvByProjectId.get(testGroup.projectId) || {}),
    ALLOCATED_DEVICES: allocatedDevicesStr
  };
  
  console.log(`🔍 [DEBUG] extraEnv.ALLOCATED_DEVICES = "${extraEnv.ALLOCATED_DEVICES}"`);
  
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

    if (!currentlyRunning)
      return { chunk };
      
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

  _optimizeTestOrder(testGroups) {
  const testsByDeviceCount = {};
  testGroups.forEach(group => {
    const devices = this._getJobDeviceRequirement(group);
    if (!testsByDeviceCount[devices]) {
      testsByDeviceCount[devices] = [];
    }
    testsByDeviceCount[devices].push(group);
  });
  
  const poolSize = this._devicePool.total;
  const workers = this._config.config.workers;
  
  console.log(`🧠 [OPTIMIZER] Optimizing for ${poolSize} devices and ${workers} workers`);
  
  // Log what we have to work with
  const summary = {};
  Object.entries(testsByDeviceCount).forEach(([devices, tests]) => {
    summary[`${devices}-device`] = tests.length;
  });
  console.log(`    Test distribution:`, summary);
  
  // IMPLEMENT FIRST FIT DECREASING (FFD)
  const optimizedOrder = this._firstFitDecreasing(testsByDeviceCount);
  
  // Log optimization result
  const preview = optimizedOrder.slice(0, 20).map(job => 
    this._getJobDeviceRequirement(job)
  );
  console.log(`    Optimized order (first 20): [${preview.join(', ')}] devices`);
  
  // Calculate expected efficiency
  this._logExpectedEfficiency(optimizedOrder);
  
  return optimizedOrder;
}

_firstFitDecreasing(testsByDeviceCount) {
  // First Fit Decreasing algorithm for bin packing
  const allTests = [];
  
  // Flatten all tests with their device requirements
  Object.entries(testsByDeviceCount).forEach(([devices, tests]) => {
    tests.forEach(test => {
      allTests.push({ test, devices: parseInt(devices) });
    });
  });
  
  // Sort by devices needed (descending) - this is the "decreasing" part
  allTests.sort((a, b) => b.devices - a.devices);
  
  // Create bins (waves) that can hold up to poolSize devices
  const bins = [];
  const poolSize = this._devicePool.total;
  
  // First Fit algorithm
  for (const item of allTests) {
    let placed = false;
    
    // Try to fit in existing bins
    for (const bin of bins) {
      const currentUsage = bin.items.reduce((sum, i) => sum + i.devices, 0);
      if (currentUsage + item.devices <= poolSize) {
        bin.items.push(item);
        placed = true;
        break;
      }
    }
    
    // If doesn't fit in any bin, create new one
    if (!placed) {
      bins.push({ items: [item] });
    }
  }
  
  // Log bin packing results
  console.log(`📦 [FFD] Packed ${allTests.length} tests into ${bins.length} bins (waves)`);
  bins.slice(0, 5).forEach((bin, i) => {
    const usage = bin.items.reduce((sum, item) => sum + item.devices, 0);
    const efficiency = Math.round((usage / poolSize) * 100);
    const deviceCounts = bin.items.map(item => item.devices).join(', ');
    console.log(`    Wave ${i + 1}: [${deviceCounts}] = ${usage}/${poolSize} devices (${efficiency}%)`);
  });
  
  // Flatten bins back to ordered list
  const optimizedOrder = [];
  bins.forEach(bin => {
    bin.items.forEach(item => {
      optimizedOrder.push(item.test);
    });
  });
  
  return optimizedOrder;
}

_logExpectedEfficiency(orderedTests) {
  const poolSize = this._devicePool.total;
  const workers = this._config.config.workers;
  
  // Simulate first few "waves" of test execution
  let wave = 1;
  let index = 0;
  let totalWastedSlots = 0;
  
  console.log(`    Expected execution waves:`);
  
  while (index < orderedTests.length && wave <= 3) {
    let devicesUsed = 0;
    let testsInWave = [];
    
    // Try to pack tests into this wave
    for (let i = index; i < orderedTests.length && testsInWave.length < workers; i++) {
      const testDevices = this._getJobDeviceRequirement(orderedTests[i]);
      if (devicesUsed + testDevices <= poolSize) {
        devicesUsed += testDevices;
        testsInWave.push(testDevices);
        index++;
      }
    }
    
    const utilization = Math.round((devicesUsed / poolSize) * 100);
    const wastedSlots = poolSize - devicesUsed;
    totalWastedSlots += wastedSlots;
    
    console.log(`      Wave ${wave}: [${testsInWave.join(', ')}] devices = ${devicesUsed}/${poolSize} (${utilization}% utilization)`);
    wave++;
  }
  
  console.log(`    Total device slots wasted in first 3 waves: ${totalWastedSlots}`);
}
  // Calculate optimal priority order based on pool size
  _calculatePriorityOrder(poolSize) {
    // For a 4-device pool, optimal order might be:
    // - 2-device tests (can run 2 in parallel)
    // - 1-device tests (fill gaps)
    // - 3-device tests (leaves 1 device for small tests)
    // - 4-device tests (blocks everything)
    
    if (poolSize === 4) {
      return [2, 1, 3, 4];
    } else if (poolSize === 8) {
      return [4, 2, 3, 1, 6, 5, 7, 8];
    } else if (poolSize === 12) {
      return [4, 3, 2, 6, 1, 8, 5, 7, 9, 10, 11, 12];
    } else {
      // Generic strategy: middle values first, then small, then large
      const order = [];
      const middle = Math.floor(poolSize / 2);
      
      // Add middle values (best for parallel execution)
      for (let i = middle; i > 0; i--) {
        if (i <= poolSize) order.push(i);
      }
      
      // Add larger values
      for (let i = middle + 1; i <= poolSize; i++) {
        order.push(i);
      }
      
      return order;
    }
  }

  // Optional: Add a method to analyze and report on the optimization
  _analyzeTestDistribution() {
    const distribution = {};
    let totalDeviceTime = 0;
    
    this._queue.forEach(group => {
      const devices = this._getJobDeviceRequirement(group);
      distribution[devices] = (distribution[devices] || 0) + 1;
      // Rough estimate: assume each test takes similar time
      totalDeviceTime += devices;
    });
    
    const theoreticalMinTime = totalDeviceTime / this._devicePool.total;
    console.log(`📊 [ANALYSIS] Test distribution:`);
    Object.entries(distribution).forEach(([devices, count]) => {
      console.log(`    ${devices}-device tests: ${count}`);
    });
    console.log(`    Theoretical minimum time: ${Math.round(theoreticalMinTime)} test durations`);
    console.log(`    Efficiency target: Keep all ${this._devicePool.total} devices busy`);
  }

  producedEnvByProjectId() {
    return this._producedEnvByProjectId;
  }

  async stop() {
    if (this._isStopped)
      return;
    this._isStopped = true;
    await Promise.all(this._workerSlots.map(({ worker }) => worker?.stop()));
    this._checkFinished();
  }
}

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
    this._remainingByTestId = new Map(this.job.tests.map((e) => [e.id, e]));
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
    if (!this._remainingByTestId.size && !this._failedTests.size && !params.fatalErrors.length && !params.skipTestsDueToSetupFailure.length && !params.fatalUnknownTestIds && !params.unexpectedExitError) {
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
    for (const failedTest of this._failedTests) {
      if (this._failedWithNonRetriableError.has(failedTest))
        continue;
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
    for (const test of retryCandidates) {
      if (test.results.length < test.retries + 1)
        remaining.push(test);
    }
    const newJob = remaining.length ? { ...this.job, tests: remaining } : void 0;
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

      // ADD THIS: Update ALLOCATED_DEVICES for reused workers
    if (this.job.allocatedDevices) {
      const allocatedDevicesStr = this.job.allocatedDevices.join(',');
      process.env.ALLOCATED_DEVICES = allocatedDevicesStr;
      console.log(`🔄 [DEBUG] Updated ALLOCATED_DEVICES for reused worker ${worker.workerIndex}: "${allocatedDevicesStr}"`);
    }

    const runPayload = {
      file: this.job.requireFile,
      entries: this.job.tests.map((test) => {
        return { testId: test.id, retry: test.results.length };
      })
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
