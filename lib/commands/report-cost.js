const chalk = require('chalk');
const Table = require('cli-table3');
const dayjs = require('dayjs');
const { requireInit, readJson, addLog, MOLDS_FILE, REPAIR_FILE, TRANSACTIONS_FILE } = require('../utils');

exports.describe = '成本与效率分析报表';

function buildCostData() {
  var molds = readJson(MOLDS_FILE) || [];
  var repairs = readJson(REPAIR_FILE) || [];
  var transactions = readJson(TRANSACTIONS_FILE) || [];

  var totalPurchase = 0;
  var totalRepairCost = 0;
  var totalDowntime = 0;
  var totalOutCount = transactions.length;
  var totalUsageCount = 0;

  var byCustomer = {};
  var byCategory = {};
  var byMonth = {};

  molds.forEach(function (m) {
    totalPurchase += (m.price || 0);
    totalUsageCount += (m.usedCount || 0);
  });

  repairs.forEach(function (r) {
    totalRepairCost += (r.cost || 0);
    totalDowntime += (r.downtime || 0);

    var mold = molds.find(function (m) { return m.code === r.moldCode; });
    var customer = mold ? (mold.customer || '未指定') : '未知';
    var category = mold ? (mold.category || '未指定') : '未知';
    var month = r.date ? r.date.slice(0, 7) : '未知';

    if (!byCustomer[customer]) byCustomer[customer] = { purchase: 0, repairCost: 0, downtime: 0, outCount: 0, usageCount: 0, count: 0 };
    byCustomer[customer].repairCost += (r.cost || 0);
    byCustomer[customer].downtime += (r.downtime || 0);

    if (!byCategory[category]) byCategory[category] = { purchase: 0, repairCost: 0, downtime: 0, outCount: 0, usageCount: 0, count: 0 };
    byCategory[category].repairCost += (r.cost || 0);
    byCategory[category].downtime += (r.downtime || 0);

    if (!byMonth[month]) byMonth[month] = { purchase: 0, repairCost: 0, downtime: 0, outCount: 0, usageCount: 0 };
    byMonth[month].repairCost += (r.cost || 0);
    byMonth[month].downtime += (r.downtime || 0);
  });

  molds.forEach(function (m) {
    var customer = m.customer || '未指定';
    var category = m.category || '未指定';
    var month = m.purchaseDate ? m.purchaseDate.slice(0, 7) : (m.createdAt ? m.createdAt.slice(0, 7) : '未知');

    if (!byCustomer[customer]) byCustomer[customer] = { purchase: 0, repairCost: 0, downtime: 0, outCount: 0, usageCount: 0, count: 0 };
    byCustomer[customer].purchase += (m.price || 0);
    byCustomer[customer].usageCount += (m.usedCount || 0);
    byCustomer[customer].count++;

    if (!byCategory[category]) byCategory[category] = { purchase: 0, repairCost: 0, downtime: 0, outCount: 0, usageCount: 0, count: 0 };
    byCategory[category].purchase += (m.price || 0);
    byCategory[category].usageCount += (m.usedCount || 0);
    byCategory[category].count++;

    if (!byMonth[month]) byMonth[month] = { purchase: 0, repairCost: 0, downtime: 0, outCount: 0, usageCount: 0 };
    byMonth[month].purchase += (m.price || 0);
    byMonth[month].usageCount += (m.usedCount || 0);
  });

  transactions.forEach(function (t) {
    var mold = molds.find(function (m) { return m.code === t.moldCode; });
    var customer = mold ? (mold.customer || '未指定') : '未知';
    var category = mold ? (mold.category || '未指定') : '未知';
    var outMonth = t.outDate ? t.outDate.slice(0, 7) : '未知';

    if (byCustomer[customer]) byCustomer[customer].outCount++;
    if (byCategory[category]) byCategory[category].outCount++;
    if (byMonth[outMonth]) byMonth[outMonth].outCount++;
  });

  var totalCostPerCycle = totalUsageCount > 0 ? (totalPurchase + totalRepairCost) / totalUsageCount : 0;

  return {
    totalPurchase: totalPurchase,
    totalRepairCost: totalRepairCost,
    totalDowntime: totalDowntime,
    totalOutCount: totalOutCount,
    totalUsageCount: totalUsageCount,
    totalCostPerCycle: totalCostPerCycle,
    byCustomer: byCustomer,
    byCategory: byCategory,
    byMonth: byMonth
  };
}

