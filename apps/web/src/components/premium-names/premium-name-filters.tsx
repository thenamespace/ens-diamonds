"use client";

import { useCallback, useMemo } from "react";

import type { DateValue } from "@internationalized/date";
import { parseDate } from "@internationalized/date";
import {
  Button,
  DateField,
  DateRangePicker,
  Label,
  ListBox,
  Popover,
  RangeCalendar,
  SearchField,
  Segment,
  Select,
  Tooltip,
} from "@thenamespace/uikit";
import {
  FilterIcon,
  GridViewIcon,
  HugeiconsIcon,
  ListViewIcon,
  SortByDown01Icon,
  SortByUp01Icon,
} from "@thenamespace/uikit/icons";

import type { PremiumNameMatch } from "@/lib/ens";
import type { PremiumNameDateRange, PremiumNameOrder, PremiumNameView } from "@/lib/search-params";

const NAME_MATCH_OPTIONS: Array<{ id: PremiumNameMatch; label: string }> = [
  { id: "contains", label: "Contains" },
  { id: "startsWith", label: "Starts with" },
  { id: "exact", label: "Is exactly" },
];

type PremiumNameFiltersProps = {
  name: string;
  nameMatch: PremiumNameMatch;
  dateRange: PremiumNameDateRange;
  dateBounds: PremiumNameDateRange;
  order: PremiumNameOrder;
  view: PremiumNameView;
  onNameChange: (value: string) => void;
  onNameMatchChange: (value: PremiumNameMatch) => void;
  onDateRangeChange: (value: PremiumNameDateRange) => void;
  onOrderChange: (value: PremiumNameOrder) => void;
  onViewChange: (value: PremiumNameView) => void;
};

export const PremiumNameFilters = ({
  name,
  nameMatch,
  dateRange,
  dateBounds,
  order,
  view,
  onNameChange,
  onNameMatchChange,
  onDateRangeChange,
  onOrderChange,
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
  const reverseOrder = order === "asc" ? "desc" : "asc";
  const reverseOrderLabel =
    reverseOrder === "asc" ? "Show available sooner first" : "Show available later first";

  const handleNameMatch = useCallback(
    (key: React.Key | null) => {
      if (key) onNameMatchChange(key as PremiumNameMatch);
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
  const handleView = useCallback(
    (key: React.Key) => {
      if (key === "grid" || key === "list") onViewChange(key);
    },
    [onViewChange],
  );
  const handleReverseOrder = useCallback(
    () => onOrderChange(reverseOrder),
    [onOrderChange, reverseOrder],
  );

  return (
    <div className="my-6 flex items-end justify-between gap-3">
      <SearchField className="min-w-0 flex-1 sm:max-w-sm" value={name} onChange={onNameChange}>
        <Label className="sr-only">Name</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Filter by name…" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <Popover>
        <Button variant="secondary">
          <HugeiconsIcon icon={FilterIcon} width={18} />
          Filters
        </Button>
        <Popover.Content
          className="w-[calc(100vw-2rem)] max-w-96"
          offset={8}
          placement="bottom end"
        >
          <Popover.Dialog className="space-y-4">
            <Popover.Heading>Filters</Popover.Heading>

            <Segment
              aria-label="View"
              className="w-full"
              selectedKey={view}
              onSelectionChange={handleView}
            >
              <Segment.Item className="flex-1" id="grid">
                <HugeiconsIcon icon={GridViewIcon} width={18} />
                Grid view
              </Segment.Item>
              <Segment.Item className="flex-1" id="list">
                <HugeiconsIcon icon={ListViewIcon} width={18} />
                List view
              </Segment.Item>
            </Segment>

            <Select
              aria-label="Name match"
              className="w-full"
              value={nameMatch}
              variant="secondary"
              onChange={handleNameMatch}
            >
              <Label>Name match</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox items={NAME_MATCH_OPTIONS}>
                  {(item) => (
                    <ListBox.Item id={item.id} textValue={item.label}>
                      {item.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  )}
                </ListBox>
              </Select.Popover>
            </Select>

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

            <div className="flex justify-end">
              <Tooltip delay={0}>
                <Button
                  aria-label={reverseOrderLabel}
                  isIconOnly
                  variant="secondary"
                  onPress={handleReverseOrder}
                >
                  <HugeiconsIcon
                    icon={order === "asc" ? SortByUp01Icon : SortByDown01Icon}
                    width={18}
                  />
                </Button>
                <Tooltip.Content>{reverseOrderLabel}</Tooltip.Content>
              </Tooltip>
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  );
};

const toCalendarDate = (date: Date) => parseDate(date.toISOString().slice(0, 10));

const toUtcDate = (date: DateValue) => new Date(Date.UTC(date.year, date.month - 1, date.day));
