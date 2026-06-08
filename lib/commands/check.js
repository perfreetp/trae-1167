const chalk = require('chalk');
const Table = require('cli-table3');
const { requireInit, readJson, writeJson, addLog, MOLDS_FILE, TRANSACTIONS_FILE, REPAIR_FILE, MAINTENANCE_FILE } = require('../utils');

exports.describe = '数据校准：检查并修复台账不一致';

function runCheck() {
  var molds = readJson(MOLDS_FILE) || [];
  var transactions = readJson(TRANSACTIONS_FILE) || [];
  var issues = [];

  molds.forEach(function (mold) {
    var moldTx = transactions.filter(function (t) { return t.moldCode === mold.code; });
    var openTx = moldTx.filter(function (t) { return t.status === 'open'; });

    if (mold.status === 'out_stock' && openTx.length === 0) {
      issues.push({
        code: mold.code,
        type: 'status_tx_mismatch',
        desc: '状态为出库但无未归还流转单',
        current: 'mold.status=out_stock, openTx=0',
        fix: 'mold.status=in_stock'
      });
    }

    if (mold.status !== 'out_stock' && mold.status !== 'scrapped' && openTx.length > 0) {
      issues.push({
        code: mold.code,
        type: 'status_tx_mismatch',
        desc: '有未归还流转单但状态非出库',
        current: 'mold.status=' + mold.status + ', openTx=' + openTx.length,
        fix: 'mold.status=out_stock'
      });
    }

    if (mold.status === 'scrapped') {
      if (!mold.scrapDate) {
        issues.push({
          code: mold.code,
          type: 'scrap_incomplete',
          desc: '已报废但无报废日期',
          current: 'scrapDate=空',
          fix: 'scrapDate=今天'
        });
      }
      if (!mold.scrapReason) {
        issues.push({
          code: mold.code,
          type: 'scrap_incomplete',
          desc: '已报废但无报废原因',
          current: 'scrapReason=空',
          fix: 'scrapReason=未填写'
        });
      }
    }

    if (mold.status !== 'scrapped' && mold.scrapDate) {
      issues.push({
        code: mold.code,
        type: 'scrap_status_mismatch',
        desc: '有报废日期但状态非报废',
        current: 'mold.status=' + mold.status + ', scrapDate=' + mold.scrapDate,
        fix: 'mold.status=scrapped'
      });
    }

    if (mold.status === 'out_stock' && !mold.lastOutPerson && openTx.length > 0) {
      issues.push({
        code: mold.code,
        type: 'out_info_missing',
        desc: '出库状态但无领用人信息',
        current: 'lastOutPerson=空',
        fix: 'lastOutPerson=' + openTx[0].person
      });
    }

    if (mold.usedCount < 0) {
      issues.push({
        code: mold.code,
        type: 'invalid_count',
        desc: '已用模次为负数',
        current: 'usedCount=' + mold.usedCount,
        fix: 'usedCount=0'
      });
    }

    if (mold.lifespan < 0) {
      issues.push({
        code: mold.code,
        type: 'invalid_count',
        desc: '设计寿命为负数',
        current: 'lifespan=' + mold.lifespan,
        fix: 'lifespan=0'
      });
    }

    if (mold.price < 0) {
      issues.push({
        code: mold.code,
        type: 'invalid_count',
        desc: '采购价格为负数',
        current: 'price=' + mold.price,
        fix: 'price=0'
      });
    }
  });

  return issues;
}

function fixIssues(issues) {
  var molds = readJson(MOLDS_FILE) || [];
  var transactions = readJson(TRANSACTIONS_FILE) || [];
  var today = new Date().toISOString().slice(0, 10);
  var fixed = [];

  issues.forEach(function (issue) {
    var idx = molds.findIndex(function (m) { return m.code === issue.code; });
    if (idx === -1) return;

    var before = JSON.stringify(molds[idx]);

    switch (issue.type) {
      case 'status_tx_mismatch':
        if (issue.fix === 'mold.status=in_stock') {
          molds[idx].status = 'in_stock';
          molds[idx].lastOutPerson = '';
        } else if (issue.fix === 'mold.status=out_stock') {
          var openTx = transactions.filter(function (t) { return t.moldCode === issue.code && t.status === 'open'; });
          if (openTx.length > 0) {
            molds[idx].status = 'out_stock';
            molds[idx].lastOutPerson = openTx[0].person;
            molds[idx].lastOutDate = openTx[0].outDate;
          }
        }
        break;
      case 'scrap_incomplete':
        if (issue.fix === 'scrapDate=今天') {
          molds[idx].scrapDate = today;
        } else if (issue.fix === 'scrapReason=未填写') {
          molds[idx].scrapReason = '未填写';
        }
        break;
      case 'scrap_status_mismatch':
        molds[idx].status = 'scrapped';
        break;
      case 'out_info_missing':
        if (issue.fix.startsWith('lastOutPerson=')) {
          var person = issue.fix.split('=')[1];
          molds[idx].lastOutPerson = person;
        }
        break;
      case 'invalid_count':
        if (issue.fix === 'usedCount=0') molds[idx].usedCount = 0;
        if (issue.fix === 'lifespan=0') molds[idx].lifespan = 0;
        if (issue.fix === 'price=0') molds[idx].price = 0;
        break;
    }

    molds[idx].updatedAt = new Date().toISOString();
    var after = JSON.stringify(molds[idx]);
    if (before !== after) {
      fixed.push({ code: issue.code, type: issue.type, desc: issue.desc });
    }
  });

  writeJson(MOLDS_FILE, molds);

  fixed.forEach(function (f) {
    addLog('check', '校准修复: ' + f.code + ' - ' + f.desc, f.code);
  });

  return fixed;
}

exports.handler = function (opts) {
  requireInit();
  opts = opts || {};

  var issues = runCheck();

  if (issues.length === 0) {
    console.log(chalk.green('✔ 台账数据一致性检查通过，未发现不一致'));
    addLog('check', '数据校准检查: 通过');
    return;
  }

  console.log(chalk.red.bold('⚠ 发现 ' + issues.length + ' 处数据不一致'));
  console.log('');

  var table = new Table({
    head: [chalk.cyan('编号'), chalk.cyan('类型'), chalk.cyan('描述'), chalk.cyan('当前值'), chalk.cyan('修正方案')],
    colWidths: [12, 20, 24, 24, 24],
    style: { 'padding-left': 1, 'padding-right': 1 }
  });

  issues.forEach(function (issue) {
    table.push([issue.code, chalk.yellow(issue.type), issue.desc, chalk.gray(issue.current), chalk.green(issue.fix)]);
  });

  console.log(table.toString());
  console.log('');

  if (opts.fix) {
    var fixed = fixIssues(issues);
    console.log(chalk.green('✔ 已修复 ' + fixed.length + ' 处不一致'));
    fixed.forEach(function (f) {
      console.log(chalk.gray('  ' + f.code + ': ' + f.desc));
    });
  } else {
    console.log(chalk.yellow('使用 --fix 参数可一键修正以上不一致'));
  }

  addLog('check', '数据校准检查: 发现' + issues.length + '处不一致' + (opts.fix ? ', 已修复' : ''));
};
