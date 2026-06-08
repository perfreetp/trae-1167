const chalk = require('chalk');
const Table = require('cli-table3');
const dayjs = require('dayjs');
const { requireInit, readJson, addLog, today, MOLDS_FILE, MAINTENANCE_FILE, CONFIG_FILE } = require('../utils');

exports.describe = '查看超寿命和逾期保养提醒';

function getMaintenanceBaseline(mold) {
  if (mold.lastMaintenance) return mold.lastMaintenance;
  if (mold.purchaseDate) return mold.purchaseDate;
  return mold.createdAt ? mold.createdAt.slice(0, 10) : '';
}

function getOverdueMaintenanceCount() {
  var molds = readJson(MOLDS_FILE) || [];
  var plans = readJson(MAINTENANCE_FILE) || [];
  var config = readJson(CONFIG_FILE) || {};
  var cycle = config.maintCycle || 30;
  var todayStr = today();

  var overduePlanCodes = new Set(
    plans.filter(function (p) {
      return (p.status === 'pending' || p.status === 'overdue') && p.planDate < todayStr;
    }).map(function (p) { return p.moldCode; })
  );

  var noPlanOverdue = molds.filter(function (m) {
    if (m.status === 'scrapped') return false;
    if (overduePlanCodes.has(m.code)) return false;
    var baseline = getMaintenanceBaseline(m);
    if (!baseline) return false;
    return dayjs(baseline).add(cycle, 'day').isBefore(dayjs());
  });

  return overduePlanCodes.size + noPlanOverdue.length;
}

exports.handler = function (opts) {
  requireInit();
  opts = opts || {};

  var molds = readJson(MOLDS_FILE) || [];
  var plans = readJson(MAINTENANCE_FILE) || [];
  var config = readJson(CONFIG_FILE) || {};
  var cycle = config.maintCycle || 30;

  var showLifespan = opts.type === 'all' || opts.type === 'lifespan';
  var showMaintenance = opts.type === 'all' || opts.type === 'maintenance';

  var lifespanCount = 0;
  var maintenanceCount = 0;

  if (showLifespan) {
    var overLifespan = molds.filter(function (m) {
      if (m.status === 'scrapped') return false;
      var usage = m.lifespan > 0 ? Math.round(m.usedCount / m.lifespan * 100) : 0;
      return usage >= (opts.threshold || 80);
    });
    lifespanCount = overLifespan.length;

    if (overLifespan.length > 0) {
      console.log(chalk.red.bold('⚠ 寿命预警'));
      var table = new Table({
        head: [chalk.cyan('编号'), chalk.cyan('名称'), chalk.cyan('客户'), chalk.cyan('已用/寿命'), chalk.cyan('使用率'), chalk.cyan('状态')],
        colWidths: [14, 14, 14, 14, 10, 10],
        style: { 'padding-left': 1, 'padding-right': 1 }
      });

      overLifespan.forEach(function (m) {
        var usage = Math.round(m.usedCount / m.lifespan * 100);
        table.push([
          m.code,
          m.name || '-',
          m.customer || '-',
          m.usedCount + '/' + m.lifespan,
          usage >= 100 ? chalk.red(usage + '%') : chalk.yellow(usage + '%'),
          m.status
        ]);
      });

      console.log(table.toString());
      console.log(chalk.gray('共 ' + overLifespan.length + ' 条寿命预警'));
      console.log('');
    } else {
      console.log(chalk.green('✔ 暂无寿命预警'));
      console.log('');
    }
  }

  if (showMaintenance) {
    var todayStr = today();
    var overduePlans = plans.filter(function (p) {
      return (p.status === 'pending' || p.status === 'overdue') && p.planDate < todayStr;
    });

    var overduePlanCodes = new Set(overduePlans.map(function (p) { return p.moldCode; }));

    var noPlanOverdue = molds.filter(function (m) {
      if (m.status === 'scrapped') return false;
      if (overduePlanCodes.has(m.code)) return false;
      var baseline = getMaintenanceBaseline(m);
      if (!baseline) return false;
      return dayjs(baseline).add(cycle, 'day').isBefore(dayjs());
    });

    maintenanceCount = overduePlanCodes.size + noPlanOverdue.length;

    if (overduePlanCodes.size > 0 || noPlanOverdue.length > 0) {
      console.log(chalk.red.bold('⚠ 保养逾期提醒'));

      if (overduePlans.length > 0) {
        console.log(chalk.yellow('  逾期保养计划:'));
        var t1 = new Table({
          head: [chalk.cyan('ID'), chalk.cyan('模具编号'), chalk.cyan('计划日期'), chalk.cyan('逾期天数'), chalk.cyan('类型')],
          colWidths: [14, 14, 12, 10, 10],
          style: { 'padding-left': 1, 'padding-right': 1 }
        });

        overduePlans.forEach(function (p) {
          var overdueDays = dayjs().diff(dayjs(p.planDate), 'day');
          t1.push([p.id, p.moldCode, p.planDate, chalk.red(overdueDays + '天'), p.type || '-']);
        });
        console.log(t1.toString());
      }

      if (noPlanOverdue.length > 0) {
        console.log(chalk.yellow('  逾期未安排保养(按采购/建档日期推算):'));
        noPlanOverdue.forEach(function (m) {
          var baseline = getMaintenanceBaseline(m);
          var overdueDays = dayjs().diff(dayjs(baseline).add(cycle, 'day'), 'day');
          console.log(chalk.gray('    ' + m.code + ' ' + (m.name || '') + ' (基准日期: ' + baseline + ', 逾期' + overdueDays + '天)'));
        });
      }

      console.log(chalk.gray('共 ' + overduePlanCodes.size + ' 套逾期计划模具, ' + noPlanOverdue.length + ' 套逾期未安排保养模具 (合计' + maintenanceCount + '套)'));
    } else {
      console.log(chalk.green('✔ 暂无保养逾期提醒'));
    }
  }

  addLog('warn', '预警查看: 寿命' + lifespanCount + '条, 保养逾期' + maintenanceCount + '条');
};

exports.getOverdueMaintenanceCount = getOverdueMaintenanceCount;
