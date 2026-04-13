import AnalyticsDashboard from "@/module/analytics/components/analytics-dashboard";
import { getAnalyticsData } from "@/module/analytics/actions";

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  return <AnalyticsDashboard data={data} />;
}
