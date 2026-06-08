const chalk = require('chalk');
const { requireInit, readJson, writeJson, addLog, today, MOLDS_FILE } = require('../utils');

exports.describe = '模具出库登记';

exports.handler = function (code, opts) {
  requireInit();

  opts = opts || {};
  const person = opts.person || '';
  const count = opts.count || 0;
  const remark = opts.remark || '';

  if (!person) {
    console.error(chalk.red('请指定领用人: -p / --person'));
    process.exit(1);
  }

  const molds = readJson(MOLDS_FILE) || [];
  const idx = molds.findIndex(function (m) { return m.code === code; });
  if (idx === -1) {
    console.error(chalk.red('未找到模具: ' + code));
    process.exit(1);
  }

  if (molds[idx].status === 'out_stock') {
    console.error(chalk.yellow('该模具已处于出库状态'));
    process.exit(1);
  }

  if (molds[idx].status === 'scrapped') {
    console.error(chalk.red('已报废模具无法出库'));
    process.exit(1);
  }

  const prevStatus = molds[idx].status;
  molds[idx].status = 'out_stock';
  molds[idx].lastOutDate = today();
  molds[idx].lastOutPerson = person;
  molds[idx].usedCount += count;
  molds[idx].updatedAt = new Date().toISOString();

  writeJson(MOLDS_FILE, molds);
  addLog('out', '模具 ' + code + ' 出库, 领用人: ' + person + ', 模次+' + count + (remark ? ' 备注: ' + remark : ''));

  console.log(chalk.green('✔ 模具 ' + code + ' 已出库'));
  console.log(chalk.gray('  领用人: ' + person));
  if (count > 0) {
    console.log(chalk.gray('  已用模次: ' + molds[idx].usedCount + ' (+' + count + ')'));
  }
};
