"use client";

export default function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-md px-3 py-1.5 text-sm transition " +
        (active
          ? "bg-accent text-[#17130a] font-medium"
          : "text-muted hover:bg-surface-raised hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
