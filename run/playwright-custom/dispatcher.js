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
  
  return redisInitPromise;
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
    this._localJobMap = new Map();

    
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
      jobQueue: 'playwright:jobs:queue',
      workerStatus: 'playwright:workers:status',
      stats: 'playwright:stats'
    };
  }

  async _initializeRedis() {
    this._redis = await getRedis();
    
    // Clean up any previous state
    await this._redis.del(
      this._redisKeys.devicesAvailable,
      this._redisKeys.devicesAllocations,
      this._redisKeys.staggerLock,
      this._redisKeys.jobQueue,
      this._redisKeys.workerStatus,
      this._redisKeys.stats
    );
    
    // Initialize device pool in Redis
    const devices = Array.from({ length: this._devicePoolSize }, (_, i) => String(i));
    if (devices.length > 0) {
      await this._redis.rPush(this._redisKeys.devicesAvailable, ...devices);
    }
    
    console.log(`🎮 [DEVICE_POOL] Initialized ${this._devicePoolSize} devices in Redis`);
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
    if (this._isStopped) return;
    
    const availableDevices = await this._redis.lLen(this._redisKeys.devicesAvailable);
    console.log(`\n🔄 [SCHEDULER] Running scheduler (${availableDevices}/${this._devicePoolSize} devices available)`);
    
    // Process jobs from Redis queue
    await this._processJobQueue();
    
    // Check local queue for any remaining jobs
    await this._processLocalQueue();
  }

  async _processJobQueue() {
    // Get jobs from Redis queue
    const queueLength = await this._redis.zCard(this._redisKeys.jobQueue);
    if (queueLength === 0) return;
    
    // Get top jobs that might be runnable
    const jobs = await this._redis.zRange(this._redisKeys.jobQueue, 0, 20);
    
    for (const jobStr of jobs) {
     const jobData = JSON.parse(jobStr);
    const job = this._localJobMap.get(jobData._localJobRef);

    if (!job) {
      console.error(`❌ [ERROR] Job ${jobData.id} not found in local map!`);
      await this._redis.zRem(this._redisKeys.jobQueue, jobStr);
      continue; // Skip this job
    }
          const scheduled = await this._tryScheduleJob(job, job.devices);

      if (scheduled) {
        // Remove from queue
        await this._redis.zRem(this._redisKeys.jobQueue, jobStr);
      } else {
        // Can't schedule this or any larger jobs
        break;
      }
    }
  }

  async _processLocalQueue() {
    const remainingJobs = [];
    
    for (const job of this._queue) {
      const devices = this._getJobDeviceRequirement(job);
      const priority = devices || 0; // Default to 0 if no devices found

      // Also add a check before adding to Redis
      if (!Number.isFinite(priority)) {
        console.warn(`⚠️ Invalid priority ${priority} for job, using 0`);
        priority = 0;
      }      
      if (!this._canRunBasedOnProjectLimits(job)) {
        remainingJobs.push(job);
        continue;
      }
      
      // In _processLocalQueue, when adding to Redis queue:
      const jobData = {
        id: `job-${Date.now()}-${Math.random()}`,
        devices,
        workerHash: job.workerHash,
        projectId: job.projectId,
        requireFile: job.requireFile,
        testIds: job.tests.map(t => t.id),
        _localJobRef: Math.random()
      };

      // Store the actual job object locally
      this._localJobMap.set(jobData._localJobRef, job);

      await this._redis.zAdd(this._redisKeys.jobQueue, {
        score: priority || 0,
        value: JSON.stringify(jobData)
      });


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

  async _tryScheduleJob(job, devices) {
    // Stagger check for 4-device tests
    if (devices >= 3 && this._completedTests < 5) {
      const canProceed = await this._checkStagger(devices);
      if (!canProceed) return false;
    }
    
    console.log(`🔍 [TRY_SCHEDULE] Trying to schedule job needing ${devices} devices`);
    
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
      console.log(`   ❌ Not enough devices (need ${devices}, have ${availableDevices})`);
      return false;
    }
    console.log(`🔍 [DEBUG] Worker slots:`, this._workerSlots.map((w, i) => ({
      index: i,
      busy: w.busy,
      hasWorker: !!w.worker
    })));

    console.log(`🔍 [DEBUG] Job properties:`, {
      hasWorkerHash: !!job.workerHash,
      hasTests: !!job.tests,
      testCount: job.tests?.length
    });
    // Find available worker
    let workerIndex = this._workerSlots.findIndex(
      (w) => !w.busy && w.worker && w.worker.hash() === job.workerHash && !w.worker.didSendStop()
    );
    if (workerIndex === -1) {
      workerIndex = this._workerSlots.findIndex((w) => !w.busy);
    }
    
    if (workerIndex === -1) {
      console.log(`   ❌ No available workers`);
      return false;
    }
    
    console.log(`   ✅ Found available worker ${workerIndex}`);
    
      // Allocate devices from Redis
    if (devices > 0) {
      const allocatedIndices = await this._allocateDeviceIndices(devices);
      if (!allocatedIndices) return false;
      
      // Update available count
      const availableNow = await this._redis.lLen(this._redisKeys.devicesAvailable);
      this._devicePool.available = availableNow;
      
      // Store allocation
      const allocationKey = `worker-${workerIndex}`;
      await this._redis.hSet(
        this._redisKeys.devicesAllocations,
        allocationKey,
        JSON.stringify({
          devices: allocatedIndices,
          jobId: job.id || 'unknown'
        })
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
      
      // Schedule next job
      this._scheduleJob();
      this._checkFinished();
    });
    
    return true;
  }

  async _checkStagger(devices) {
    const staggerKey = `${this._redisKeys.staggerLock}:${devices}`;
    const interval = devices === 4 ? 30000 : 20000;
    
    // Try to acquire lock
    const result = await this._redis.set(
      staggerKey,
      Date.now(),
      'PX', interval,  // Expire after interval
      'NX'             // Only set if not exists
    );
    
    if (result === 'OK') {
      console.log(`✅ [STAGGER] Acquired lock for ${devices}-device test`);
      return true;
    }
    
    // Check TTL to see how long to wait
    const ttl = await this._redis.pttl(staggerKey);
    if (ttl > 0) {
      console.log(`⏳ [STAGGER] Must wait ${(ttl/1000).toFixed(1)}s for ${devices}-device test`);
    }
    
    return false;
  }

  async _deallocateDevices(workerIndex) {
    const allocationKey = `worker-${workerIndex}`;
    const allocation = await this._redis.hGet(this._redisKeys.devicesAllocations, allocationKey);
    
    if (allocation) {
      const data = JSON.parse(allocation);
      const devices = data.devices || data; // Handle both old and new format
      
      if (devices.length > 0) {
        await this._redis.rPush(this._redisKeys.devicesAvailable, ...devices.map(String));
      }
      
      await this._redis.hDel(this._redisKeys.devicesAllocations, allocationKey);
      
      // Update available count
      const availableNow = await this._redis.lLen(this._redisKeys.devicesAvailable);
      this._devicePool.available = availableNow;
      
      console.log(`🔓 [DEVICES] Worker ${workerIndex} released devices: ${devices.join(', ')}`);
    }
  }

  async _allocateDeviceIndices(count) {
    const allocated = [];
    
    // Pop devices from Redis
    for (let i = 0; i < count; i++) {
      const device = await this._redis.lPop(this._redisKeys.devicesAvailable);
      if (device === null) {
        // Failed, return what we got
        if (allocated.length > 0) {
          await this._redis.rPush(this._redisKeys.devicesAvailable, ...allocated.map(String));
        }
        return null;
      }
      allocated.push(parseInt(device));
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
    if (!test) return 0;
    
    const deviceMatch = test.title?.match(/@(\d+)-devices/);
    return deviceMatch ? parseInt(deviceMatch[1]) : 0;
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
    if (worker && (worker.hash() !== job.workerHash || worker.didSendStop())) {
      await worker.stop();
      worker = void 0;
      if (this._isStopped) return;
    }
    
    let startError;
    if (!worker) {
      worker = this._createWorker(job, index, (0, import_ipc.serializeConfig)(this._config, true));
      this._workerSlots[index].worker = worker;
      worker.on("exit", () => this._workerSlots[index].worker = void 0);
      startError = await worker.start();
      if (this._isStopped) return;
    }
    
    if (startError) {
      jobDispatcher.onExit(startError);
    } else {
      jobDispatcher.runInWorker(worker);
    }
    
    const result = await jobDispatcher.jobResult;
    this._updateCounterForWorkerHash(job.workerHash, -1);
    
    if (result.didFail) {
      void worker.stop(true);
    } else if (this._isWorkerRedundant(worker)) {
      void worker.stop();
    }
    
    if (!this._isStopped && result.newJob) {
      this._queue.unshift(result.newJob);
      this._updateCounterForWorkerHash(result.newJob.workerHash, 1);
    }
    
    this._lastWorkerActivity.set(index, Date.now());
  }

  async _checkFinished() {
    if (this._finished.isDone()) return;
    
    // Check Redis queue
    const queueLength = await this._redis.zCard(this._redisKeys.jobQueue);
    
    if ((this._queue.length || queueLength) && !this._isStopped) return;
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
    const stats = await this._redis.hGetall(this._redisKeys.stats);
    if (stats.totalAllocations) {
      console.log("\n📊 [STATS] Final Statistics:");
      console.log(`    Total device allocations: ${stats.totalAllocations || 0}`);
      console.log(`    Device pool size: ${this._devicePoolSize}`);
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
    // Initialize Redis
    await this._initializeRedis();
    
    this._extraEnvByProjectId = extraEnvByProjectId;
    
    // Sort test groups by device requirement (First Fit Decreasing)
    this._queue = this._optimizeTestOrder(testGroups);
    
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
    
    if (this._failureTracker.hasReachedMaxFailures()) {
      void this.stop();
    }
    
    // Start workers
    const initialWorkers = Math.min(this._maxWorkers, testGroups.length, 3);
    console.log(`🚀 [WORKERS] Starting with ${initialWorkers} workers`);
    
    for (let i = 0; i < initialWorkers; i++) {
      this._workerSlots.push({ busy: false });
    }
    
    // Start scheduling
    for (let i = 0; i < this._workerSlots.length; i++) {
      this._scheduleJob();
    }
    
    // Start worker management
    if (this._dynamicWorkerScaling) {
      this._startWorkerManagement();
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
    // First Fit Decreasing
    const testsWithDevices = testGroups.map(group => ({
      group,
      devices: this._getJobDeviceRequirement(group)
    }));
    
    // Sort by devices needed (descending)
    testsWithDevices.sort((a, b) => b.devices - a.devices);
    
    return testsWithDevices.map(item => item.group);
  }

  _startWorkerManagement() {
    this._workerManagementInterval = setInterval(async () => {
      await this._adjustWorkerPool();
    }, 5000);
  }

  async _adjustWorkerPool() {
    if (this._isStopped) return;
    
    const activeWorkers = this._workerSlots.filter(w => w.busy).length;
    const idleWorkers = this._workerSlots.length - activeWorkers;
    const queueLength = await this._redis.zCard(this._redisKeys.jobQueue) + this._queue.length;
    const availableDevices = await this._redis.lLen(this._redisKeys.devicesAvailable);
    
    console.log(`🔍 [WORKER_POOL] Workers: ${activeWorkers} active, ${idleWorkers} idle | Queue: ${queueLength} | Devices: ${availableDevices}/${this._devicePoolSize} available`);
    
    // Scale up if needed
    if (queueLength > 0 && availableDevices > 0 && idleWorkers === 0 && this._workerSlots.length < this._maxWorkers) {
      console.log(`📈 [WORKERS] Scaling up: adding 1 worker`);
      this._addWorker();
    }
    
    // Scale down if too many idle
    if (idleWorkers > 1 && this._workerSlots.length > this._minWorkers) {
      const toRemove = Math.min(idleWorkers - 1, this._workerSlots.length - this._minWorkers);
      if (toRemove > 0) {
        console.log(`📉 [WORKERS] Scaling down: removing ${toRemove} idle workers`);
        this._removeIdleWorkers(toRemove);
      }
    }
  }

  _addWorker() {
    const newIndex = this._workerSlots.length;
    this._workerSlots.push({ busy: false });
    this._lastWorkerActivity.set(newIndex, Date.now());
    this._scheduleJob();
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
    
    const allocatedDevicesStr = testGroup.allocatedDevices ? testGroup.allocatedDevices.join(',') : '';
    
    const extraEnv = {
      ...(this._extraEnvByProjectId.get(testGroup.projectId) || {}),
      ALLOCATED_DEVICES: allocatedDevicesStr,
      TEST_WORKER_INDEX: String(parallelIndex)  // Important for stagger!
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
    
    if (this.job.allocatedDevices) {
      const allocatedDevicesStr = this.job.allocatedDevices.join(',');
      process.env.ALLOCATED_DEVICES = allocatedDevicesStr;
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