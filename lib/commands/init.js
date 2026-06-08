const chalk = require('chalk');
const inquirer = require('inquirer');
const { ensureDataDir, isInitialized, writeJson, addLog, CONFIG_FILE, MOLDS_FILE, LOGS_FILE, MAINTENANCE_FILE, REPAIR_FILE, TRANSACTIONS_FILE } = require('../utils');

exports.describe = '初始化模具管理项目档案';

exports.handler = async function (argv) {
  if (isInitialized()) {
    console.error(chalk.red('项目已初始化，如需重新初始化请先删除 .mold-data 目录'));
    process.exit(1);
  }

  let answers;

  if (argv.company || argv.nonInteractive) {
    answers = {
      company: argv.company || '示例工厂',
      department: argv.department || '模具部',
      manager: argv.manager || '',
      defaultLifespan: argv.defaultLifespan || 100000,
      maintCycle: argv.maintCycle || 30
    };
  } else {
    answers = await inquirer.prompt([
      { type: 'input', name: 'company', message: '公司名称:', default: '示例工厂' },
      { type: 'input', name: 'department', message: '管理部门:', default: '模具部' },
      { type: 'input', name: 'manager', message: '管理员姓名:', default: '' },
      { type: 'number', name: 'defaultLifespan', message: '模具默认寿命(模次):', default: 100000 },
      { type: 'number', name: 'maintCycle', message: '默认保养周期(天):', default: 30 }
    ]);
  }

  ensureDataDir();

  writeJson(CONFIG_FILE, {
    company: answers.company,
    department: answers.department,
    manager: answers.manager,
    defaultLifespan: answers.defaultLifespan,
    maintCycle: answers.maintCycle,
    createdAt: new Date().toISOString(),
    version: '1.0.0'
  });

  writeJson(MOLDS_FILE, []);
  writeJson(LOGS_FILE, []);
  writeJson(MAINTENANCE_FILE, []);
  writeJson(REPAIR_FILE, []);
  writeJson(TRANSACTIONS_FILE, []);

  addLog('init', '初始化项目: ' + answers.company + ' - ' + answers.department);

  console.log(chalk.green('✔ 项目初始化完成！'));
  console.log(chalk.gray('  公司: ' + answers.company));
  console.log(chalk.gray('  部门: ' + answers.department));
  console.log(chalk.gray('  管理员: ' + answers.manager));
  console.log(chalk.gray('  数据目录: .mold-data/'));
};
