import { auth } from "@/auth";
import { FavouriteNames } from "@/components/favourites";
import { getFavouriteLabels } from "@/db/actions";
import { getUnixTime } from "@/lib/helpers";

export default async function FavouritesPage() {
  const [session, favourites] = await Promise.all([auth(), getFavouriteLabels()]);

  return (
    <FavouriteNames
      asOf={getUnixTime()}
      initialFavourites={favourites}
      isAuthenticated={session?.address !== undefined}
    />
  );
}
