import { ErrorState } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { getAvatarMe } from "@/features/game/server/game-service";
import { AvatarEditor } from "@/features/game/components/avatar-editor";

export const dynamic = "force-dynamic";

export default async function Page() {
  let me;
  try {
    me = await getAvatarMe();
  } catch (error) {
    return (
      <div className="page">
        <div className="page-head"><h1>Mi avatar</h1></div>
        <ErrorState message={errorMessage(error)} />
      </div>
    );
  }
  return (
    <div className="page">
      <div className="page-head"><h1>Mi avatar</h1></div>
      <AvatarEditor me={me} />
    </div>
  );
}
