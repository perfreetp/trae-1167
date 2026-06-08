#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const DATA_DIR = '.mold-data';
const MOLDS_FILE = 'molds.json';
const LOGS_FILE = 'logs.json';
const CONFIG_FILE = 'config.json';
const MAINTENANCE_FILE = 'maintenance.json';
const REPAIR_FILE = 'repairs.json';

function getDataDir() {
  return path.resolve(process.cwd(), DATA_DIR);
}

function getFilePath(filename) {
  return path.join(getDataDir(), filename);
}

function ensureDataDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isInitialized() {
  return fs.existsSync(getFilePath(CONFIG_FILE));
}

function requireInit() {
  if (!isInitialized()) {
    console.error(chalk.red('错误：项目尚未初始化，请先运行 mold init'));
    process.exit(1);
  }
}

function readJson(filename) {
  const fp = getFilePath(filename);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function writeJson(filename, data) {
  ensureDataDir();
  fs.writeFileSync(getFilePath(filename), JSON.stringify(data, null, 2), 'utf-8');
}

function addLog(action, detail) {
  const logs = readJson(LOGS_FILE) || [];
  logs.push({
    time: new Date().toISOString(),
    action,
    detail
  });
  writeJson(LOGS_FILE, logs);
}

function generateId() {
  return 'M' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  DATA_DIR, MOLDS_FILE, LOGS_FILE, CONFIG_FILE, MAINTENANCE_FILE, REPAIR_FILE,
  getDataDir, getFilePath, ensureDataDir, isInitialized, requireInit,
  readJson, writeJson, addLog, generateId, today
};
