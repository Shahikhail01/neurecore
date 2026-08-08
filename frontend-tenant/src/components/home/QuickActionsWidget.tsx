'use client';

import { motion } from 'framer-motion';
import { Zap, ClipboardList, CheckSquare, Play, BarChart3 } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { useRouter } from 'next/navigation';

interface QuickAction {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    onClick?: () => void;
}

const QUICK_ACTIONS: QuickAction[] = [
    {
        id: 'new-task',
        label: 'New Task',
        icon: ClipboardList,
        color: 'from-blue-400 to-blue-600',
    },
    {
        id: 'new-approval',
        label: 'Request Approval',
        icon: CheckSquare,
        color: 'from-purple-400 to-purple-600',
    },
    {
        id: 'run-workflow',
        label: 'Run Workflow',
        icon: Play,
        color: 'from-pink-400 to-pink-600',
    },
    {
        id: 'new-report',
        label: 'Generate Report',
        icon: BarChart3,
        color: 'from-green-400 to-green-600',
    },
];

export function QuickActionsWidget() {
    const router = useRouter();

    const handlers: Record<string, () => void> = {
        'new-task': () => router.push('/departments'),
        'new-approval': () => router.push('/service-desk/approvals-hub'),
        'run-workflow': () => router.push('/routines'),
        'new-report': () => router.push('/intelligence'),
    };

    return (
        <GlassPanel className="p-6 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 flex-1">
                {QUICK_ACTIONS.map((action, index) => {
                    const Icon = action.icon;
                    return (
                        <motion.button
                            key={action.id}
                            type="button"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handlers[action.id]}
                            className={`bg-gradient-to-br ${action.color} rounded-2xl p-4 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 group`}
                        >
                            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                                <Icon className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-sm font-medium text-white text-center">{action.label}</span>
                        </motion.button>
                    );
                })}
            </div>
        </GlassPanel>
    );
}
