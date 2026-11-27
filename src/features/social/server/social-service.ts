import "server-only";
import { serverDb } from "@/lib/supabase/server";
import {
  activitySchema,
  socialActionSchema,
  socialOverviewSchema,
} from "../types";

/** Todo lo social pasa por funciones de la base que validan cuenta, alcance y vencimiento (202611270027). */
async function db() {
  const client = await serverDb();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error && ((error.status ?? 0) >= 500 || error.name === "AuthRetryableFetchError"))
    throw new Error("CONNECTION_ERROR");
  if (error || !user) throw new Error("SESSION_REQUIRED");
  return client;
}

export async function getSocialOverview() {
  const { data, error } = await (await db()).rpc("social_overview");
  if (error) throw new Error(error.message);
  return socialOverviewSchema.parse(data);
}

export async function getVenueActivity() {
  const { data, error } = await (await db()).rpc("venue_activity");
  if (error) throw new Error(error.message);
  return activitySchema.parse(data);
}

export async function runSocialAction(raw: unknown) {
  const command = socialActionSchema.parse(raw);
  const client = await db();
  const call = () => {
    switch (command.action) {
      case "checkin":
        return client.rpc("social_checkin", {
          input: { venueId: command.venueId, minutes: command.minutes, share: command.share },
        });
      case "checkout":
        return client.rpc("social_checkout");
      case "share":
        return client.rpc("social_share", { share: command.share });
      case "friend_request":
        return client.rpc("social_friend_request", { handle: command.username });
      case "friend_respond":
        return client.rpc("social_friend_respond", {
          request: command.requestId,
          accept: command.accept,
        });
      case "friend_remove":
        return client.rpc("social_friend_remove", { friend: command.friendId });
    }
  };
  const { error } = await call();
  if (error) throw new Error(error.message);
  return getSocialOverview();
}
