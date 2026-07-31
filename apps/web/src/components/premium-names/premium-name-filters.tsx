"use client";

import { useCallback, useMemo } from "react";

import type { DateValue } from "@internationalized/date";
import { parseDate } from "@internationalized/date";
import {
  Button,
  DateField,
  DateRangePicker,
  Label,
  Popover,
  RangeCalendar,
  SearchField,
  Segment,
} from "@thenamespace/uikit";
import { FilterIcon, GridViewIcon, HugeiconsIcon, ListViewIcon } from "@thenamespace/uikit/icons";

import type { PremiumNameMatch } from "@/lib/ens";
import type { PremiumNameDateRange, PremiumNameSort, PremiumNameView } from "@/lib/search-params";

const SORT_OPTIONS: Array<{ id: PremiumNameSort; label: string }> = [
  { id: "ending", label: "Ending soon" },
  { id: "newest", label: "Newest" },
  { id: "shortest", label: "Shortest" },
];

const NAME_MATCH_OPTIONS: Array<{ id: PremiumNameMatch; label: string }> = [
  { id: "contains", label: "Contains" },
  { id: "startsWith", label: "Starts with" },
  { id: "exact", label: "Exact" },
];

type PremiumNameFiltersProps = {
  name: string;
  nameMatch: PremiumNameMatch;
  dateRange: PremiumNameDateRange;
  dateBounds: PremiumNameDateRange;
  filterCount: number;
  sort: PremiumNameSort;
  view: PremiumNameView;
  onClearFilters: () => void;
  onNameChange: (value: string) => void;
  onNameMatchChange: (value: PremiumNameMatch) => void;
  onDateRangeChange: (value: PremiumNameDateRange) => void;
  onSortChange: (value: PremiumNameSort) => void;
  onViewChange: (value: PremiumNameView) => void;
};

