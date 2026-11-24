export default function ResearchLinks({ text }: { text?: string }) {
  const links = [...new Set(text?.match(/https?:\/\/[^\s<>"，。；、）】]+/gi) ?? [])];
  if (!links.length) return null;

  return <ul aria-label="补充来源" className="mt-2 space-y-1 text-xs">
    {links.map(link => <li key={link}>
      <a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-amber-700 underline">{link}</a>
    </li>)}
  </ul>;
}
