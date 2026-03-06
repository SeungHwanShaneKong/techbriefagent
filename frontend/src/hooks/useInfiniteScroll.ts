import { useEffect, useRef, useState } from "react";

const PAGE_SIZE = 20;

export function useInfiniteScroll(totalItems: number) {
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  function resetVisibleCount() {
    setVisibleCount(PAGE_SIZE);
  }

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [totalItems]); // Fixed: proper dependency

  return { sentinelRef, visibleCount, resetVisibleCount, PAGE_SIZE };
}
