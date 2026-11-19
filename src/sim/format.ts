/** Rupees, grouped the Indian way: 1000000 → "₹10,00,000". */
export function formatRupees(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = Math.round(Math.abs(amount)).toString();
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+$)/g, ',')},${lastThree}` : lastThree;
  return `${sign}₹${grouped}`;
}
