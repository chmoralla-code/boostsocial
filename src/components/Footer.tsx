import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full py-8 text-center text-slate-600 mt-auto">
      <div className="flex justify-center gap-2 text-sm font-medium">
        <Link href="/" className="hover:text-blue-600">Home</Link>
        <span>|</span>
        <Link href="#pricing" className="hover:text-blue-600">Pricing</Link>
        <span>|</span>
        <Link href="#about" className="hover:text-blue-600">About</Link>
        <span>|</span>
        <Link href="#contact" className="hover:text-blue-600">Contact</Link>
      </div>
    </footer>
  );
}
