import { getReviewDetail } from "@/module/review/actions";
import { ReviewDetailView } from "@/module/review/components/review-detail-view";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const data = await getReviewDetail(reviewId);
  return <ReviewDetailView data={data} />;
}
