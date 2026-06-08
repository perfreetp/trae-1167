const chalk = require('chalk');
const { requireInit, readJson, writeJson, addLog, generateId, today, MOLDS_FILE, TRANSACTIONS_FILE } = require('../utils');

exports.describe = '模具出库登记（借用）';

exports.handler = function (code, opts) {
  requireInit();

  opts = opts || {};
  var person = opts.person || '';
  var count = opts.count || 0;
  var remark = opts.remark || '';
  var expectedReturn = opts.expectedReturn || '';

  if (!person) {
    console.error(chalk.red('请指定领用人: -p / --person'));
    process.exit(1);
  }

  var molds = readJson(MOLDS_FILE) || [];
  var idx = molds.findIndex(function (m) { return m.code === code; });
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

  var txId = generateId();
  var outDate = today();

  var transaction = {
    id: txId,
    moldCode: code,
    moldName: molds[idx].name || '',
    person: person,
    outDate: outDate,
    expectedReturnDate: expectedReturn,
    usageCount: count,
    outRemark: remark,
    status: 'open',
    returnDate: '',
    returnRemark: '',
    createdAt: new Date().toISOString()
  };

  var transactions = readJson(TRANSACTIONS_FILE) || [];
  transactions.push(transaction);
  writeJson(TRANSACTIONS_FILE, transactions);

  molds[idx].status = 'out_stock';
  molds[idx].lastOutDate = outDate;
  molds[idx].lastOutPerson = person;
  molds[idx].usedCount += count;
  molds[idx].updatedAt = new Date().toISOString();
  writeJson(MOLDS_FILE, molds);

  addLog('out', '模具 ' + code + ' 出库, 领用人: ' + person + ', 模次+' + count + (expectedReturn ? ', 预计归还: ' + expectedReturn : '') + (remark ? ' 备注: ' + remark : ''), code);

  console.log(chalk.green('✔ 模具 ' + code + ' 已出库'));
  console.log(chalk.gray('  流转单号: ' + txId));
  console.log(chalk.gray('  领用人:   ' + person));
  if (expectedReturn) {
    console.log(chalk.gray('  预计归还: ' + expectedReturn));
  }
  if (count > 0) {
    console.log(chalk.gray('  已用模次: ' + molds[idx].usedCount + ' (+' + count + ')'));
  }
};
