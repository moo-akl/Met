import { useEffect, useState } from "react";
import { loadSessionCount } from "@/lib/storage";

export function useSessionCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    loadSessionCount().then(setCount).catch(() => {});
  }, []);
  return count;
}
