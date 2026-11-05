// Lightweight review hints. These labels are intentionally not treated as AI conclusions.
export function needSignals(text: string): string[] {
  const rules: Array<[RegExp, string]> = [
    [/(每天|每次|经常|反复|重复|手动|一个个|逐个).{0,18}(录入|填写|整理|统计|汇总|复制|粘贴|核对|操作|处理)/i, '重复劳动'],
    [/(有没有|要是有|希望有|想要|需要|求|能不能).{0,24}(软件|工具|应用|app|功能|自动|一键|插件|系统)/i, '明确求工具'],
    [/(太麻烦|费时间|效率低|不好用|难用|折腾|崩溃|受不了|痛苦)/i, '现有流程不便'],
    [/(自动生成|自动统计|自动汇总|自动录入|批量处理|一键完成|省时间)/i, '自动化诉求']
  ];
  return rules.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}
