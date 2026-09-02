import type { Order } from '@miyko/contracts';

import type { ApiDelivery } from '@/api/types';

export type UiDelivery = {
  id: string;
  title: string;
  status: string;
  date: string;
  eta: string;
  linkedMeal?: string;
  total: string;
  products: Array<{ id: string; name: string; detail: string; quantity: string; price: string }>;
};

export function formatMoney(amount: number, currency = 'UAH') {
  return currency === 'UAH' ? `₴${amount.toFixed(2)}` : `${amount.toFixed(2)} ${currency}`;
}

export function formatSchedule(value: string) {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function formatDeliveryStatus(status: ApiDelivery['status']) {
  return status === 'scheduled' ? 'Scheduled' : status === 'delivered' ? 'Delivered' : status === 'cancelled' ? 'Cancelled' : 'Pending';
}

export function presentDelivery(delivery: ApiDelivery, order: Order | null = null, productNames: Record<string, { name: string; unit: string }> = {}): UiDelivery {
  const products = order?.items ?? [];
  return {
    id: delivery.id,
    title: 'Grocery delivery',
    status: formatDeliveryStatus(delivery.status),
    date: delivery.scheduledFrom ? formatSchedule(delivery.scheduledFrom) : 'Schedule unavailable',
    eta: delivery.status === 'delivered' ? 'Completed' : 'Scheduled',
    total: order?.totalAmount === null || order?.totalAmount === undefined ? 'Total unavailable' : formatMoney(order.totalAmount, order.currency),
    products: products.map((product) => ({
      id: product.id,
      name: productNames[product.productId ?? '']?.name ?? product.productName,
      detail: productNames[product.productId ?? '']?.unit ?? product.unit,
      quantity: `${product.quantity} ${product.unit}`,
      price: product.totalPrice === null ? 'Price unavailable' : formatMoney(product.totalPrice, product.currency),
    })),
  };
}
