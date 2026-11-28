/** Formas de las respuestas del panel (las produce la base; la interfaz solo las lee). */
export type Overview = {
  period: { from: string; to: string };
  organizations: { total: number; active: number; suspended: number; closed: number; demo: number };
  venues: { total: number; published: number; draft: number; archived: number; suspended: number; listed: number; without_organization: number };
  orders: { count: number; delivered: number; total_minor: number };
  by_day: { day: string; orders: number; total_minor: number }[];
  by_organization: { organization_id: string; name: string; status: string; venues: number; orders: number; total_minor: number }[];
};
export type OrgRow = { id: string; name: string; slug: string; legal_name: string; country: string; plan: string; status: string; is_demo: boolean; created_at: string; venues: number; members: number; orders_30d: number };
export type OrgDetail = {
  organization: {
    id: string; name: string; slug: string; legal_name: string; tax_id: string; country: string; currency: string; contact_name: string | null;
    contact_email: string | null; contact_phone: string | null; notes: string; plan: string; is_demo: boolean; status: string; status_reason: string | null; created_at: string;
  };
  venues: { id: string; name: string; slug: string; zone: string; publication_status: string; suspended: boolean; directory_visible: boolean }[];
  members: { user_id: string; email: string | null; role: string; status: string; venue_ids: string[] | null }[];
  invitations: { id: string; email: string; role: string; venue_ids: string[] | null; expires_at: string; state: string }[];
  recent_orders: { code: string; status: string; total_minor: number; venue: string; created_at: string }[];
  inventory: { products: number; categories: number };
};
export type VenueRow = { id: string; name: string; slug: string; zone: string; organization_id: string | null; organization: string | null; publication_status: string; suspended: boolean; directory_visible: boolean; open_state: string; paused: boolean };
export type VenueDetail = {
  venue: { id: string; name: string; slug: string; zone: string; hours: string; eta_minutes: number; open_state: string; paused: boolean; publication_status: string; suspended_at: string | null; suspended_reason: string | null; demo_listed: boolean; brand_color: string | null; capacity: number; auto_accept: boolean; service_modes: ServiceModes };
  organization: { id: string; name: string; slug: string; status: string } | null;
  activity_30d: { day: string; orders: number }[];
  staff: { user_id: string; email: string | null; role: string; status: string }[];
  menu_link: string;
  spots: number;
};
export type ServiceModes = { dine_in: boolean; pickup: boolean; delivery: { enabled: boolean; zones: string[]; fee_minor: number; min_order_minor: number } };
export type UserRow = { user_id?: string; email: string | null; organization?: string; organization_id?: string; role?: string; status?: string; username?: string; name?: string; since?: string };
export type AuditRow = { id: string; at: string; actor_email: string | null; organization_id: string | null; venue_id: string | null; action: string; entity: string; entity_id: string | null; details: Record<string, unknown>; request_id: string | null; ip: string | null };
export type MenuView = { categories: { id: string; label: string }[]; products: { id: string; category_id: string; name: string; price_minor: number; available: boolean; archived?: boolean }[]; spots?: unknown[]; map?: unknown };
export type PanelOrg = { organization_id: string; name: string; slug: string; status: string; role: string; venue_ids: string[] | null; venues: { id: string; name: string; slug: string; publication_status: string; suspended: boolean }[] };
export type PanelSummary = { days: number; venues: number; orders: number; delivered: number; total_minor: number; by_status: Record<string, number>; by_day: { day: string; orders: number }[] };
export type PanelCustomer = { pseudonym: string; orders: number; total_minor: number; last_order_at: string };
export type StaffList = {
  members: { user_id: string; email: string | null; role: string; status: string; venue_ids: string[] | null; me: boolean }[];
  invitations: { id: string; email: string; role: string; venue_ids: string[] | null; expires_at: string; state: string }[];
};

export const formatCrc = (minor: number) => `₡${Math.round(minor / 100).toLocaleString("es-CR")}`;
export const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" }) : "—");
export const ORG_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = {
  active: { label: "Activa", tone: "ok" },
  suspended: { label: "Suspendida", tone: "warn" },
  closed: { label: "Desactivada", tone: "bad" },
};
export const VENUE_STATUS: Record<string, string> = { draft: "Borrador", published: "Publicado", archived: "Archivado" };
