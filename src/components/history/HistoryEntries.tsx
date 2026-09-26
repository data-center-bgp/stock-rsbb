import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/dates";
import { mutasiType } from "@/lib/mutasi";
import type { HistoryEntry, HistoryTab, MutasiEntry, OpnameEntry } from "@/lib/history";
import { DetailList, ExpandableRow, SignedQty, numberFormat } from "@/components/history/parts";

type Recorders = Record<string, string>;
// showItem is off on an item's own history, where every row is that item.
type Props<T> = { entries: T[]; recorders: Recorders; showItem: boolean };

function counterpart(e: MutasiEntry) {
  const spec = mutasiType(e.mutasi_type);
  if (spec.needs === "distributor") return { label: "Distributor", value: e.distributor_nama ?? "—" };
  if (spec.needs === "unit") return { label: spec.unitLabel ?? "Unit", value: e.hospital_unit_nama ?? "—" };
  return null;
}

function KindChip({ entry }: { entry: HistoryEntry }) {
  const [label, tone] =
    entry.kind === "opname"
      ? ["Stock Opname", "bg-amber-500/15 text-amber-700 dark:text-amber-400"]
      : [
          mutasiType(entry.mutasi_type).label,
          mutasiType(entry.mutasi_type).direction === "in"
            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
            : "bg-rose-500/12 text-rose-700 dark:text-rose-400",
        ];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}

const recordedBy = (e: HistoryEntry, recorders: Recorders) => recorders[e.created_by] ?? "—";

function mutasiDetails(e: MutasiEntry, recorders: Recorders) {
  const spec = mutasiType(e.mutasi_type);
  return [
    { label: "Jenis", value: <KindChip entry={e} /> },
    { label: spec.dateLabel, value: formatDate(e.event_date) },
    { label: "Jumlah", value: <SignedQty value={e.delta} unit={e.satuan_jual} /> },
    counterpart(e),
    spec.needs === "distributor" ? { label: "Nomor Batch", value: e.batch_number ?? "—" } : null,
    spec.needs === "distributor" && e.expiry_date ? { label: "Expire Date", value: formatDate(e.expiry_date) } : null,
    { label: "Inventori", value: e.nama_gudang ?? "—" },
    { label: "Lokasi", value: e.nama_lokasi ?? "—" },
    { label: "Dicatat oleh", value: recordedBy(e, recorders) },
    { label: "Dicatat pada", value: `${formatDateTime(e.created_at)}${e.synced_offline ? " (offline)" : ""}` },
  ];
}

function opnameDetails(e: OpnameEntry, recorders: Recorders) {
  return [
    { label: "Jenis", value: <KindChip entry={e} /> },
    { label: "Tanggal Opname", value: formatDate(e.event_date) },
    { label: "Stok sistem", value: `${numberFormat.format(e.system_qty)} ${e.satuan_jual}` },
    { label: "Hitung fisik", value: `${numberFormat.format(e.counted_qty)} ${e.satuan_jual}` },
    { label: "Selisih", value: <SignedQty value={e.selisih} unit={e.satuan_jual} zeroLabel="Sesuai" /> },
    { label: "Inventori", value: e.nama_gudang ?? "—" },
    { label: "Lokasi", value: e.nama_lokasi ?? "—" },
    { label: "Dicatat oleh", value: recordedBy(e, recorders) },
    { label: "Dicatat pada", value: formatDateTime(e.created_at) },
  ];
}

/** Phones: one line per entry, tap to see everything. */
export function EntryList({ entries, recorders, showItem }: Props<HistoryEntry>) {
  return (
    <ul>
      {entries.map((e) => {
        const date = formatDate(e.event_date);
        const label = e.kind === "opname" ? "Stock Opname" : mutasiType(e.mutasi_type).label;
        const summary =
          e.kind === "opname"
            ? `Fisik ${numberFormat.format(e.counted_qty)} · Sistem ${numberFormat.format(e.system_qty)} · ${date}`
            : [counterpart(e)?.value, date].filter(Boolean).join(" · ");
        return (
          <ExpandableRow
            key={e.id}
            title={showItem ? e.item_nama : label}
            subtitle={showItem ? `${label} · ${summary}` : summary}
            aside={
              e.kind === "opname" ? (
                <SignedQty value={e.selisih} zeroLabel="Sesuai" />
              ) : (
                <SignedQty value={e.delta} unit={e.satuan_jual} />
              )
            }
          >
            <DetailList items={e.kind === "opname" ? opnameDetails(e, recorders) : mutasiDetails(e, recorders)} />
            {showItem && (
              <Link
                href={`/riwayat?inv=${e.id_inventory}`}
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                Riwayat item ini
              </Link>
            )}
          </ExpandableRow>
        );
      })}
    </ul>
  );
}

