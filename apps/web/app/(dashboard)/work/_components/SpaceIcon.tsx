"use client";

import {
  Anchor, Apple, Award, Baby, Bike, Book, Briefcase, Bug, Building2, Calculator, Camera, Car, ChartLine, Code, Coffee, Compass, Cpu, Crown,
  Database, DollarSign, Dumbbell, Factory, Feather, Flag, Flame, FlaskConical, Gem, Gift, Globe, GraduationCap, Hammer, Headphones, Heart,
  Home, Landmark, Leaf, Lightbulb, Megaphone, Music, Package, Palette, PenTool, Plane, Rocket, Scale, Search, Settings, Share2, ShieldCheck,
  ShoppingCart, Sparkles, Star, Stethoscope, Target, Truck, Trophy, Users, Wrench, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const SPACE_ICONS: Record<string, typeof Rocket> = {
  anchor: Anchor, apple: Apple, award: Award, baby: Baby, bike: Bike, book: Book, briefcase: Briefcase, bug: Bug, building: Building2,
  calculator: Calculator, camera: Camera, car: Car, chart: ChartLine, code: Code, coffee: Coffee, compass: Compass, cpu: Cpu, crown: Crown,
  database: Database, dollar: DollarSign, dumbbell: Dumbbell, factory: Factory, feather: Feather, flag: Flag, flame: Flame, flask: FlaskConical,
  gem: Gem, gift: Gift, globe: Globe, graduation: GraduationCap, hammer: Hammer, headphones: Headphones, heart: Heart, home: Home,
  bank: Landmark, leaf: Leaf, idea: Lightbulb, megaphone: Megaphone, music: Music, package: Package, palette: Palette, pen: PenTool,
  plane: Plane, rocket: Rocket, scale: Scale, search: Search, settings: Settings, share: Share2, shield: ShieldCheck, cart: ShoppingCart,
  sparkles: Sparkles, star: Star, health: Stethoscope, target: Target, truck: Truck, trophy: Trophy, users: Users, wrench: Wrench, zap: Zap,
};
export const SPACE_COLORS = ["#4B5563", "#9CA3AF", "#6D28D9", "#4F46E5", "#2563EB", "#0891B2", "#047857", "#16A34A", "#CA8A04", "#EA580C", "#DC2626", "#DB2777", "#9333EA", "#B08D57"];

/** The badge for a space: its icon (if set) or its first letter, on its colour. */
export function SpaceIcon({ name, color, icon, size = 20, className }: { name: string; color: string; icon?: string | null; size?: number; className?: string }) {
  const I = icon ? SPACE_ICONS[icon] : undefined;
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-[5px] font-bold text-white", className)}
      style={{ background: color, width: size, height: size, fontSize: Math.round(size * 0.52) }}
    >
      {I ? <I style={{ width: size * 0.62, height: size * 0.62 }} strokeWidth={2.2} /> : name.charAt(0).toUpperCase()}
    </span>
  );
}
