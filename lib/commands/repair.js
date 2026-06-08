const chalk = require('chalk');
const { requireInit, readJson, writeJson, addLog, today, MOLDS_FILE, REPAIR_FILE } = require('../utils');

exports.describe = '记录模具故障、停机和费用';

exports.handler = function (code, opts) {
  requireInit();

  opts = opts || {};
  const fault = opts.fault || '';
  const downtime = opts.downtime || 0;
  const cost = opts.cost || 0;
  const person = opts.person || '';
  const remark = opts.remark || '';

  if (!fault) {
    console.error(chalk.red('请指定故障描述: -f / --fault'));
    process.exit(1);
  }

  const molds = readJson(MOLDS_FILE) || [];
  const idx = molds.findIndex(function (m) { return m.code === code; });
  if (idx === -1) {
    console.error(chalk.red('未找到模具: ' + code));
    process.exit(1);
  }

  if (molds[idx].status === 'scrapped') {
    console.error(chalk.red('已报废模具无法报修'));
    process.exit(1);
  }

  const repairs = readJson(REPAIR_FILE) || [];
  const repairId = 'RP' + Date.now().toString(36).toUpperCase();

  repairs.push({
    id: repairId,
    moldCode: code,
    fault: fault,
    downtime: downtime,
    cost: cost,
    person: person,
    date: today(),
    remark: remark,
    createdAt: new Date().toISOString()
  });

  const prevStatus = molds[idx].status;
  molds[idx].status = 'repair';
  molds[idx].updatedAt = new Date().toISOString();

  writeJson(REPAIR_FILE, repairs);
  writeJson(MOLDS_FILE, molds);
  addLog('repair', '模具 ' + code + ' 报修: ' + fault + ', 停机' + downtime + 'h, 费用¥' + cost);

  console.log(chalk.green('✔ 维修记录已添加: ' + code));
  console.log(chalk.gray('  故障: ' + fault));
  console.log(chalk.gray('  停机: ' + downtime + 'h'));
  console.log(chalk.gray('  费用: ¥' + cost));
  console.log(chalk.gray('  状态: ' + prevStatus + ' → 维修中'));
};
