// Lightweight review hints. These labels are intentionally not treated as AI conclusions.
export function needSignals(text: string): string[] {
  if (text.trim().length < 12) return [];
  const rules: Array<[RegExp, string]> = [
    [/(每天|每次|经常|反复|重复|手动|一个个|逐个).{0,25}(录入|输入|填写|整理|统计|汇总|复制|粘贴|核对|操作|处理|调整|导出|下载|做报表)/i, '重复劳动'],
    [/(有没有|要是有|希望有|想要|能不能|能否|有啥办法|怎么|如何).{0,40}(软件|工具|应用|app|功能|自动|一键|插件|系统|报表|数据|订单|表格|文件|汇总|核对|下载|录入|解决)/i, '明确求解'],
    [/(太麻烦|费时间|效率低|不好用|难用|折腾|崩溃|受不了|痛苦)/i, '现有流程不便'],
    [/(自动生成|自动统计|自动汇总|自动录入|自动填充|自动整理|批量处理|一键完成|省时间)/i, '自动化诉求'],
    [/(愿意付费|愿意花钱|收费也可以|付费也行|多少钱|预算多少)/i, '付费表态']
  ];
  return rules.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

export function isPriorityEvidence(text: string): boolean {
  const signals = needSignals(text);
  const concreteTask = /(录入|输入|填写|整理|统计|汇总|复制|粘贴|核对|计算|调整|导出|下载|生成|填充|合并|报表|订单|工作表|网页|文件名)/i.test(text);
  const workContext = /(工作|公司|数据|表格|报表|文件|订单|网页|客户|员工|财务|视频|图片|素材|内容|信息|明细)/i.test(text);
  return workContext && concreteTask && (signals.includes('明确求解') || signals.includes('重复劳动') || signals.includes('付费表态'));
}

export function isActionableEvidence(text: string, verdict?: 'need' | 'not-need' | 'unclear'): boolean {
  if (verdict === 'need') return true;
  if (verdict === 'not-need') return false;
  return isPriorityEvidence(text);
}
