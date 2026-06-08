const chalk = require('chalk');
const Table = require('cli-table3');
const { requireInit, readJson, MOLDS_FILE } = require('../utils');

const STATUS_MAP = {
  in_stock: '在库',
  out_stock: '出库',
  maintenance: '保养中',
  repair: '维修中',
  scrapped: '已报废'
};

exports.describe = '列出模具清单（支持筛选）';

exports.handler = function (opts) {
  requireInit();
  opts = opts || {};

  let molds = readJson(MOLDS_FILE) || [];

  if (opts.customer) {
    const kw = opts.customer.toLowerCase();
    molds = molds.filter(function (m) { return m.customer.toLowerCase().includes(kw); });
  }
  if (opts.status) {
    molds = molds.filter(function (m) { return m.status === opts.status; });
  }
  if (opts.location) {
    const kw = opts.location.toLowerCase();
    molds = molds.filter(function (m) { return m.location.toLowerCase().includes(kw); });
  }
  if (opts.category) {
    const kw = opts.category.toLowerCase();
    molds = molds.filter(function (m) { return (m.category || '').toLowerCase().includes(kw); });
  }

  if (molds.length === 0) {
    console.log(chalk.yellow('未找到匹配的模具记录'));
    return;
  }

  const table = new Table({
    head: [chalk.cyan('编号'), chalk.cyan('名称'), chalk.cyan('客户'), chalk.cyan('状态'), chalk.cyan('库位'), chalk.cyan('寿命使用'), chalk.cyan('分类')],
    colWidths: [14, 16, 14, 10, 12, 14, 10],
    style: { 'padding-left': 1, 'padding-right': 1 }
  });

  molds.forEach(function (m) {
    const usage = m.lifespan > 0 ? Math.round(m.usedCount / m.lifespan * 100) : 0;
    const usageStr = usage >= 90 ? chalk.red(usage + '%') : usage >= 70 ? chalk.yellow(usage + '%') : usage + '%';
    const statusStr = STATUS_MAP[m.status] || m.status;

    table.push([
      m.code,
      m.name || '-',
      m.customer || '-',
      m.status === 'scrapped' ? chalk.red(statusStr) : m.status === 'out_stock' ? chalk.yellow(statusStr) : chalk.green(statusStr),
      m.location || '-',
      m.usedCount + '/' + m.lifespan + ' ' + usageStr,
      m.category || '-'
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray(`共 ${molds.length} 条记录`));
};
