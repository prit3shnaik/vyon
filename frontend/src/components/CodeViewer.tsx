export function SyntaxHighlighter({ code }: { code: string }) {
  const lines = code.split('\n')
  return (
    <pre className="bg-[#050505] border border-[#111] rounded p-3 text-[9px] font-mono overflow-x-auto leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className="flex gap-3">
          <span className="text-[#222] select-none w-4 text-right shrink-0">{i+1}</span>
          <span className="text-[#444]" dangerouslySetInnerHTML={{__html: highlight(line)}} />
        </div>
      ))}
    </pre>
  )
}

function highlight(line: string): string {
  return line
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\b(function|contract|mapping|address|uint|uint256|int|bool|string|bytes|public|private|external|internal|view|pure|payable|returns|return|if|else|for|while|require|emit|event|modifier|struct|enum|import|pragma|solidity|memory|storage|calldata|this|msg|block|tx)\b/g,'<span style="color:#5e5ce6">$1</span>')
    .replace(/"([^"]*)"/g,'"<span style="color:#34c759">$1</span>"')
    .replace(/(\/\/.*)/g,'<span style="color:#2a2a2a">$1</span>')
    .replace(/\b(\d+)\b/g,'<span style="color:#ff6b35">$1</span>')
}
