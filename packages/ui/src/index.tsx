export function StatCard(props: { label: string; value: string; helper?: string; icon?: any }) {
  const { label, value, helper, icon } = props;

  return (
    <article className="min-w-[190px] rounded-[18px] border border-white/10 bg-[#0e1624] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-2">
        <strong className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#c5d2d9]">{label}</strong>
        {icon}
      </div>
      <p className="my-2 text-3xl font-extrabold text-[#f2fbfa]">{value}</p>
      {helper ? <small className="text-xs text-[#c5d2d9]">{helper}</small> : null}
    </article>
  );
}
