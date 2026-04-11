#!/usr/bin/env node
/**
 * Memory Monitoring Script
 * 
 * Real-time monitoring of PM2 processes with memory/CPU alerts
 * 
 * Usage:
 *   node scripts/monitorMemory.js
 *   node scripts/monitorMemory.js --interval 10000  # Check every 10 seconds
 *   node scripts/monitorMemory.js --slack-webhook <URL>  # Send alerts to Slack
 */

const pm2 = require('pm2');
const http = require('http');
const https = require('https');

// Configuration
const config = {
  interval: parseInt(process.env.MONITOR_INTERVAL || 30000), // 30 seconds default
  backendMemoryLimit: 1024, // MB
  frontendMemoryLimit: 512, // MB
  cpuThreshold: 80, // %
  slackWebhook: process.env.SLACK_WEBHOOK_URL || null,
};

let previousState = {};

/**
 * Send alert to Slack
 */
const sendSlackAlert = (message, severity = 'warning') => {
  if (!config.slackWebhook) return;

  const colors = {
    'error': '#FF0000',
    'warning': '#FFA500',
    'info': '#0099FF',
  };

  const payload = {
    attachments: [
      {
        color: colors[severity] || '#808080',
        title: `🚨 BassInsight Memory Alert`,
        text: message,
        ts: Math.floor(Date.now() / 1000),
      }
    ]
  };

  const url = new URL(config.slackWebhook);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(payload)),
    }
  };

  const req = https.request(options, (res) => {
    if (res.statusCode !== 200) {
      console.error(`Failed to send Slack alert: ${res.statusCode}`);
    }
  });

  req.on('error', (e) => {
    console.error(`Error sending Slack alert: ${e.message}`);
  });

  req.write(JSON.stringify(payload));
  req.end();
};

/**
 * Check process memory
 */
const checkProcesses = () => {
  pm2.list((err, processes) => {
    if (err) {
      console.error('Error retrieving PM2 processes:', err);
      return;
    }

    const timestamp = new Date().toLocaleString();
    console.log(`\n[${timestamp}] Memory Monitor Status:`);
    console.log('─'.repeat(80));

    let hasIssues = false;

    processes.forEach(process => {
      const name = process.name;
      const pid = process.pid;
      const memory = process.monit?.memory || 0;
      const cpu = process.monit?.cpu || 0;
      const status = process.pm2_env?.status || 'unknown';
      const memoryMb = Math.round(memory / 1024 / 1024);
      
      // Determine limits based on process
      const limit = name === 'backend' ? config.backendMemoryLimit : config.frontendMemoryLimit;

      // Format status
      let statusIcon = '✓';
      if (status === 'stopped') statusIcon = '⊗';
      if (status === 'stopping') statusIcon = '⧖';
      if (status === 'one-launch-status') statusIcon = '⚠';

      // Check for issues
      let alerts = [];
      if (memoryMb > limit) {
        alerts.push(`🚨 Memory exceeds limit: ${memoryMb}MB > ${limit}MB`);
        hasIssues = true;
      }
      if (cpu > config.cpuThreshold) {
        alerts.push(`⚠️ High CPU usage: ${cpu}%`);
        hasIssues = true;
      }

      // Memory trend
      const prevMemory = previousState[name] || memoryMb;
      const memoryTrend = memoryMb - prevMemory;
      const trendIcon = memoryTrend > 100 ? '📈' : memoryTrend < -100 ? '📉' : '→';
      previousState[name] = memoryMb;

      console.log(`${statusIcon} ${name.padEnd(12)} | PID: ${String(pid).padEnd(6)} | Memory: ${String(memoryMb).padStart(5)}MB / ${limit}MB ${trendIcon} | CPU: ${String(cpu).padStart(3)}% | ${status}`);

      if (alerts.length > 0) {
        alerts.forEach(alert => {
          console.log(`   ${alert}`);
          sendSlackAlert(`[${name}] ${alert}`, 'error');
        });
      }
    });

    console.log('─'.repeat(80));

    if (!hasIssues) {
      console.log('✓ All processes within healthy limits');
    }

    // Summary stats
    const totalMemory = processes.reduce((sum, p) => sum + (p.monit?.memory || 0), 0);
    const totalMemoryMb = Math.round(totalMemory / 1024 / 1024);
    console.log(`Total Memory: ${totalMemoryMb}MB | Process Count: ${processes.length}`);
  });
};

/**
 * Start monitoring
 */
const startMonitoring = () => {
  console.log('🔍 BassInsight Memory Monitor');
  console.log(`Checking every ${config.interval}ms`);
  if (config.slackWebhook) {
    console.log('📢 Slack notifications enabled');
  }
  console.log('Press Ctrl+C to stop\n');

  // Check immediately
  checkProcesses();

  // Then check periodically
  setInterval(checkProcesses, config.interval);
};

/**
 * Parse command line arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--interval' && args[i + 1]) {
      config.interval = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--slack-webhook' && args[i + 1]) {
      config.slackWebhook = args[i + 1];
      i++;
    }
  }
};

/**
 * Main
 */
pm2.connect((err) => {
  if (err) {
    console.error('Error connecting to PM2:', err);
    process.exit(1);
  }

  parseArgs();
  startMonitoring();

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n\n👋 Stopping memory monitor');
    pm2.disconnect();
    process.exit(0);
  });
});