const th = "px-5 py-3 font-medium";
const td = "px-5 py-3";

function ItemCell({ e }: { e: HistoryEntry }) {
  return (
    <td className={td}>
      <Link href={`/riwayat?inv=${e.id_inventory}`} className="font-medium hover:text-primary hover:underline" title="Riwayat item ini">
        {e.item_nama}
      </Link>
      <p className="text-xs text-muted">{e.satuan_jual}</p>
    </td>
  );
}

function LocationCell({ e }: { e: HistoryEntry }) {
  return (
    <td className={td}>
      <p>{e.nama_lokasi}</p>
      <p className="text-xs text-muted">{e.nama_gudang}</p>
    </td>
  );
}

function RecordedCell({ e, recorders }: { e: HistoryEntry; recorders: Recorders }) {
  return (
    <td className={td}>
      <p>{recordedBy(e, recorders)}</p>
      <p className="whitespace-nowrap text-xs text-muted">
        {formatDateTime(e.created_at)}
        {e.kind === "mutasi" && e.synced_offline ? " · offline" : ""}
      </p>
    </td>
  );
}

/** Desktop, Semua and Mutasi tabs: both kinds in one set of columns. */
export function EntryTable({ entries, recorders, showItem, tab }: Props<HistoryEntry> & { tab: HistoryTab }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr className="border-y border-border bg-surface-muted text-left text-xs font-medium text-muted">
            <th className={th}>Tanggal</th>
            <th className={th}>Jenis</th>
            {showItem && <th className={th}>Item</th>}
            <th className={th}>Lokasi</th>
            <th className={`${th} text-right`}>{tab === "semua" ? "Jumlah / Selisih" : "Jumlah"}</th>
            <th className={th}>Keterangan</th>
            <th className={th}>Dicatat</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const other = e.kind === "mutasi" ? counterpart(e) : null;
            return (
              <tr key={e.id} className="border-b border-border align-top last:border-b-0 hover:bg-surface-muted/60">
                <td className={`${td} whitespace-nowrap`}>{formatDate(e.event_date)}</td>
                <td className={td}>
                  <KindChip entry={e} />
                </td>
                {showItem && <ItemCell e={e} />}
                <LocationCell e={e} />
                <td className={`${td} whitespace-nowrap text-right`}>
                  {e.kind === "opname" ? (
                    <SignedQty value={e.selisih} unit={e.satuan_jual} zeroLabel="Sesuai" />
                  ) : (
                    <SignedQty value={e.delta} unit={e.satuan_jual} />
                  )}
                </td>
                <td className={td}>
                  {e.kind === "opname" ? (
                    <p>
                      Fisik {numberFormat.format(e.counted_qty)} · Sistem {numberFormat.format(e.system_qty)}
                    </p>
                  ) : other ? (
                    <p>
                      <span className="text-muted">{other.label}:</span> {other.value}
                    </p>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                  {e.kind === "mutasi" && mutasiType(e.mutasi_type).needs === "distributor" && (
                    <p className="text-xs text-muted">
                      Batch {e.batch_number ?? "—"}
                      {e.expiry_date ? ` · Exp ${formatDate(e.expiry_date)}` : ""}
                    </p>
                  )}
                </td>
                <RecordedCell e={e} recorders={recorders} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Desktop, Stock Opname tab: counts get their own columns. */
export function OpnameTable({ entries, recorders, showItem }: Props<OpnameEntry>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-y border-border bg-surface-muted text-left text-xs font-medium text-muted">
            <th className={th}>Tanggal Opname</th>
            {showItem && <th className={th}>Item</th>}
            <th className={th}>Lokasi</th>
            <th className={`${th} text-right`}>Stok Sistem</th>
            <th className={`${th} text-right`}>Hitung Fisik</th>
            <th className={`${th} text-right`}>Selisih</th>
            <th className={th}>Dicatat</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-border align-top last:border-b-0 hover:bg-surface-muted/60">
              <td className={`${td} whitespace-nowrap`}>{formatDate(e.event_date)}</td>
              {showItem && <ItemCell e={e} />}
              <LocationCell e={e} />
              <td className={`${td} text-right tabular-nums`}>{numberFormat.format(e.system_qty)}</td>
              <td className={`${td} text-right tabular-nums`}>{numberFormat.format(e.counted_qty)}</td>
              <td className={`${td} text-right`}>
                <SignedQty value={e.selisih} zeroLabel="Sesuai" />
              </td>
              <RecordedCell e={e} recorders={recorders} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
