'use client';

import { useMemo } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassPanel } from './GlassPanel';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useDepartmentStore } from '@/stores/departmentStore';

export function StatsWidget() {
    const agents = useAgentStore((s) => s.agents);
    const tasks = useTaskStore((s) => s.tasks);
    const departments = useDepartmentStore((s) => s.departments);

    const safeAgents = Array.isArray(agents) ? agents : [];
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeDepts = Array.isArray(departments) ? departments : [];

    const data = useMemo(() => {
        const pendingCount = safeTasks.filter((t) => t.status === 'PENDING').length;
        const runningCount = safeTasks.filter((t) => t.status === 'RUNNING' || t.status === 'IN_PROGRESS').length;
        const completedCount = safeTasks.filter((t) => t.status === 'COMPLETED').length;
        const failedCount = safeTasks.filter((t) => t.status === 'FAILED').length;
        const activeAgentCount = safeAgents.filter(
            (a) => a.status === 'ACTIVE' || a.status === 'RUNNING',
        ).length;

        return [
            { name: 'Employees', value: activeAgentCount, timestamp: 'Active' },
            { name: 'Depts', value: safeDepts.length, timestamp: 'Total' },
            { name: 'Pending', value: pendingCount, timestamp: 'Pending' },
            { name: 'Running', value: runningCount, timestamp: 'Running' },
            { name: 'Done', value: completedCount, timestamp: 'Completed' },
            { name: 'Failed', value: failedCount, timestamp: 'Failed' },
        ];
    }, [safeAgents, safeTasks, safeDepts]);

    const trend = useMemo(() => {
        const totalActive = safeAgents.filter((a) => a.status === 'ACTIVE' || a.status === 'RUNNING').length;
        const total = safeAgents.length || 1;
        const pct = Math.round((totalActive / total) * 100);
        return `${pct}% active`;
    }, [safeAgents]);

    const hasData = data.some((d) => d.value > 0);

    if (!hasData) {
        return (
            <GlassPanel className="p-6 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-400" />
                        <h3 className="text-lg font-semibold text-white">Performance</h3>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-zinc-500 text-sm">Waiting for workspace data...</p>
                </div>
            </GlassPanel>
        );
    }

    return (
        <GlassPanel className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Performance</h3>
                </div>
                <div className="flex items-center gap-1 text-[color:var(--state-success)] text-sm font-medium">
                    <TrendingUp className="w-4 h-4" />
                    {trend}
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: '#a1a1aa', fontSize: 11 }}
                            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        />
                        <YAxis
                            tick={{ fill: '#a1a1aa', fontSize: 11 }}
                            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        />
                        <Tooltip
                            contentStyle={{
                                background: 'rgba(0,0,0,0.8)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: '#fff',
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#a78bfa"
                            strokeWidth={2}
                            dot={{ fill: '#a78bfa', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#a78bfa' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </GlassPanel>
    );
}
