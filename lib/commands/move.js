const chalk = require('chalk');
const { requireInit, readJson, writeJson, addLog, MOLDS_FILE } = require('../utils');

exports.describe = '调整模具库位';

exports.handler = function (code, opts) {
  requireInit();

  opts = opts || {};
  const to = opts.to || '';

  if (!to) {
    console.error(chalk.red('请指定目标库位: -t / --to'));
    process.exit(1);
  }

  const molds = readJson(MOLDS_FILE) || [];
  const idx = molds.findIndex(function (m) { return m.code === code; });
  if (idx === -1) {
    console.error(chalk.red('未找到模具: ' + code));
    process.exit(1);
  }

  if (molds[idx].status === 'scrapped') {
    console.error(chalk.red('已报废模具无法调整库位'));
    process.exit(1);
  }

  const prevLocation = molds[idx].location;
  molds[idx].location = to;
  molds[idx].updatedAt = new Date().toISOString();

  writeJson(MOLDS_FILE, molds);
  addLog('move', '模具 ' + code + ' 库位变更: ' + (prevLocation || '(空)') + ' → ' + to, code);

  console.log(chalk.green('✔ 模具 ' + code + ' 库位已调整'));
  console.log(chalk.gray('  ' + (prevLocation || '(空)') + ' → ' + to));
};
