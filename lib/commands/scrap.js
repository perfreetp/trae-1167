const chalk = require('chalk');
const { requireInit, readJson, writeJson, addLog, today, MOLDS_FILE } = require('../utils');

exports.describe = '标记模具报废并记录原因';

exports.handler = function (code, opts) {
  requireInit();

  opts = opts || {};
  const reason = opts.reason || '';

  if (!reason) {
    console.error(chalk.red('请指定报废原因: -r / --reason'));
    process.exit(1);
  }

  const molds = readJson(MOLDS_FILE) || [];
  const idx = molds.findIndex(function (m) { return m.code === code; });
  if (idx === -1) {
    console.error(chalk.red('未找到模具: ' + code));
    process.exit(1);
  }

  if (molds[idx].status === 'scrapped') {
    console.error(chalk.yellow('该模具已报废'));
    process.exit(1);
  }

  const prevStatus = molds[idx].status;
  molds[idx].status = 'scrapped';
  molds[idx].scrapReason = reason;
  molds[idx].scrapDate = today();
  molds[idx].updatedAt = new Date().toISOString();

  writeJson(MOLDS_FILE, molds);
  addLog('scrap', '模具 ' + code + ' 报废, 原因: ' + reason);

  console.log(chalk.green('✔ 模具 ' + code + ' 已标记报废'));
  console.log(chalk.gray('  原状态: ' + prevStatus));
  console.log(chalk.gray('  报废原因: ' + reason));
  console.log(chalk.gray('  报废日期: ' + today()));
};
