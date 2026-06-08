const chalk = require('chalk');
const Table = require('cli-table3');
const dayjs = require('dayjs');
const { requireInit, readJson, addLog, today, MOLDS_FILE, REPAIR_FILE, MAINTENANCE_FILE, CONFIG_FILE } = require('../utils');
const warnModule = require('./warn');

exports.describe = '生成统计报表';

function buildUtilizationData() {
  var molds = readJson(MOLDS_FILE) || [];
  if (molds.length === 0) return null;

  var active = molds.filter(function (m) { return m.status !== 'scrapped'; });
  var inStock = active.filter(function (m) { return m.status === 'in_stock'; });
  var outStock = active.filter(function (m) { return m.status === 'out_stock'; });
  var inMaint = active.filter(function (m) { return m.status === 'maintenance' || m.status === 'repair'; });
  var scrapped = molds.filter(function (m) { return m.status === 'scrapped'; });
  var totalUsed = active.reduce(function (s, m) { return s + m.usedCount; }, 0);
  var totalLifespan = active.reduce(function (s, m) { return s + m.lifespan; }, 0);
  var avgUsage = totalLifespan > 0 ? Math.round(totalUsed / totalLifespan * 100) : 0;

  var byCustomer = {};
  active.forEach(function (m) {
    var key = m.customer || '未指定';
    if (!byCustomer[key]) byCustomer[key] = { total: 0, out: 0, inStock: 0, maint: 0 };
    byCustomer[key].total++;
    if (m.status === 'out_stock') byCustomer[key].out++;
    if (m.status === 'in_stock') byCustomer[key].inStock++;
    if (m.status === 'maintenance' || m.status === 'repair') byCustomer[key].maint++;
  });

  return {
    total: molds.length,
    active: active.length,
    inStock: inStock.length,
    outStock: outStock.length,
    inMaint: inMaint.length,
    scrapped: scrapped.length,
    avgUsage: avgUsage,
    stockRate: active.length > 0 ? (inStock.length / active.length * 100).toFixed(1) : '0.0',
    usageRate: active.length > 0 ? (outStock.length / active.length * 100).toFixed(1) : '0.0',
    byCustomer: byCustomer
  };
}

function reportUtilization() {
  var data = buildUtilizationData();
  if (!data) { console.log(chalk.yellow('暂无模具数据')); return; }

  console.log(chalk.cyan.bold('═══ 模具利用率报表 ═══'));
  console.log('');
  console.log(chalk.white('  总模具数: ') + data.total);
  console.log(chalk.white('  在库:     ') + chalk.green(data.inStock) + ' (' + (data.inStock / data.total * 100).toFixed(1) + '%)');
  console.log(chalk.white('  出库使用: ') + chalk.yellow(data.outStock) + ' (' + (data.outStock / data.total * 100).toFixed(1) + '%)');
  console.log(chalk.white('  保养/维修: ') + chalk.blue(data.inMaint) + ' (' + (data.inMaint / data.total * 100).toFixed(1) + '%)');
  console.log(chalk.white('  已报废:   ') + chalk.red(data.scrapped) + ' (' + (data.scrapped / data.total * 100).toFixed(1) + '%)');
  console.log('');
  console.log(chalk.white('  平均寿命使用率: ') + (data.avgUsage >= 80 ? chalk.red(data.avgUsage + '%') : data.avgUsage >= 60 ? chalk.yellow(data.avgUsage + '%') : chalk.green(data.avgUsage + '%')));
  console.log(chalk.white('  在库率: ') + data.stockRate + '%');
  console.log(chalk.white('  使用率: ') + data.usageRate + '%');

  if (Object.keys(data.byCustomer).length > 0) {
    console.log('');
    console.log(chalk.cyan('  按客户统计:'));
    Object.entries(data.byCustomer).forEach(function (entry) {
      var rate = (entry[1].out / entry[1].total * 100).toFixed(1);
      console.log(chalk.gray('    ' + entry[0] + ': ' + entry[1].total + '套, 使用率 ' + rate + '%'));
    });
  }

  addLog('report:utilization', '查看利用率报表');
}

