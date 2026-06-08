const chalk = require('chalk');
const Table = require('cli-table3');
const { requireInit, readJson, MOLDS_FILE } = require('../utils');

exports.describe = '按编号模糊查找模具';

exports.handler = function (keyword, opts) {
  requireInit();

  const molds = readJson(MOLDS_FILE) || [];
  const kw = keyword.toLowerCase();

  const results = molds.filter(function (m) {
    return m.code.toLowerCase().includes(kw) ||
           (m.name && m.name.toLowerCase().includes(kw)) ||
           (m.customer && m.customer.toLowerCase().includes(kw));
  });

  if (results.length === 0) {
    console.log(chalk.yellow('未找到匹配 "' + keyword + '" 的模具'));
    return;
  }

  const STATUS_MAP = {
    in_stock: '在库',
    out_stock: '出库',
    maintenance: '保养中',
    repair: '维修中',
    scrapped: '已报废'
  };

  const table = new Table({
    head: [chalk.cyan('编号'), chalk.cyan('名称'), chalk.cyan('客户'), chalk.cyan('状态'), chalk.cyan('库位'), chalk.cyan('寿命使用')],
    colWidths: [14, 16, 14, 10, 12, 14],
    style: { 'padding-left': 1, 'padding-right': 1 }
  });

  results.forEach(function (m) {
    const usage = m.lifespan > 0 ? Math.round(m.usedCount / m.lifespan * 100) : 0;
    table.push([
      m.code,
      m.name || '-',
      m.customer || '-',
      STATUS_MAP[m.status] || m.status,
      m.location || '-',
      m.usedCount + '/' + m.lifespan + ' (' + usage + '%)'
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray('找到 ' + results.length + ' 条匹配记录'));
};
