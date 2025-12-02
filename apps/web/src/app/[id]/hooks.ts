import { useEffect, useRef } from "react";

export const useOnce = (fn: () => void) => {
  const doneRef = useRef(false);
  useEffect(() => {
    if (!doneRef.current) {
      fn();
      doneRef.current = true;
    }
  }, []);
};
