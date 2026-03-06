import { useState } from "react";
import { useDebounce } from "./useDebounce";

export function useArticleFilters() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [keyword, setKeyword] = useState<string>("");
  const debouncedKeyword = useDebounce(keyword, 300);

  function setSearchKeyword(kw: string) {
    setKeyword(kw);
  }

  return {
    selectedCategory,
    setSelectedCategory,
    keyword,
    setKeyword,
    debouncedKeyword,
    setSearchKeyword,
  };
}
