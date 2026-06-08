const chalk = require('chalk');
const { requireInit, readJson, writeJson, addLog, today, MOLDS_FILE, TRANSACTIONS_FILE } = require('../utils');

exports.describe = '模具入库登记（归还）';

exports.handler = function (code, opts) {
  requireInit();

  opts = opts || {};
  var remark = opts.remark || '';
  var returnDate = opts.returnDate || today();
  var txId = opts.tx || '';

  var molds = readJson(MOLDS_FILE) || [];
  var idx = molds.findIndex(function (m) { return m.code === code; });
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

  var transactions = readJson(TRANSACTIONS_FILE) || [];
  var openTx = transactions.filter(function (t) {
    return t.moldCode === code && t.status === 'open';
  });

  var targetTx = null;

  if (txId) {
    targetTx = transactions.find(function (t) { return t.id === txId && t.moldCode === code; });
    if (!targetTx) {
      console.error(chalk.red('未找到流转记录: ' + txId + ' (模具: ' + code + ')'));
      process.exit(1);
    }
    if (targetTx.status !== 'open') {
      console.error(chalk.yellow('该流转记录已归还'));
      process.exit(1);
    }
  } else if (openTx.length > 0) {
    targetTx = openTx[openTx.length - 1];
    if (openTx.length > 1) {
      console.log(chalk.yellow('发现 ' + openTx.length + ' 条未归还记录，自动匹配最新一条: ' + targetTx.id));
      console.log(chalk.gray('  使用 --tx <单号> 可指定归还记录'));
    }
  }

  var prevStatus = molds[idx].status;
  molds[idx].status = 'in_stock';
  molds[idx].lastOutPerson = '';
  molds[idx].updatedAt = new Date().toISOString();
  writeJson(MOLDS_FILE, molds);

  if (targetTx) {
    var txIdx = transactions.findIndex(function (t) { return t.id === targetTx.id; });
    transactions[txIdx].status = 'returned';
    transactions[txIdx].returnDate = returnDate;
    transactions[txIdx].returnRemark = remark;
    writeJson(TRANSACTIONS_FILE, transactions);

    var wasOverdue = targetTx.expectedReturnDate && returnDate > targetTx.expectedReturnDate;
    addLog('in', '模具 ' + code + ' 入库 (原状态: ' + prevStatus + '), 归还单号: ' + targetTx.id + (wasOverdue ? ', 逾期归还' : '') + (remark ? ' 备注: ' + remark : ''), code);

    console.log(chalk.green('✔ 模具 ' + code + ' 已入库'));
    console.log(chalk.gray('  归还单号: ' + targetTx.id));
    console.log(chalk.gray('  出库日期: ' + targetTx.outDate));
    console.log(chalk.gray('  归还日期: ' + returnDate));
    if (targetTx.expectedReturnDate) {
      if (wasOverdue) {
        console.log(chalk.red('  ⚠ 逾期归还 (预计: ' + targetTx.expectedReturnDate + ')'));
      } else {
        console.log(chalk.gray('  预计归还: ' + targetTx.expectedReturnDate));
      }
    }
  } else {
    addLog('in', '模具 ' + code + ' 入库 (原状态: ' + prevStatus + ')' + (remark ? ' 备注: ' + remark : ''), code);
    console.log(chalk.green('✔ 模具 ' + code + ' 已入库'));
  }
};
