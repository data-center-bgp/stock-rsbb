import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { UserAccessRow, type ManagedUser } from "@/components/users/UserAccessRow";
import { Alert, PageHeader, cardClass } from "@/components/ui";

export const metadata: Metadata = { title: "Pengguna — Stock RSBB" };

export default async function UsersPage() {
  const { supabase, user, profile } = await getSession();
  // Masters only. The database enforces this too: only a master's reads
  // return other users, and set_user_access() rejects anyone else.
  if (profile?.role !== "master") notFound();

  const [{ data, error }, { data: units }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, id_gudang").order("created_at"),
    supabase.from("unit").select("id_gudang, nama_gudang").order("nama_gudang"),
  ]);

  // Waiting-for-approval first, then everyone else in sign-up order.
  const users = ((data ?? []) as ManagedUser[]).sort((a, b) => Number(Boolean(a.role)) - Number(Boolean(b.role)));
  const pending = users.filter((u) => !u.role).length;

  return (
    <>
      <PageHeader
        title="Pengguna"
        description={
          pending > 0
            ? `${pending} akun menunggu persetujuan. Atur peran dan inventori setiap pengguna di bawah.`
            : "Atur peran dan inventori setiap pengguna."
        }
      />

      <div className="mb-4">
        <Alert tone="warning">
          Akun baru dibuat di Supabase (Authentication → Users). Setelah orangnya masuk ke Stock RSBB sekali, akunnya
          muncul di sini untuk disetujui.
        </Alert>
      </div>

      {error && <Alert tone="danger">Gagal memuat pengguna: {error.message}</Alert>}

      <section className={cardClass}>
        <div className="hidden gap-3 border-b border-border bg-surface-muted px-5 py-3 text-xs font-medium text-muted md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_150px_minmax(0,190px)_auto]">
          <span>Pengguna</span>
          <span>Nama</span>
          <span>Peran</span>
          <span>Inventori</span>
          <span className="md:w-24" />
        </div>
        <ul>
          {users.map((u) => (
            <UserAccessRow key={u.id} user={u} units={units ?? []} isSelf={u.id === user?.id} />
          ))}
        </ul>
      </section>

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
        <div className={`${cardClass} p-4`}>
          <dt className="font-semibold">Staf</dt>
          <dd className="mt-1 text-muted">Melihat dan mencatat stok hanya untuk inventorinya sendiri.</dd>
        </div>
        <div className={`${cardClass} p-4`}>
          <dt className="font-semibold">Manajer</dt>
          <dd className="mt-1 text-muted">Melihat semua inventori, tanpa bisa mencatat data.</dd>
        </div>
        <div className={`${cardClass} p-4`}>
          <dt className="font-semibold">Master</dt>
          <dd className="mt-1 text-muted">Akses penuh ke semua inventori dan pengaturan pengguna.</dd>
        </div>
      </dl>
    </>
  );
}