function reportCost() {
  requireInit();
  var data = buildCostData();

  console.log(chalk.cyan.bold('═══ 成本与效率分析报表 ═══'));
  console.log('');
  console.log(chalk.white('  采购总额:     ') + chalk.yellow('¥' + data.totalPurchase.toFixed(2)));
  console.log(chalk.white('  维修费用:     ') + chalk.red('¥' + data.totalRepairCost.toFixed(2)));
  console.log(chalk.white('  总停机:       ') + data.totalDowntime + ' 小时');
  console.log(chalk.white('  总出库次数:   ') + data.totalOutCount);
  console.log(chalk.white('  总使用模次:   ') + data.totalUsageCount);
  console.log(chalk.white('  单模次成本:   ') + chalk.cyan('¥' + data.totalCostPerCycle.toFixed(4)));
  console.log('');

  if (Object.keys(data.byCustomer).length > 0) {
    console.log(chalk.cyan.bold('── 按客户汇总 ──'));
    var custTable = new Table({
      head: [chalk.cyan('客户'), chalk.cyan('套数'), chalk.cyan('采购金额'), chalk.cyan('维修费用'), chalk.cyan('停机(h)'), chalk.cyan('出库'), chalk.cyan('模次'), chalk.cyan('单模次成本')],
      colWidths: [12, 6, 12, 12, 10, 6, 8, 12],
      style: { 'padding-left': 1, 'padding-right': 1 }
    });
    Object.entries(data.byCustomer).forEach(function (entry) {
      var d = entry[1];
      var cpc = d.usageCount > 0 ? (d.purchase + d.repairCost) / d.usageCount : 0;
      custTable.push([entry[0], d.count, '¥' + d.purchase.toFixed(0), '¥' + d.repairCost.toFixed(0), d.downtime, d.outCount, d.usageCount, '¥' + cpc.toFixed(4)]);
    });
    console.log(custTable.toString());
    console.log('');
  }

  if (Object.keys(data.byCategory).length > 0) {
    console.log(chalk.cyan.bold('── 按模具分类汇总 ──'));
    var catTable = new Table({
      head: [chalk.cyan('分类'), chalk.cyan('套数'), chalk.cyan('采购金额'), chalk.cyan('维修费用'), chalk.cyan('停机(h)'), chalk.cyan('出库'), chalk.cyan('模次'), chalk.cyan('单模次成本')],
      colWidths: [10, 6, 12, 12, 10, 6, 8, 12],
      style: { 'padding-left': 1, 'padding-right': 1 }
    });
    Object.entries(data.byCategory).forEach(function (entry) {
      var d = entry[1];
      var cpc = d.usageCount > 0 ? (d.purchase + d.repairCost) / d.usageCount : 0;
      catTable.push([entry[0], d.count, '¥' + d.purchase.toFixed(0), '¥' + d.repairCost.toFixed(0), d.downtime, d.outCount, d.usageCount, '¥' + cpc.toFixed(4)]);
    });
    console.log(catTable.toString());
    console.log('');
  }

  if (Object.keys(data.byMonth).length > 0) {
    console.log(chalk.cyan.bold('── 按月份汇总 ──'));
    var monthTable = new Table({
      head: [chalk.cyan('月份'), chalk.cyan('采购金额'), chalk.cyan('维修费用'), chalk.cyan('停机(h)'), chalk.cyan('出库次数'), chalk.cyan('使用模次'), chalk.cyan('单模次成本')],
      colWidths: [10, 12, 12, 10, 10, 10, 12],
      style: { 'padding-left': 1, 'padding-right': 1 }
    });
    Object.entries(data.byMonth).sort(function (a, b) { return a[0] > b[0] ? 1 : -1; }).forEach(function (entry) {
      var d = entry[1];
      var cpc = d.usageCount > 0 ? (d.purchase + d.repairCost) / d.usageCount : 0;
      monthTable.push([entry[0], '¥' + d.purchase.toFixed(0), '¥' + d.repairCost.toFixed(0), d.downtime, d.outCount, d.usageCount, '¥' + cpc.toFixed(4)]);
    });
    console.log(monthTable.toString());
  }

  addLog('report:cost', '查看成本效率报表');
}

function buildCostFlatData() {
  var data = buildCostData();
  var rows = [];

  rows.push({ dimension: '总计', group: '-', purchase: data.totalPurchase.toFixed(2), repairCost: data.totalRepairCost.toFixed(2), downtime: String(data.totalDowntime), outCount: String(data.totalOutCount), usageCount: String(data.totalUsageCount), costPerCycle: data.totalCostPerCycle.toFixed(4) });

  Object.entries(data.byCustomer).forEach(function (entry) {
    var d = entry[1];
    var cpc = d.usageCount > 0 ? (d.purchase + d.repairCost) / d.usageCount : 0;
    rows.push({ dimension: '客户', group: entry[0], purchase: d.purchase.toFixed(2), repairCost: d.repairCost.toFixed(2), downtime: String(d.downtime), outCount: String(d.outCount), usageCount: String(d.usageCount), costPerCycle: cpc.toFixed(4) });
  });

  Object.entries(data.byCategory).forEach(function (entry) {
    var d = entry[1];
    var cpc = d.usageCount > 0 ? (d.purchase + d.repairCost) / d.usageCount : 0;
    rows.push({ dimension: '分类', group: entry[0], purchase: d.purchase.toFixed(2), repairCost: d.repairCost.toFixed(2), downtime: String(d.downtime), outCount: String(d.outCount), usageCount: String(d.usageCount), costPerCycle: cpc.toFixed(4) });
  });

  Object.entries(data.byMonth).forEach(function (entry) {
    var d = entry[1];
    var cpc = d.usageCount > 0 ? (d.purchase + d.repairCost) / d.usageCount : 0;
    rows.push({ dimension: '月份', group: entry[0], purchase: d.purchase.toFixed(2), repairCost: d.repairCost.toFixed(2), downtime: String(d.downtime), outCount: String(d.outCount), usageCount: String(d.usageCount), costPerCycle: cpc.toFixed(4) });
  });

  return rows;
}

reportCost.buildData = buildCostFlatData;

exports.reportCost = reportCost;
