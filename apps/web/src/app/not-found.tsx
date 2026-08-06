import { HomeAction, PageState } from "@/components/common";

export default function NotFoundPage() {
  return (
    <PageState
      description="The address may be incorrect or the page may have moved. Name pages accept second-level .eth names, and vault links require the complete vault ID."
      title="Page Not Found"
    >
      <HomeAction />
    </PageState>
  );
}
