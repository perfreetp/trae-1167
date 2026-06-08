const chalk = require('chalk');
const Table = require('cli-table3');
const dayjs = require('dayjs');
const { requireInit, readJson, LOGS_FILE } = require('../utils');

exports.describe = '追踪所有操作日志';

exports.handler = function (opts) {
  requireInit();
  opts = opts || {};

  var logs = readJson(LOGS_FILE) || [];

  if (opts.code) {
    var codeKw = opts.code.toLowerCase();
    logs = logs.filter(function (l) {
      if (l.moldCode && l.moldCode.toLowerCase() === codeKw) return true;
      if (l.detail && l.detail.toLowerCase().includes(codeKw)) return true;
      return false;
    });
  }

  if (opts.action) {
    var actKw = opts.action.toLowerCase();
    logs = logs.filter(function (l) { return l.action.toLowerCase().includes(actKw); });
  }

  if (opts.dateFrom) {
    logs = logs.filter(function (l) { return l.time >= opts.dateFrom; });
  }

  if (opts.dateTo) {
    var toDate = opts.dateTo + 'T23:59:59';
    logs = logs.filter(function (l) { return l.time <= toDate; });
  }

  if (opts.date) {
    var dateStr = opts.date;
    logs = logs.filter(function (l) { return l.time.startsWith(dateStr); });
  }

  var limit = opts.limit || 20;
  logs = logs.slice(-limit).reverse();

  if (logs.length === 0) {
    console.log(chalk.yellow('暂无操作日志'));
    return;
  }

  var table = new Table({
    head: [chalk.cyan('时间'), chalk.cyan('操作'), chalk.cyan('模具'), chalk.cyan('详情')],
    colWidths: [20, 14, 12, 44],
    style: { 'padding-left': 1, 'padding-right': 1 }
  });

  logs.forEach(function (l) {
    var detail = l.detail || '';
    table.push([
      l.time.replace('T', ' ').slice(0, 19),
      l.action,
      l.moldCode || '-',
      detail.length > 42 ? detail.substring(0, 42) + '...' : detail
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray('显示 ' + logs.length + ' 条日志'));
};
