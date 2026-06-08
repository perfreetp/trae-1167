const chalk = require('chalk');
const Table = require('cli-table3');
const dayjs = require('dayjs');
const { requireInit, readJson, MOLDS_FILE, REPAIR_FILE, MAINTENANCE_FILE, CONFIG_FILE } = require('../utils');

exports.describe = '生成统计报表';

function reportUtilization() {
  const molds = readJson(MOLDS_FILE) || [];

  if (molds.length === 0) {
    console.log(chalk.yellow('暂无模具数据'));
    return;
  }

  const active = molds.filter(function (m) { return m.status !== 'scrapped'; });
  const inStock = active.filter(function (m) { return m.status === 'in_stock'; });
  const outStock = active.filter(function (m) { return m.status === 'out_stock'; });
  const inMaint = active.filter(function (m) { return m.status === 'maintenance' || m.status === 'repair'; });
  const scrapped = molds.filter(function (m) { return m.status === 'scrapped'; });

  const totalUsed = active.reduce(function (s, m) { return s + m.usedCount; }, 0);
  const totalLifespan = active.reduce(function (s, m) { return s + m.lifespan; }, 0);
  const avgUsage = totalLifespan > 0 ? Math.round(totalUsed / totalLifespan * 100) : 0;

  console.log(chalk.cyan.bold('═══ 模具利用率报表 ═══'));
  console.log('');
  console.log(chalk.white('  总模具数: ') + molds.length);
  console.log(chalk.white('  在库:     ') + chalk.green(inStock.length) + ' (' + (inStock.length / molds.length * 100).toFixed(1) + '%)');
  console.log(chalk.white('  出库使用: ') + chalk.yellow(outStock.length) + ' (' + (outStock.length / molds.length * 100).toFixed(1) + '%)');
  console.log(chalk.white('  保养/维修: ') + chalk.blue(inMaint.length) + ' (' + (inMaint.length / molds.length * 100).toFixed(1) + '%)');
  console.log(chalk.white('  已报废:   ') + chalk.red(scrapped.length) + ' (' + (scrapped.length / molds.length * 100).toFixed(1) + '%)');
  console.log('');
  console.log(chalk.white('  平均寿命使用率: ') + (avgUsage >= 80 ? chalk.red(avgUsage + '%') : avgUsage >= 60 ? chalk.yellow(avgUsage + '%') : chalk.green(avgUsage + '%')));
  console.log(chalk.white('  在库率: ') + (active.length > 0 ? (inStock.length / active.length * 100).toFixed(1) + '%' : '-'));
  console.log(chalk.white('  使用率: ') + (active.length > 0 ? (outStock.length / active.length * 100).toFixed(1) + '%' : '-'));

  const byCustomer = {};
  active.forEach(function (m) {
    const key = m.customer || '未指定';
    if (!byCustomer[key]) byCustomer[key] = { total: 0, out: 0 };
    byCustomer[key].total++;
    if (m.status === 'out_stock') byCustomer[key].out++;
  });

  if (Object.keys(byCustomer).length > 0) {
    console.log('');
    console.log(chalk.cyan('  按客户统计:'));
    Object.entries(byCustomer).forEach(function (entry) {
      const rate = (entry[1].out / entry[1].total * 100).toFixed(1);
      console.log(chalk.gray('    ' + entry[0] + ': ' + entry[1].total + '套, 使用率 ' + rate + '%'));
    });
  }
}

