const chalk = require('chalk');
const Table = require('cli-table3');
const dayjs = require('dayjs');
const { requireInit, readJson, today, MOLDS_FILE, MAINTENANCE_FILE, CONFIG_FILE } = require('../utils');

exports.describe = '查看超寿命和逾期保养提醒';

exports.handler = function (opts) {
  requireInit();
  opts = opts || {};

  const molds = readJson(MOLDS_FILE) || [];
  const plans = readJson(MAINTENANCE_FILE) || [];
  const config = readJson(CONFIG_FILE) || {};

  const showLifespan = opts.type === 'all' || opts.type === 'lifespan';
  const showMaintenance = opts.type === 'all' || opts.type === 'maintenance';

  if (showLifespan) {
    const overLifespan = molds.filter(function (m) {
      if (m.status === 'scrapped') return false;
      const usage = m.lifespan > 0 ? Math.round(m.usedCount / m.lifespan * 100) : 0;
      return usage >= opts.threshold;
    });

    if (overLifespan.length > 0) {
      console.log(chalk.red.bold('⚠ 寿命预警'));
      const table = new Table({
        head: [chalk.cyan('编号'), chalk.cyan('名称'), chalk.cyan('客户'), chalk.cyan('已用/寿命'), chalk.cyan('使用率'), chalk.cyan('状态')],
        colWidths: [14, 14, 14, 14, 10, 10],
        style: { 'padding-left': 1, 'padding-right': 1 }
      });

      overLifespan.forEach(function (m) {
        const usage = Math.round(m.usedCount / m.lifespan * 100);
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
      console.log(chalk.gray(`共 ${overLifespan.length} 条寿命预警`));
      console.log('');
    } else {
      console.log(chalk.green('✔ 暂无寿命预警'));
      console.log('');
    }
  }

  if (showMaintenance) {
    const overdue = plans.filter(function (p) {
      return (p.status === 'pending' || p.status === 'overdue') && p.planDate < today();
    });

    const cycle = config.maintCycle || 30;
    const noMaintenanceMolds = molds.filter(function (m) {
      if (m.status === 'scrapped') return false;
      if (!m.lastMaintenance) return true;
      return dayjs(m.lastMaintenance).add(cycle, 'day').isBefore(dayjs());
    });

    if (overdue.length > 0 || noMaintenanceMolds.length > 0) {
      console.log(chalk.red.bold('⚠ 保养逾期提醒'));

      if (overdue.length > 0) {
        console.log(chalk.yellow('  逾期保养计划:'));
        const table = new Table({
          head: [chalk.cyan('ID'), chalk.cyan('模具编号'), chalk.cyan('计划日期'), chalk.cyan('逾期天数'), chalk.cyan('类型')],
          colWidths: [14, 14, 12, 10, 10],
          style: { 'padding-left': 1, 'padding-right': 1 }
        });

        overdue.forEach(function (p) {
          const overdueDays = dayjs().diff(dayjs(p.planDate), 'day');
          table.push([p.id, p.moldCode, p.planDate, chalk.red(overdueDays + '天'), p.type || '-']);
        });
        console.log(table.toString());
      }

      if (noMaintenanceMolds.length > 0) {
        console.log(chalk.yellow('  长期未保养模具:'));
        noMaintenanceMolds.forEach(function (m) {
          const daysSince = m.lastMaintenance ? dayjs().diff(dayjs(m.lastMaintenance), 'day') : '从未';
          console.log(chalk.gray(`    ${m.code} ${m.name || ''} (上次保养: ${m.lastMaintenance || '无'}, ${daysSince}天)`));
        });
      }

      console.log(chalk.gray(`共 ${overdue.length} 条逾期计划, ${noMaintenanceMolds.length} 个长期未保养模具`));
    } else {
      console.log(chalk.green('✔ 暂无保养逾期提醒'));
    }
  }
};
