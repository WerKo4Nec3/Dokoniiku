const labels = ["方角", "都道府県", "目的地"];

export function ProgressRail({ current }: { current: number }) {
  return (
    <ol className="flex items-center" aria-label="旅の決定ステップ">
      {labels.map((label, index) => (
        <li key={label} className="flex flex-1 items-center last:flex-none">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
              index <= current
                ? "bg-forest text-white"
                : "border border-[color:var(--line)] bg-[color:var(--surface)] muted"
            }`}
            aria-current={index === current ? "step" : undefined}
          >
            {index + 1}
          </span>
          <span className="ml-2 hidden text-xs font-bold sm:inline">{label}</span>
          {index < labels.length - 1 && (
            <span
              className={`mx-3 h-px flex-1 ${
                index < current ? "bg-forest" : "bg-[color:var(--line)]"
              }`}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
