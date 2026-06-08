const chalk = require('chalk');
const Table = require('cli-table3');
const { requireInit, readJson, LOGS_FILE } = require('../utils');

exports.describe = '追踪所有操作日志';

exports.handler = function (opts) {
  requireInit();
  opts = opts || {};

  let logs = readJson(LOGS_FILE) || [];

  if (opts.action) {
    const kw = opts.action.toLowerCase();
    logs = logs.filter(function (l) { return l.action.toLowerCase().includes(kw); });
  }

  if (opts.date) {
    logs = logs.filter(function (l) { return l.time.startsWith(opts.date); });
  }

  logs = logs.slice(-opts.limit).reverse();

  if (logs.length === 0) {
    console.log(chalk.yellow('暂无操作日志'));
    return;
  }

  const table = new Table({
    head: [chalk.cyan('时间'), chalk.cyan('操作'), chalk.cyan('详情')],
    colWidths: [22, 18, 50],
    style: { 'padding-left': 1, 'padding-right': 1 }
  });

  logs.forEach(function (l) {
    table.push([
      l.time.replace('T', ' ').slice(0, 19),
      l.action,
      l.detail.length > 48 ? l.detail.substring(0, 48) + '...' : l.detail
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray(`显示最近 ${logs.length} 条日志`));
};