function buildRepairRateData() {
  var molds = readJson(MOLDS_FILE) || [];
  var repairs = readJson(REPAIR_FILE) || [];
  var thisMonth = dayjs().format('YYYY-MM');

  var monthlyRepairs = repairs.filter(function (r) { return r.date.startsWith(thisMonth); });
  var repairedCodes = new Set(monthlyRepairs.map(function (r) { return r.moldCode; }));
  var activeMolds = molds.filter(function (m) { return m.status !== 'scrapped'; });
  var repairRate = activeMolds.length > 0 ? (repairedCodes.size / activeMolds.length * 100).toFixed(1) : '0.0';
  var totalCost = monthlyRepairs.reduce(function (s, r) { return s + (r.cost || 0); }, 0);
  var totalDowntime = monthlyRepairs.reduce(function (s, r) { return s + (r.downtime || 0); }, 0);

  var moldRepairCount = {};
  monthlyRepairs.forEach(function (r) {
    moldRepairCount[r.moldCode] = (moldRepairCount[r.moldCode] || 0) + 1;
  });

  return {
    month: thisMonth,
    repairRate: repairRate,
    repairCount: monthlyRepairs.length,
    affectedMolds: repairedCodes.size,
    totalCost: totalCost,
    totalDowntime: totalDowntime,
    frequentMolds: Object.entries(moldRepairCount).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5)
  };
}

function reportRepairRate() {
  var data = buildRepairRateData();

  console.log(chalk.cyan.bold('═══ 维修率报表 (' + data.month + ') ═══'));
  console.log('');
  console.log(chalk.white('  月维修率: ') + chalk.yellow(data.repairRate + '%'));
  console.log(chalk.white('  维修次数: ') + data.repairCount);
  console.log(chalk.white('  涉及模具: ') + data.affectedMolds + ' 套');
  console.log(chalk.white('  总停机:   ') + data.totalDowntime + ' 小时');
  console.log(chalk.white('  总费用:   ') + chalk.red('¥' + data.totalCost.toFixed(2)));

  if (data.frequentMolds.length > 0) {
    console.log('');
    console.log(chalk.cyan('  频繁维修TOP5:'));
    data.frequentMolds.forEach(function (entry) {
      console.log(chalk.gray('    ' + entry[0] + ': ' + entry[1] + '次'));
    });
  }

  addLog('report:repair-rate', '查看维修率报表');
}

function buildIdleData() {
  var molds = readJson(MOLDS_FILE) || [];
  var idle = molds.filter(function (m) {
    if (m.status !== 'in_stock') return false;
    if (!m.lastOutDate) {
      var baseline = m.purchaseDate || (m.createdAt ? m.createdAt.slice(0, 10) : '');
      if (!baseline) return true;
      return dayjs().diff(dayjs(baseline), 'day') > 30;
    }
    return dayjs().diff(dayjs(m.lastOutDate), 'day') > 30;
  });

  return idle.map(function (m) {
    var baseline = m.lastOutDate || m.purchaseDate || (m.createdAt ? m.createdAt.slice(0, 10) : '');
    var idleDays = baseline ? dayjs().diff(dayjs(baseline), 'day') : '未知';
    return {
      code: m.code,
      name: m.name || '-',
      customer: m.customer || '-',
      location: m.location || '-',
      lastOutDate: m.lastOutDate || '-',
      idleDays: idleDays
    };
  });
}

function reportIdle() {
  var data = buildIdleData();

  if (data.length === 0) {
    console.log(chalk.green('✔ 暂无闲置超过30天的模具'));
    addLog('report:idle', '查看闲置清单: 0条');
    return;
  }

  console.log(chalk.cyan.bold('═══ 闲置模具清单 (在库>30天未出库) ═══'));
  console.log('');

  var table = new Table({
    head: [chalk.cyan('编号'), chalk.cyan('名称'), chalk.cyan('客户'), chalk.cyan('库位'), chalk.cyan('上次出库'), chalk.cyan('闲置天数')],
    colWidths: [14, 14, 14, 12, 12, 10],
    style: { 'padding-left': 1, 'padding-right': 1 }
  });

  data.forEach(function (m) {
    table.push([m.code, m.name, m.customer, m.location, m.lastOutDate, String(m.idleDays)]);
  });

  console.log(table.toString());
  console.log(chalk.gray('共 ' + data.length + ' 套闲置模具'));
  addLog('report:idle', '查看闲置清单: ' + data.length + '条');
}