export const PremiumNameFilters = ({
  name,
  nameMatch,
  dateRange,
  dateBounds,
  filterCount,
  sort,
  view,
  onClearFilters,
  onNameChange,
  onNameMatchChange,
  onDateRangeChange,
  onSortChange,
  onViewChange,
}: PremiumNameFiltersProps) => {
  const calendarRange = useMemo(
    () => ({
      start: toCalendarDate(dateRange.start),
      end: toCalendarDate(dateRange.end),
    }),
    [dateRange],
  );
  const minimumDate = useMemo(() => toCalendarDate(dateBounds.start), [dateBounds.start]);
  const maximumDate = useMemo(() => toCalendarDate(dateBounds.end), [dateBounds.end]);

  const handleNameMatch = useCallback(
    (key: React.Key) => {
      if (key === "contains" || key === "startsWith" || key === "exact") {
        onNameMatchChange(key);
      }
    },
    [onNameMatchChange],
  );
  const handleDateRange = useCallback(
    (value: { start: DateValue; end: DateValue } | null) => {
      if (!value) return;

      onDateRangeChange({
        start: toUtcDate(value.start),
        end: toUtcDate(value.end),
      });
    },
    [onDateRangeChange],
  );
  const handleSort = useCallback(
    (key: React.Key) => {
      if (key === "ending" || key === "newest" || key === "shortest") onSortChange(key);
    },
    [onSortChange],
  );
  const handleView = useCallback(
    (key: React.Key) => {
      if (key === "grid" || key === "list") onViewChange(key);
    },
    [onViewChange],
  );

  return (
    <div className="my-6 flex flex-wrap items-center gap-2">
      <Segment
        aria-label="Sort premium names"
        className="w-full shrink-0 sm:w-[19rem]"
        selectedKey={sort}
        size="sm"
        onSelectionChange={handleSort}
      >
        {SORT_OPTIONS.map((option) => (
          <Segment.Item id={option.id} key={option.id}>
            {option.label}
          </Segment.Item>
        ))}
      </Segment>

      <SearchField
        className="min-w-48 flex-1 sm:ml-auto sm:max-w-xs"
        value={name}
        onChange={onNameChange}
      >
        <Label className="sr-only">Search names</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Search names…" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <Segment
        aria-label="Display premium names"
        selectedKey={view}
        size="sm"
        onSelectionChange={handleView}
      >
        <Segment.Item aria-label="Grid view" id="grid">
          <HugeiconsIcon aria-hidden icon={GridViewIcon} width={17} />
        </Segment.Item>
        <Segment.Item aria-label="List view" id="list">
          <HugeiconsIcon aria-hidden icon={ListViewIcon} width={17} />
        </Segment.Item>
      </Segment>

      <Popover>
        <Button
          aria-label={filterCount > 0 ? `Filters, ${filterCount} active` : "Filters"}
          className="relative"
          isIconOnly
          variant="secondary"
        >
          <HugeiconsIcon aria-hidden icon={FilterIcon} width={18} />
          {filterCount > 0 ? (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-foreground font-mono text-[9px] font-semibold text-background">
              {filterCount}
            </span>
          ) : null}
        </Button>
        <Popover.Content
          className="w-[calc(100vw-2rem)] max-w-96"
          offset={8}
          placement="bottom end"
        >
          <Popover.Dialog className="space-y-5">
            <Popover.Heading>Filters</Popover.Heading>

            <div className="space-y-2">
              <Label>Name matching</Label>
              <Segment
                aria-label="Name matching"
                className="w-full"
                selectedKey={nameMatch}
                size="sm"
                onSelectionChange={handleNameMatch}
              >
                {NAME_MATCH_OPTIONS.map((option) => (
                  <Segment.Item className="flex-1" id={option.id} key={option.id}>
                    {option.label}
                  </Segment.Item>
                ))}
              </Segment>
            </div>

            <DateRangePicker
              aria-label="Available between"
              className="w-full"
              endName="availableTo"
              maxValue={maximumDate}
              minValue={minimumDate}
              startName="availableFrom"
              value={calendarRange}
              onChange={handleDateRange}
            >
              <Label>Available between</Label>
              <DateField.Group fullWidth variant="secondary">
                <DateField.Input slot="start">
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateRangePicker.RangeSeparator />
                <DateField.Input slot="end">
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  <DateRangePicker.Trigger>
                    <DateRangePicker.TriggerIndicator />
                  </DateRangePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DateRangePicker.Popover>
                <RangeCalendar
                  aria-label="Available between"
                  maxValue={maximumDate}
                  minValue={minimumDate}
                >
                  <RangeCalendar.Header>
                    <RangeCalendar.YearPickerTrigger>
                      <RangeCalendar.YearPickerTriggerHeading />
                      <RangeCalendar.YearPickerTriggerIndicator />
                    </RangeCalendar.YearPickerTrigger>
                    <RangeCalendar.NavButton slot="previous" />
                    <RangeCalendar.NavButton slot="next" />
                  </RangeCalendar.Header>
                  <RangeCalendar.Grid>
                    <RangeCalendar.GridHeader>
                      {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                    </RangeCalendar.GridHeader>
                    <RangeCalendar.GridBody>
                      {(date) => <RangeCalendar.Cell date={date} />}
                    </RangeCalendar.GridBody>
                  </RangeCalendar.Grid>
                  <RangeCalendar.YearPickerGrid>
                    <RangeCalendar.YearPickerGridBody>
                      {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
                    </RangeCalendar.YearPickerGridBody>
                  </RangeCalendar.YearPickerGrid>
                </RangeCalendar>
              </DateRangePicker.Popover>
            </DateRangePicker>

            <div className="flex justify-end border-t border-default pt-4">
              <Button isDisabled={filterCount === 0} variant="secondary" onPress={onClearFilters}>
                Clear filters
              </Button>
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  );
};

const toCalendarDate = (date: Date) => parseDate(date.toISOString().slice(0, 10));

const toUtcDate = (date: DateValue) => new Date(Date.UTC(date.year, date.month - 1, date.day));
