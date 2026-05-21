import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Menu, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <div className="px-5 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">InternStellar</h1>
        <button className="w-9 h-9 flex items-center justify-center">
          <Menu className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-12">
        {/* Hero Headline */}
        <h2 className="text-6xl font-bold text-foreground leading-[0.95] tracking-tight mb-16">
          Bridge made<br />
          by users 👥<br />
          For the people.
        </h2>

        {/* Description */}
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-sm">
          A 7-day prototype for OFWs and their families. Funded splits, real-time wishlists, and Soroban-backed escrow.
        </p>

        {/* CTA Button */}
        <Button
          onClick={() => navigate("/login")}
          className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] hover:from-[#4a6bef] hover:to-[#6b89ef] text-white rounded-full py-7 text-base font-semibold shadow-lg shadow-primary/25"
        >
          Get Started
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by Stellar Soroban
        </p>
      </div>
    </div>
  );
}
