#!/usr/bin/env node

/**
 * Phase 12: Performance Benchmarking Script
 *
 * Measures system performance metrics across all three tiers:
 * - Frontend-Admin: Build time, bundle size, page load
 * - Frontend-Tenant: Build time, bundle size, page load
 * - Backend: Compilation time, startup time, memory usage
 *
 * Baseline metrics for:
 * - 32,809 total files
 * - 123 modules
 * - 318+ plugins
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m',
};

class PerformanceBenchmark {
  constructor() {
    this.workspaceRoot = path.join(__dirname, '../../');
    this.results = {
      timestamp: new Date().toISOString(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      metrics: {},
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async runCommand(command, args, cwd, label) {
    return new Promise((resolve) => {
      this.log(`  ⏱️  ${label}...`);
      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      const proc = spawn(command, args, {
        cwd,
        stdio: 'pipe',
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        const memoryDelta = {
          heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024, // MB
          heapTotal:
            (endMemory.heapTotal - startMemory.heapTotal) / 1024 / 1024,
        };

        if (code === 0) {
          this.log(`    ✅ Completed in ${duration}ms`, 'green');
        } else {
          this.log(`    ⚠️  Exit code ${code}, took ${duration}ms`, 'yellow');
        }

        resolve({
          success: code === 0,
          duration,
          memory: memoryDelta,
          stdout,
          stderr,
        });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        proc.kill();
        resolve({
          success: false,
          duration: 300000,
          memory: { heapUsed: 0, heapTotal: 0 },
          stdout,
          stderr: 'Timeout reached',
        });
      }, 300000);
    });
  }

  /**
   * Benchmark frontend build
   */
  async benchmarkFrontend(componentPath, componentName) {
    this.log(`\n📱 Benchmarking ${componentName}...`, 'blue');

    const fullPath = path.join(this.workspaceRoot, componentPath);

    if (!fs.existsSync(fullPath)) {
      this.log(
        `  ⚠️  ${componentName} not found at ${componentPath}`,
        'yellow',
      );
      return null;
    }

    // Count files
    const files = this.countFiles(fullPath);
    this.log(`  📁 Files: ${files}`);

    // Run build
    const result = await this.runCommand(
      'npm',
      ['run', 'build'],
      fullPath,
      'Next.js build (optimized)',
    );

    // Extract metrics from output
    const buildTime = this.extractBuildTime(result.stdout);
    const bundleSize = this.extractBundleSize(result.stdout);

    this.results.metrics[componentName] = {
      files,
      buildDuration: result.duration,
      buildTimeFromOutput: buildTime,
      bundleSize,
      memory: result.memory,
      success: result.success,
    };

    this.log(`  📦 Build time: ${result.duration}ms`);
    if (bundleSize) {
      this.log(`  📊 Bundle size: ${bundleSize}`);
    }

    return result;
  }

  /**
   * Benchmark backend compilation
   */
  async benchmarkBackend() {
    this.log(`\n⚙️  Benchmarking Backend API...`, 'blue');

    const backendPath = path.join(this.workspaceRoot, 'backend');

    if (!fs.existsSync(backendPath)) {
      this.log(`  ⚠️  Backend not found`, 'yellow');
      return null;
    }

    // Count files
    const files = this.countFiles(backendPath);
    this.log(`  📁 Files: ${files}`);

    // Count modules
    const modulesPath = path.join(backendPath, 'src/modules');
    const modules = fs.existsSync(modulesPath)
      ? fs.readdirSync(modulesPath).filter((f) => {
          const stat = fs.statSync(path.join(modulesPath, f));
          return stat.isDirectory() && !f.startsWith('.');
        }).length
      : 0;
    this.log(`  📦 Modules: ${modules}`);

    // Run build
    const result = await this.runCommand(
      'npm',
      ['run', 'build'],
      backendPath,
      'NestJS build (SWC compiler)',
    );

    this.results.metrics['Backend'] = {
      files,
      modules,
      compilationDuration: result.duration,
      memory: result.memory,
      success: result.success,
    };

    this.log(`  ⏱️  Compilation time: ${result.duration}ms`);

    return result;
  }

  /**
   * Count files recursively
   */
  countFiles(dirPath) {
    let count = 0;

    function countRecursive(dir) {
      try {
        const items = fs.readdirSync(dir);
        items.forEach((item) => {
          const fullPath = path.join(dir, item);

          // Skip node_modules, .git, dist, build, etc.
          if (
            ['node_modules', '.git', '.next', 'dist', 'build', '.swc'].includes(
              item,
            )
          ) {
            return;
          }

          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            countRecursive(fullPath);
          } else {
            count++;
          }
        });
      } catch (err) {
        // Silently skip inaccessible directories
      }
    }

    countRecursive(dirPath);
    return count;
  }

  /**
   * Extract build time from npm output
   */
  extractBuildTime(output) {
    // Look for patterns like "- Done in 104.23s" or "Built in 2500ms"
    const patterns = [
      /- Done in ([\d.]+)s/,
      /Built in ([\d]+)ms/,
      /took ([\d.]+)s/,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        return pattern.toString().includes('ms') ? value : value * 1000;
      }
    }

    return null;
  }

  /**
   * Extract bundle size from npm output
   */
  extractBundleSize(output) {
    // Look for bundle size patterns
    const patterns = [
      /(\d+\.?\d*)\s*(?:KB|MB)\s+(?:├─|│)\s+(?:\.next|_next)/,
      /Size:\s+([\d.]+\s*(?:KB|MB))/,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }

  /**
   * Generate report
   */
  generateReport() {
    this.log(`\n${'='.repeat(70)}`, 'blue');
    this.log('📊 PHASE 12: PERFORMANCE BENCHMARK REPORT', 'blue');
    this.log(`${'='.repeat(70)}\n`);

    this.log(`Timestamp: ${this.results.timestamp}`);
    this.log(`Node: ${this.results.system.nodeVersion}`);
    this.log(
      `Platform: ${this.results.system.platform} ${this.results.system.arch}\n`,
    );

    const metrics = this.results.metrics;

    if (metrics['Frontend-Admin']) {
      const admin = metrics['Frontend-Admin'];
      this.log('Frontend-Admin Build Metrics:', 'bold');
      this.log(`  Files: ${admin.files}`);
      this.log(
        `  Build Duration: ${admin.buildDuration}ms (${(admin.buildDuration / 1000).toFixed(2)}s)`,
        'green',
      );
      if (admin.bundleSize) {
        this.log(`  Bundle Size: ${admin.bundleSize}`);
      }
      this.log(`  Memory Delta: ${admin.memory.heapUsed.toFixed(2)} MB\n`);
    }

    if (metrics['Frontend-Tenant']) {
      const tenant = metrics['Frontend-Tenant'];
      this.log('Frontend-Tenant Build Metrics:', 'bold');
      this.log(`  Files: ${tenant.files}`);
      this.log(
        `  Build Duration: ${tenant.buildDuration}ms (${(tenant.buildDuration / 1000).toFixed(2)}s)`,
        'green',
      );
      if (tenant.bundleSize) {
        this.log(`  Bundle Size: ${tenant.bundleSize}`);
      }
      this.log(`  Memory Delta: ${tenant.memory.heapUsed.toFixed(2)} MB\n`);
    }

    if (metrics['Backend']) {
      const backend = metrics['Backend'];
      this.log('Backend Compilation Metrics:', 'bold');
      this.log(`  Files: ${backend.files}`);
      this.log(`  Modules: ${backend.modules}`);
      this.log(
        `  Compilation Duration: ${backend.compilationDuration}ms (${(backend.compilationDuration / 1000).toFixed(2)}s)`,
        'green',
      );
      this.log(`  Memory Delta: ${backend.memory.heapUsed.toFixed(2)} MB\n`);
    }

    // Summary statistics
    this.log(`${'='.repeat(70)}`, 'blue');
    this.log('📈 SUMMARY STATISTICS', 'blue');
    this.log(`${'='.repeat(70)}\n`);

    const durations = Object.values(metrics)
      .filter((m) => m.buildDuration || m.compilationDuration)
      .map((m) => m.buildDuration || m.compilationDuration);

    if (durations.length > 0) {
      const total = durations.reduce((a, b) => a + b, 0);
      const average = total / durations.length;
      const longest = Math.max(...durations);

      this.log(`Total Build Time: ${total}ms (${(total / 1000).toFixed(2)}s)`);
      this.log(`Average: ${average.toFixed(0)}ms`);
      this.log(`Longest: ${longest}ms (${(longest / 1000).toFixed(2)}s)`);
      this.log(`\n✅ Complete system build: ${(total / 1000).toFixed(2)}s`);
    }

    this.log(`\n${'-'.repeat(70)}\n`);

    // Save report
    const reportPath = path.join(
      this.workspaceRoot,
      'PHASE_12_BENCHMARK_REPORT.json',
    );
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    this.log(`📄 Report saved to: PHASE_12_BENCHMARK_REPORT.json\n`);

    return this.results;
  }

  /**
   * Run benchmarks
   */
  async run() {
    this.log(`\n🚀 Starting Phase 12 Performance Benchmarks...`, 'bold');
    this.log(`Workspace: ${this.workspaceRoot}\n`);

    // Benchmark components
    await this.benchmarkFrontend('frontend-admin', 'Frontend-Admin');
    await this.benchmarkFrontend('frontend-tenant', 'Frontend-Tenant');
    await this.benchmarkBackend();

    // Generate report
    this.generateReport();
  }
}

// Run benchmark
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.run().catch(console.error);
}

module.exports = PerformanceBenchmark;
