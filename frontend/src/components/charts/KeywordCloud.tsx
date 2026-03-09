import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Sparkles } from "lucide-react";

interface KeywordCloudProps {
  keywords: Array<{ name: string; count: number }>;
  onKeywordClick: (kw: string) => void;
}

const KeywordCloud = React.memo(function KeywordCloud({ keywords, onKeywordClick }: KeywordCloudProps) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <Sparkles className="h-4 w-4 text-primary" /> 상위 키워드 (48시간)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {keywords.length === 0 ? (
          <p className="text-sm text-text-tertiary">키워드 데이터가 아직 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.slice(0, 10).map((item) => (
              <button
                key={item.name}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface dark:bg-gray-700 border border-border/60 dark:border-gray-600 px-3 py-1.5 text-sm text-text-primary dark:text-gray-200 transition-colors hover:bg-primary-light hover:text-primary hover:border-primary/30 cursor-pointer"
                onClick={() => onKeywordClick(item.name)}
              >
                {item.name}
                <span className="text-xs font-semibold text-text-tertiary">{item.count}</span>
              </button>
            ))}
            {keywords.length > 10 && (
              <span className="text-xs text-text-tertiary">+{keywords.length - 10}개 더</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default KeywordCloud;
