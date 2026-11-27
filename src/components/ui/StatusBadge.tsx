import React from 'react';
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  Sparkles,
  UserCheck,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { OrderStatus, PaymentStatus } from '../../types/database';

export const OrderStatusLabel: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const config: Record<OrderStatus, { style: string; icon: React.ReactNode }> = {
    Baru: {
      style: 'text-blue-700 bg-blue-50 border-blue-200',
      icon: <Sparkles className="w-3.5 h-3.5 shrink-0" />,
    },
    Terjadwal: {
      style: 'text-sky-700 bg-sky-50 border-sky-200',
      icon: <CalendarClock className="w-3.5 h-3.5 shrink-0" />,
    },
    Ditugaskan: {
      style: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      icon: <UserCheck className="w-3.5 h-3.5 shrink-0" />,
    },
    Dikerjakan: {
      style: 'text-amber-700 bg-amber-50 border-amber-200',
      icon: <Wrench className="w-3.5 h-3.5 shrink-0" />,
    },
    Selesai: {
      style: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
    },
    Dibatalkan: {
      style: 'text-red-700 bg-red-50 border-red-200',
      icon: <Ban className="w-3.5 h-3.5 shrink-0" />,
    },
  };

  const current = config[status] || config.Baru;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold whitespace-nowrap shrink-0 ${current.style}`}
    >
      {current.icon}
      <span>{status}</span>
    </span>
  );
};

export const PaymentStatusLabel: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  const config: Record<PaymentStatus, { style: string; icon: React.ReactNode }> = {
    'BELUM BAYAR': {
      style: 'text-red-700 bg-red-50 border-red-200',
      icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
    },
    DP: {
      style: 'text-amber-700 bg-amber-50 border-amber-200',
      icon: <Wallet className="w-3.5 h-3.5 shrink-0" />,
    },
    LUNAS: {
      style: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
    },
  };

  const current = config[status] || config['BELUM BAYAR'];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold whitespace-nowrap shrink-0 ${current.style}`}
    >
      {current.icon}
      <span>{status}</span>
    </span>
  );
};
