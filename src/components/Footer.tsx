import Link from "next/link";
import Icon from "./Icon";
import BrandLogo from "./BrandLogo";
import Newsletter from "./Newsletter";
import { getSettings } from "@/lib/settings";
import { telHref, waLink } from "@/lib/settings-shared";

const COLS: [string, [string, string][]][] = [
  ["Shop", [["/shop?category=optical", "Eyeglasses"], ["/shop?category=sunglasses", "Sunglasses"], ["/shop?sort=new", "New arrivals"], ["/shop?sort=best", "Bestsellers"], ["/try-on", "3D Virtual Try-On"]]],
  ["Help", [["/lenses", "Lenses & prescriptions"], ["/policies/shipping", "Shipping & customs"], ["/policies/returns", "Returns & exchanges"], ["/account", "Track my order"], ["/blog", "Journal"]]],
  ["Company", [["/policies/privacy", "Privacy policy"], ["/policies/terms", "Terms of service"], ["/wishlist", "Wishlist"], ["/login", "My account"]]],
];

export default async function Footer() {
  const { store } = await getSettings();
  return (
    <footer className="bg-[var(--navy)] text-[#c7d7f5] mt-0">
      <div className="container-x py-16 grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
        <div>
          <div className="font-display text-2xl text-white font-semibold">{store.name}</div>
          <p className="mt-3 text-sm leading-relaxed max-w-sm">{store.description}</p>
          <div className="mt-6">
            <div className="text-white font-bold text-sm mb-2">Get new drops & offers</div>
            <Newsletter dark />
          </div>
        </div>
        {COLS.map(([title, links]) => (
          <div key={title}>
            <div className="text-white font-bold text-sm mb-4">{title}</div>
            <ul className="grid gap-2.5 text-sm">
              {links.map(([href, label]) => (
                <li key={href}><Link href={href} className="hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <div className="text-white font-bold text-sm mb-4">Contact us</div>
          <ul className="grid gap-3 text-sm">
            <li><a href={`mailto:${store.email}`} className="flex items-center gap-2 hover:text-white break-all"><Icon name="mail" size={15} /> {store.email}</a></li>
            <li><a href={telHref(store.phone)} className="flex items-center gap-2 hover:text-white"><Icon name="phone" size={15} /> {store.phone}</a></li>
            <li><a href={waLink(store.whatsapp)} target="_blank" rel="noopener" className="flex items-center gap-2 hover:text-white"><Icon name="chat" size={15} /> WhatsApp {store.phone}</a></li>
            <li className="flex items-center gap-2"><Icon name="globe" size={15} /> {store.address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x py-5 flex flex-wrap gap-4 justify-between text-xs">
          <span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span>
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-white/80">We accept</span>
            <span className="h-8 px-3 rounded-md bg-white grid place-items-center"><BrandLogo name="paypal" className="h-4" /></span>
            <span className="h-8 px-3 rounded-md bg-white grid place-items-center"><BrandLogo name="xtransfer" className="h-4" /></span>
            <span className="font-bold text-white/80 ml-2">Ships with</span>
            <span className="h-8 px-3 rounded-md bg-[#ffcc00] grid place-items-center"><BrandLogo name="dhl" className="h-3.5" /></span>
          </span>
        </div>
      </div>
    </footer>
  );
}
