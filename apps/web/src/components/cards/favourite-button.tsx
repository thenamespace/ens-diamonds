"use client";

import { useCallback } from "react";

import { Button } from "@thenamespace/uikit";
import { FavouriteIcon, HugeiconsIcon } from "@thenamespace/uikit/icons";
import { useSession } from "next-auth/react";

import { useFavourites } from "@/hooks";

export const FavouriteButton = ({ label }: { label: string }) => {
  const { status } = useSession();
  const favourites = useFavourites();
  const selected = favourites.isFavourite(label);
  const toggle = useCallback(() => favourites.toggle(label), [favourites, label]);

  return (
    <Button
      aria-label={selected ? `Remove ${label}.eth from favourites` : `Favourite ${label}.eth`}
      className="rounded-full bg-background/90 backdrop-blur-sm"
      isDisabled={status !== "authenticated" || favourites.isPending}
      isIconOnly
      size="sm"
      variant="secondary"
      onPress={toggle}
    >
      <HugeiconsIcon
        aria-hidden
        className={selected ? "fill-danger text-danger" : ""}
        icon={FavouriteIcon}
        width={17}
      />
    </Button>
  );
};