function reportRepairRate() {
  const molds = readJson(MOLDS_FILE) || [];
  const repairs = readJson(REPAIR_FILE) || [];
  const now = dayjs();
  const thisMonth = now.format('YYYY-MM');

  const monthlyRepairs = repairs.filter(function (r) { return r.date.startsWith(thisMonth); });
  const repairedCodes = new Set(monthlyRepairs.map(function (r) { return r.moldCode; }));
  const activeMolds = molds.filter(function (m) { return m.status !== 'scrapped'; });
  const repairRate = activeMolds.length > 0 ? (repairedCodes.size / activeMolds.length * 100).toFixed(1) : '0.0';

  const totalCost = monthlyRepairs.reduce(function (s, r) { return s + (r.cost || 0); }, 0);
  const totalDowntime = monthlyRepairs.reduce(function (s, r) { return s + (r.downtime || 0); }, 0);

  console.log(chalk.cyan.bold('═══ 维修率报表 (' + thisMonth + ') ═══'));
  console.log('');
  console.log(chalk.white('  月维修率: ') + chalk.yellow(repairRate + '%'));
  console.log(chalk.white('  维修次数: ') + monthlyRepairs.length);
  console.log(chalk.white('  涉及模具: ') + repairedCodes.size + ' 套');
  console.log(chalk.white('  总停机:   ') + totalDowntime + ' 小时');
  console.log(chalk.white('  总费用:   ') + chalk.red('¥' + totalCost.toFixed(2)));

  const moldRepairCount = {};
  monthlyRepairs.forEach(function (r) {
    moldRepairCount[r.moldCode] = (moldRepairCount[r.moldCode] || 0) + 1;
  });

  const frequent = Object.entries(moldRepairCount).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
  if (frequent.length > 0) {
    console.log('');
    console.log(chalk.cyan('  频繁维修TOP5:'));
    frequent.forEach(function (entry) {
      console.log(chalk.gray('    ' + entry[0] + ': ' + entry[1] + '次'));
    });
  }
}

function reportIdle() {
  const molds = readJson(MOLDS_FILE) || [];
  const dayjsModule = require('dayjs');
  const idle = molds.filter(function (m) {
    if (m.status !== 'in_stock') return false;
    if (!m.lastOutDate) return true;
    return dayjsModule().diff(dayjsModule(m.lastOutDate), 'day') > 30;
  });

  if (idle.length === 0) {
    console.log(chalk.green('✔ 暂无闲置超过30天的模具'));
    return;
  }

  console.log(chalk.cyan.bold('═══ 闲置模具清单 (在库>30天未出库) ═══'));
  console.log('');

  const table = new Table({
    head: [chalk.cyan('编号'), chalk.cyan('名称'), chalk.cyan('客户'), chalk.cyan('库位'), chalk.cyan('上次出库'), chalk.cyan('闲置天数')],
    colWidths: [14, 14, 14, 12, 12, 10],
    style: { 'padding-left': 1, 'padding-right': 1 }
  });

  idle.forEach(function (m) {
    const idleDays = m.lastOutDate ? dayjs().diff(dayjs(m.lastOutDate), 'day') : '从未出库';
    table.push([m.code, m.name || '-', m.customer || '-', m.location || '-', m.lastOutDate || '-', String(idleDays)]);
  });

  console.log(table.toString());
  console.log(chalk.gray(`共 ${idle.length} 套闲置模具`));
}

function reportSummary() {
  const molds = readJson(MOLDS_FILE) || [];
  const repairs = readJson(REPAIR_FILE) || [];
  const plans = readJson(MAINTENANCE_FILE) || [];

  const active = molds.filter(function (m) { return m.status !== 'scrapped'; });
  const scrapped = molds.filter(function (m) { return m.status === 'scrapped'; });
  const overdue = plans.filter(function (p) { return p.status === 'pending' && p.planDate < new Date().toISOString().slice(0, 10); });
  const highUsage = active.filter(function (m) { return m.lifespan > 0 && m.usedCount / m.lifespan >= 0.9; });

  console.log(chalk.cyan.bold('═══ 模具管理概览 ═══'));
  console.log('');
  console.log(chalk.white('  总模具:   ') + molds.length);
  console.log(chalk.white('  活跃:     ') + active.length);
  console.log(chalk.white('  已报废:   ') + scrapped.length);
  console.log(chalk.white('  高寿命预警: ') + chalk.red(highUsage.length));
  console.log(chalk.white('  逾期保养: ') + chalk.red(overdue.length));
  console.log(chalk.white('  维修记录: ') + repairs.length);

  const totalCost = repairs.reduce(function (s, r) { return s + (r.cost || 0); }, 0);
  console.log(chalk.white('  累计维修费: ') + chalk.red('¥' + totalCost.toFixed(2)));
}

exports.reportUtilization = reportUtilization;
exports.reportRepairRate = reportRepairRate;
exports.reportIdle = reportIdle;
exports.reportSummary = reportSummary;