function buildSummaryData() {
  var molds = readJson(MOLDS_FILE) || [];
  var repairs = readJson(REPAIR_FILE) || [];
  var plans = readJson(MAINTENANCE_FILE) || [];
  var thisMonth = dayjs().format('YYYY-MM');
  var todayStr = today();

  var active = molds.filter(function (m) { return m.status !== 'scrapped'; });
  var scrapped = molds.filter(function (m) { return m.status === 'scrapped'; });
  var highUsage = active.filter(function (m) { return m.lifespan > 0 && m.usedCount / m.lifespan >= 0.9; });
  var overdueMaint = warnModule.getOverdueMaintenanceCount();

  var monthlyScrapped = scrapped.filter(function (m) { return m.scrapDate && m.scrapDate.startsWith(thisMonth); });
  var monthlyRepairCost = repairs.filter(function (r) { return r.date.startsWith(thisMonth); }).reduce(function (s, r) { return s + (r.cost || 0); }, 0);
  var monthlyOutCount = molds.filter(function (m) { return m.lastOutDate && m.lastOutDate.startsWith(thisMonth); }).length;
  var totalRepairCost = repairs.reduce(function (s, r) { return s + (r.cost || 0); }, 0);

  var byCustomer = {};
  active.forEach(function (m) {
    var key = m.customer || '未指定';
    if (!byCustomer[key]) byCustomer[key] = { total: 0, inStock: 0, outStock: 0, maint: 0, repair: 0 };
    byCustomer[key].total++;
    if (m.status === 'in_stock') byCustomer[key].inStock++;
    if (m.status === 'out_stock') byCustomer[key].outStock++;
    if (m.status === 'maintenance') byCustomer[key].maint++;
    if (m.status === 'repair') byCustomer[key].repair++;
  });

  var byStatus = {};
  var STATUS_MAP = { in_stock: '在库', out_stock: '出库', maintenance: '保养中', repair: '维修中', scrapped: '已报废' };
  molds.forEach(function (m) {
    var key = STATUS_MAP[m.status] || m.status;
    byStatus[key] = (byStatus[key] || 0) + 1;
  });

  return {
    total: molds.length,
    active: active.length,
    scrapped: scrapped.length,
    highUsage: highUsage.length,
    overdueMaint: overdueMaint,
    totalRepairCount: repairs.length,
    totalRepairCost: totalRepairCost,
    monthlyOutCount: monthlyOutCount,
    monthlyRepairCost: monthlyRepairCost,
    monthlyScrapped: monthlyScrapped.length,
    byCustomer: byCustomer,
    byStatus: byStatus
  };
}

function reportSummary() {
  var data = buildSummaryData();

  console.log(chalk.cyan.bold('═══ 模具管理概览 ═══'));
  console.log('');
  console.log(chalk.white('  总模具:     ') + data.total);
  console.log(chalk.white('  活跃:       ') + data.active);
  console.log(chalk.white('  已报废:     ') + data.scrapped);
  console.log(chalk.white('  高寿命预警: ') + chalk.red(data.highUsage));
  console.log(chalk.white('  逾期保养:   ') + chalk.red(data.overdueMaint));
  console.log(chalk.white('  累计维修费: ') + chalk.red('¥' + data.totalRepairCost.toFixed(2)));
  console.log('');

  console.log(chalk.cyan.bold('── 本月统计 ──'));
  console.log(chalk.white('  出库次数:   ') + data.monthlyOutCount);
  console.log(chalk.white('  维修费用:   ') + chalk.red('¥' + data.monthlyRepairCost.toFixed(2)));
  console.log(chalk.white('  报废数量:   ') + data.monthlyScrapped);
  console.log('');

  console.log(chalk.cyan.bold('── 按状态汇总 ──'));
  Object.entries(data.byStatus).forEach(function (entry) {
    var pct = (entry[1] / data.total * 100).toFixed(1);
    console.log(chalk.gray('  ' + entry[0] + ': ' + entry[1] + ' (' + pct + '%)'));
  });
  console.log('');

  console.log(chalk.cyan.bold('── 按客户汇总 ──'));
  var custTable = new Table({
    head: [chalk.cyan('客户'), chalk.cyan('总数'), chalk.cyan('在库'), chalk.cyan('出库'), chalk.cyan('保养'), chalk.cyan('维修')],
    colWidths: [14, 8, 8, 8, 8, 8],
    style: { 'padding-left': 1, 'padding-right': 1 }
  });
  Object.entries(data.byCustomer).forEach(function (entry) {
    custTable.push([entry[0], entry[1].total, entry[1].inStock, entry[1].outStock, entry[1].maint, entry[1].repair]);
  });
  console.log(custTable.toString());

  addLog('report:summary', '查看综合概览');
}

reportUtilization.buildData = buildUtilizationData;
reportRepairRate.buildData = buildRepairRateData;
reportIdle.buildData = buildIdleData;
reportSummary.buildData = buildSummaryData;

exports.reportUtilization = reportUtilization;
exports.reportRepairRate = reportRepairRate;
exports.reportIdle = reportIdle;
exports.reportSummary = reportSummary;
