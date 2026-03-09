import type { AgentInfo } from "../../types";

const divisionColors: Record<string, string> = {
  PM: "bg-purple-50 border-purple-200 text-purple-700",
  Planning: "bg-blue-50 border-blue-200 text-blue-700",
  "AI Engineering": "bg-emerald-50 border-emerald-200 text-emerald-700",
  Development: "bg-amber-50 border-amber-200 text-amber-700",
  Marketing: "bg-rose-50 border-rose-200 text-rose-700",
};

const divisionBadge: Record<string, string> = {
  PM: "bg-purple-100 text-purple-800",
  Planning: "bg-blue-100 text-blue-800",
  "AI Engineering": "bg-emerald-100 text-emerald-800",
  Development: "bg-amber-100 text-amber-800",
  Marketing: "bg-rose-100 text-rose-800",
};

interface AgentCardProps {
  agent: AgentInfo;
  compact?: boolean;
}

export default function AgentCard({ agent, compact }: AgentCardProps) {
  const color = divisionColors[agent.division] ?? "bg-gray-50 border-gray-200 text-gray-700";
  const badge = divisionBadge[agent.division] ?? "bg-gray-100 text-gray-800";

  if (compact) {
    return (
      <div className={`rounded-lg border px-3 py-2 ${color}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">{agent.agent_id}</span>
          <span className="text-sm font-medium">{agent.name_ko}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${color} transition-shadow hover:shadow-md`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold opacity-60">{agent.agent_id}</span>
          <span className="text-base font-semibold">{agent.name_ko}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge}`}>
          {agent.division}
        </span>
      </div>
      <p className="mb-2 text-xs leading-relaxed opacity-70">{agent.name_en}</p>
      <p className="mb-3 text-sm leading-relaxed">{agent.role_description}</p>
      <div className="flex flex-wrap gap-1">
        {agent.capabilities.map((cap) => (
          <span
            key={cap}
            className="rounded-md bg-white/60 px-1.5 py-0.5 text-[10px] font-medium"
          >
            {cap}
          </span>
        ))}
      </div>
    </div>
  );
}
