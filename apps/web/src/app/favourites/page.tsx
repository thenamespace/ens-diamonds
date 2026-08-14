import { auth } from "@/auth";
import { FavouriteNames } from "@/components/favourites";
import { getFavouriteLabels } from "@/db/actions";

export default async function FavouritesPage() {
  const [session, favourites] = await Promise.all([auth(), getFavouriteLabels()]);

  return (
    <FavouriteNames
      initialFavourites={favourites}
      isAuthenticated={session?.address !== undefined}
    />
  );
}
