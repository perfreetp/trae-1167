const chalk = require('chalk');
const { requireInit, readJson, writeJson, addLog, today, MOLDS_FILE } = require('../utils');

exports.describe = '模具入库登记';

exports.handler = function (code, opts) {
  requireInit();

  opts = opts || {};
  const remark = opts.remark || '';

  const molds = readJson(MOLDS_FILE) || [];
  const idx = molds.findIndex(function (m) { return m.code === code; });
  if (idx === -1) {
    console.error(chalk.red('未找到模具: ' + code));
    process.exit(1);
  }

  if (molds[idx].status === 'in_stock') {
    console.error(chalk.yellow('该模具已在库中'));
    process.exit(1);
  }

  if (molds[idx].status === 'scrapped') {
    console.error(chalk.red('已报废模具无法入库'));
    process.exit(1);
  }

  const prevStatus = molds[idx].status;
  molds[idx].status = 'in_stock';
  molds[idx].lastOutPerson = '';
  molds[idx].updatedAt = new Date().toISOString();

  writeJson(MOLDS_FILE, molds);
  addLog('in', '模具 ' + code + ' 入库 (原状态: ' + prevStatus + ')' + (remark ? ' 备注: ' + remark : ''));

  console.log(chalk.green('✔ 模具 ' + code + ' 已入库'));
};
