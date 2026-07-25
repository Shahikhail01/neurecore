'use client';

import { motion } from 'framer-motion';
import { CheckSquare, Circle } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { useTaskStore } from '@/stores/taskStore';
import { clsx } from 'clsx';

export function TasksWidget() {
    const tasks = useTaskStore((s) => s.tasks);
    const loading = useTaskStore((s) => s.loading);

    const safeTasks = Array.isArray(tasks) ? tasks : [];

    const activeTasks = safeTasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    const completedCount = safeTasks.filter((t) => t.status === 'COMPLETED').length;

    const isLoading = loading && safeTasks.length === 0;

    return (
        <GlassPanel className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-[color:var(--state-success)]" />
                    <h3 className="text-lg font-semibold text-white">Tasks</h3>
                </div>
                {completedCount > 0 && (
                    <span className="text-xs bg-green-400/20 text-green-300 px-2 py-1 rounded-full">
                        {completedCount} done
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                        <Circle className="w-3 h-3 animate-spin" />
                        Loading tasks...
                    </div>
                ) : activeTasks.length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-4">No active tasks</p>
                ) : (
                    activeTasks.slice(0, 8).map((task, index) => (
                        <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <span className={clsx(
                                'w-2 h-2 rounded-full shrink-0',
                                task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'bg-red-400' :
                                task.priority === 'MEDIUM' ? 'bg-yellow-400' :
                                'bg-green-400',
                            )} />
                            <span className="flex-1 text-sm text-zinc-200 truncate">{task.title}</span>
                            <span className="text-xs text-zinc-500">{task.status}</span>
                        </motion.div>
                    ))
                )}
            </div>
        </GlassPanel>
    );
}
