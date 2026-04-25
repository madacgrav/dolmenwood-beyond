import { redirect } from 'next/navigation';

export default function HomePage() {
  // Will be replaced with auth check middleware
  redirect('/characters');
}
