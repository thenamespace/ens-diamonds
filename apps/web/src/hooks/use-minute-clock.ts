"use client";

import { useState } from "react";

import { useInterval } from "usehooks-ts";

import { getUnixTime } from "@/lib/helpers";

export const useMinuteClock = (initialNow: number) => {
  const [now, setNow] = useState(initialNow);

  useInterval(() => setNow(getUnixTime()), 60_000);

  return now;
};
