export type MealEvent = {
  id: string;
  type: 'meal';
  title: string;
  subtitle: string;
  time: string;
  servings: number;
  deliveryId?: string;
};

export type Delivery = {
  id: string;
  title: string;
  status: 'Proposed' | 'Approved' | 'Delivered';
  date: string;
  eta: string;
  linkedMeal?: string;
  products: Product[];
  total: string;
};

export type Product = {
  id: string;
  name: string;
  detail: string;
  quantity: string;
  price: string;
  included: boolean;
};

export type HouseholdMember = {
  id: string;
  name: string;
  initials: string;
  role: 'Owner' | 'Member' | 'Child';
  status: 'Active' | 'Pending';
  color: string;
};

export type PlannerDay = {
  id: string;
  day: string;
  date: string;
  events: MealEvent[];
};

export const household = {
  name: 'Petrenko household',
  note: '2 adults · 1 child · Kyiv',
  initials: 'PH',
};

export const members: HouseholdMember[] = [
  { id: 'andrii', name: 'Andrii Petrenko', initials: 'AP', role: 'Owner', status: 'Active', color: '#B8D8C0' },
  { id: 'maria', name: 'Maria Petrenko', initials: 'MP', role: 'Member', status: 'Active', color: '#F3C9A8' },
  { id: 'max', name: 'Max', initials: 'M', role: 'Child', status: 'Active', color: '#C7C1EA' },
];

export const deliveries: Delivery[] = [
  {
    id: 'carbonara', title: 'Carbonara dinner', status: 'Proposed', date: 'Today, 18:00–20:00', eta: 'Delivery slot held', linkedMeal: 'Carbonara for two days', total: '₴486.40',
    products: [
      { id: 'eggs', name: 'Eggs, free range', detail: '10 pcs', quantity: '1 pack', price: '₴78.00', included: true },
      { id: 'pasta', name: 'Spaghetti', detail: '500 g', quantity: '2 packs', price: '₴92.80', included: true },
      { id: 'pancetta', name: 'Pancetta', detail: '200 g', quantity: '1 pack', price: '₴164.60', included: true },
      { id: 'parmesan', name: 'Parmesan', detail: '150 g', quantity: '1 piece', price: '₴151.00', included: true },
    ],
  },
  {
    id: 'weekly-basics', title: 'Weekly basics', status: 'Approved', date: 'Tomorrow, 10:00–12:00', eta: 'Silpo basket ready', total: '₴732.15',
    products: [
      { id: 'milk', name: 'Milk 2.5%', detail: '900 ml', quantity: '2 bottles', price: '₴76.00', included: true },
      { id: 'bananas', name: 'Bananas', detail: '1 kg', quantity: '1 bunch', price: '₴68.50', included: true },
      { id: 'bread', name: 'Sourdough bread', detail: '500 g', quantity: '1 loaf', price: '₴89.00', included: true },
    ],
  },
  {
    id: 'last-purchase', title: 'Last purchase', status: 'Delivered', date: '2 days ago', eta: 'Completed', total: '₴1,248.20',
    products: [
      { id: 'chicken', name: 'Chicken thighs', detail: '800 g', quantity: '1 pack', price: '₴196.00', included: true },
      { id: 'greens', name: 'Mixed greens', detail: '150 g', quantity: '1 pack', price: '₴84.00', included: true },
    ],
  },
];

export const plannerDays: PlannerDay[] = [
  {
    id: 'today', day: 'Today', date: '18 Sep', events: [
      { id: 'breakfast', type: 'meal', title: 'Breakfast', subtitle: 'Yogurt, berries & granola', time: '08:30', servings: 3 },
      { id: 'dinner', type: 'meal', title: 'Carbonara dinner', subtitle: 'Pancetta, parmesan & eggs', time: '18:30', servings: 5, deliveryId: 'carbonara' },
    ],
  },
  {
    id: 'tomorrow', day: 'Tomorrow', date: '19 Sep', events: [
      { id: 'lunch', type: 'meal', title: 'Lunch', subtitle: 'Roasted vegetables & couscous', time: '13:00', servings: 3, deliveryId: 'weekly-basics' },
      { id: 'delivery', type: 'meal', title: 'Weekly basics delivery', subtitle: 'Standalone grocery delivery', time: '10:00–12:00', servings: 0, deliveryId: 'weekly-basics' },
    ],
  },
  { id: 'saturday', day: 'Sat', date: '20 Sep', events: [{ id: 'breakfast-sat', type: 'meal', title: 'Breakfast', subtitle: 'Pancakes with fruit', time: '09:00', servings: 3 }] },
  { id: 'sunday', day: 'Sun', date: '21 Sep', events: [] },
];
