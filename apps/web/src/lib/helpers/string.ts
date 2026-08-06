const GRAPHEME_SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" });

export const getGraphemeCount = (value: string) =>
  Array.from(GRAPHEME_SEGMENTER.segment(value)).length;
