import { ErrorState, EmptyState } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { serverDb } from "@/lib/supabase/server";
import { getVenues } from "@/features/catalog/server/queries";
import { getAvatarMe, getStories } from "@/features/game/server/game-service";
import { StoryComposer } from "@/features/game/components/story-composer";
import { StoryCard, type StoryWithUrl } from "@/features/game/components/story-card";

export const dynamic = "force-dynamic";

async function load() {
  try {
    const db = await serverDb();
    const [me, venues, stories, products] = await Promise.all([
      getAvatarMe(),
      getVenues(),
      getStories("friends"),
      db.from("products").select("id,name,venue_id").eq("available", true).order("name").limit(500),
    ]);
    // URLs firmadas de corta vida: el bucket es privado y la política de Storage decide qué puede ver cada persona.
    const signed = stories.length
      ? await db.storage.from("stories").createSignedUrls(stories.map((s) => s.media_path), 3600)
      : { data: [] };
    const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
    const withUrls: StoryWithUrl[] = stories.map((s) => ({ ...s, url: urls.get(s.media_path) ?? null }));
    const byVenue = new Map<string, { id: string; name: string }[]>();
    for (const p of products.data ?? []) byVenue.set(p.venue_id, [...(byVenue.get(p.venue_id) ?? []), { id: p.id, name: p.name }]);
    const options = venues.map((v) => ({ id: v.id, name: v.name, products: byVenue.get(v.id) ?? [] }));
    return { ok: true as const, userId: me.user_id, options, stories: withUrls };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export default async function Page() {
  const data = await load();
  if (!data.ok)
    return (
      <div className="page">
        <div className="page-head"><h1>Drink Stories</h1></div>
        <ErrorState message={data.error} />
      </div>
    );
  return (
    <div className="page">
      <div className="page-head"><h1>Drink Stories</h1></div>
      <div className="stack">
        <StoryComposer userId={data.userId} venues={data.options} />
        <h2>Historias de tus amistades</h2>
        {data.stories.length === 0 ? (
          <EmptyState title="Todavía no hay historias">Compartí un trago o agregá amistades para ver las suyas.</EmptyState>
        ) : (
          <div className="stack">
            {data.stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
