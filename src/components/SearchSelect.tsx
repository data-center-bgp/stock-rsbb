"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import { inputClass } from "@/components/ui";

export type SearchOption = { value: string; label: string };

// A select you can type into: the list narrows to names containing what's
// typed (anywhere, so "kimia" finds "PT. Kimia Farma"). Built for long lists
// like the 97 distributors, where a native <select> means endless scrolling.
export function SearchSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  emptyText = "Tidak ada yang cocok.",
}: {
  id?: string;
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  emptyText?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function openList() {
    if (open) return;
    setOpen(true);
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    // Keep the list above the phone keyboard.
    requestAnimationFrame(() => inputRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  function choose(option: SearchOption) {
    onChange(option.value);
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => Math.min(Math.max(i + step, 0), matches.length - 1));
    } else if (e.key === "Enter" && open) {
      e.preventDefault(); // don't submit the form
      if (matches[active]) choose(matches[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      {open ? (
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      ) : null}
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={open ? query : (selected?.label ?? "")}
        placeholder={open ? "Ketik untuk mencari..." : placeholder}
        onFocus={openList}
        onClick={openList}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className={`${inputClass} cursor-pointer truncate pr-9 ${open ? "pl-10" : "pl-3.5"}`}
      />
      <ChevronDownIcon
        className={`pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted transition-transform ${open ? "rotate-180" : ""}`}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl"
        >
          {matches.length ? (
            matches.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                // mousedown, not click: runs before the input's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer rounded-lg px-3 py-2.5 text-sm ${i === active ? "bg-surface-muted" : ""} ${
                  o.value === value ? "font-semibold text-primary" : ""
                }`}
              >
                {o.label}
              </li>
            ))
          ) : (
            <li className="px-3 py-2.5 text-sm text-muted">{emptyText}</li>
          )}
        </ul>
      )}
    </div>
  );
}
