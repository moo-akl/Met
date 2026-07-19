import { useEffect, useState } from "react";
import { api, type BusinessProfile, type BusinessReview } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

type MyBusinessesResponse = { businesses: BusinessProfile[] };
type ReviewsResponse = {
  averageRating: number | null;
  totalReviews: number;
  page: number;
  reviews: BusinessReview[];
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage({ isAdmin }: { isAdmin?: boolean }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [selected, setSelected] = useState<BusinessProfile | null>(null);
  const [reviewsData, setReviewsData] = useState<ReviewsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api
      .get<MyBusinessesResponse>("/api/business/mine")
      .then((res) => {
        const biz = res.businesses ?? [];
        setBusinesses(biz);
        if (biz.length > 0) setSelected(biz[0]!);
      })
      .catch(() => setError("Failed to load businesses"))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!selected) return;
    setReviewsLoading(true);
    setError("");
    api
      .get<ReviewsResponse>(`/api/business/${selected.businessId}/reviews?page=${page}`)
      .then(setReviewsData)
      .catch(() => setError("Failed to load reviews"))
      .finally(() => setReviewsLoading(false));
  }, [selected, page]);

  const totalPages = reviewsData ? Math.ceil(reviewsData.totalReviews / 20) : 1;

  return (
    <Layout isAdmin={isAdmin}>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Feedback from Met users who visited your venue.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && businesses.length === 0 && (
          <Card className="bg-card border-card-border border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Star className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <h3 className="font-medium text-foreground mb-1">No businesses registered</h3>
              <Link href="/register">
                <Button size="sm" className="mt-2">Register Business</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {businesses.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {businesses.map((biz) => (
              <button
                key={biz.businessId}
                onClick={() => { setSelected(biz); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selected?.businessId === biz.businessId
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {biz.name}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {selected && reviewsData && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card className="bg-card border-card-border">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-foreground">
                    {reviewsData.averageRating?.toFixed(1) ?? "—"}
                  </p>
                  <div className="flex justify-center mt-1">
                    {reviewsData.averageRating ? (
                      <StarRating rating={Math.round(reviewsData.averageRating)} />
                    ) : (
                      <span className="text-xs text-muted-foreground">No rating</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Average Rating</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-card-border">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-foreground">{reviewsData.totalReviews}</p>
                  <p className="text-xs text-muted-foreground mt-2">Total Reviews</p>
                </CardContent>
              </Card>
            </div>

            {/* Reviews list */}
            {reviewsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : reviewsData.reviews.length === 0 ? (
              <Card className="bg-card border-card-border border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Star className="w-8 h-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No reviews yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {reviewsData.reviews.map((review) => (
                  <Card key={review.reviewId} className="bg-card border-card-border">
                    <CardContent className="p-4 flex gap-3">
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {review.reviewerId.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <StarRating rating={review.rating} />
                            <span className="text-xs font-semibold text-foreground">
                              {review.rating}/5
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(review.createdAt), "MMM d, yyyy")}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-foreground/80">{review.comment}</p>
                        )}
                        <p className="text-xs text-muted-foreground/50 font-mono mt-1 truncate">
                          {review.reviewerId}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
